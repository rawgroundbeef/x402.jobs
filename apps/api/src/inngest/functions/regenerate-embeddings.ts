import { inngest } from "../../lib/inngest";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config";

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const BATCH_SIZE = 50;

interface ResourceData {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  capabilities: string[] | null;
  extra: Record<string, unknown> | null;
}

interface JobData {
  id: string;
  name: string;
  description: string | null;
  workflow_definition: {
    nodes?: Array<{
      type: string;
      data: {
        resource?: {
          name?: string;
          description?: string;
        };
      };
    }>;
  } | null;
}

/**
 * Build embedding text from resource metadata
 */
function buildResourceEmbeddingText(resource: ResourceData): string {
  const parts: string[] = [
    resource.name,
    resource.description || "",
    resource.category || "",
    ...(resource.tags || []),
    ...(resource.capabilities || []),
  ];

  // Include relevant extra fields
  if (resource.extra) {
    const { agentName, serviceName, commands } = resource.extra as {
      agentName?: string;
      serviceName?: string;
      commands?: string[];
    };
    if (agentName) parts.push(agentName);
    if (serviceName) parts.push(serviceName);
    if (commands) parts.push(...commands);
  }

  return parts.filter(Boolean).join(". ").slice(0, 8000);
}

/**
 * Build embedding text from job metadata
 */
function buildJobEmbeddingText(job: JobData): string {
  const parts: string[] = [job.name, job.description || ""];

  // Include resource names and descriptions from workflow
  if (job.workflow_definition?.nodes) {
    for (const node of job.workflow_definition.nodes) {
      if (node.type === "resource" && node.data.resource) {
        if (node.data.resource.name) parts.push(node.data.resource.name);
        if (node.data.resource.description)
          parts.push(node.data.resource.description);
      }
    }
  }

  return parts.filter(Boolean).join(". ").slice(0, 8000);
}

/**
 * Generate embeddings in batch using OpenAI
 */
async function generateEmbeddingsBatch(
  texts: string[],
): Promise<(number[] | null)[]> {
  if (!OPENAI_API_KEY || texts.length === 0) {
    return texts.map(() => null);
  }

  const results: (number[] | null)[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: batch,
          dimensions: 1536,
        }),
      });

      if (!response.ok) {
        console.error(`Embedding API error: ${response.status}`);
        results.push(...batch.map(() => null));
        continue;
      }

      const data = await response.json();
      results.push(
        ...data.data.map((d: { embedding: number[] }) => d.embedding),
      );

      // Rate limit: wait between batches
      if (i + BATCH_SIZE < texts.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (error) {
      console.error("Batch embedding failed:", error);
      results.push(...batch.map(() => null));
    }
  }

  return results;
}

/**
 * Nightly cron job to regenerate embeddings for resources and jobs
 *
 * This handles:
 * - Resources missing embeddings
 * - Resources with stale embeddings (updated recently)
 * - Jobs with webhooks that need to be searchable
 */
export const regenerateEmbeddings = inngest.createFunction(
  {
    id: "regenerate-embeddings",
    retries: 1,
  },
  // Run every night at 3 AM UTC
  { cron: "0 3 * * *" },
  async ({ step, logger }) => {
    if (!OPENAI_API_KEY) {
      logger.warn("OPENAI_API_KEY not set, skipping embedding regeneration");
      return { skipped: true, reason: "No API key" };
    }

    // Step 1: Regenerate resource embeddings
    const resourceStats = await step.run(
      "regenerate-resource-embeddings",
      async () => {
        // Find resources missing embeddings or updated in last 24 hours
        const oneDayAgo = new Date(
          Date.now() - 24 * 60 * 60 * 1000,
        ).toISOString();

        const { data: resources, error } = await supabase
          .from("x402_resources")
          .select("id, name, description, category, tags, capabilities, extra")
          .eq("is_active", true)
          .or(`embedding.is.null,updated_at.gte.${oneDayAgo}`)
          .limit(500);

        if (error) {
          logger.error("Failed to fetch resources:", error);
          return { processed: 0, errors: 1 };
        }

        if (!resources || resources.length === 0) {
          logger.info("No resources need embedding updates");
          return { processed: 0, errors: 0 };
        }

        logger.info(`Found ${resources.length} resources to process`);

        // Build embedding texts
        const texts = resources.map((r) =>
          buildResourceEmbeddingText(r as ResourceData),
        );

        // Generate embeddings in batch
        const embeddings = await generateEmbeddingsBatch(texts);

        // Update resources with embeddings
        let updated = 0;
        let errors = 0;

        for (let i = 0; i < resources.length; i++) {
          const resource = resources[i];
          const embedding = embeddings[i];
          if (!resource || !embedding) {
            errors++;
            continue;
          }

          const { error: updateError } = await supabase
            .from("x402_resources")
            .update({ embedding: `[${embedding.join(",")}]` })
            .eq("id", resource.id);

          if (updateError) {
            logger.error(
              `Failed to update resource ${resource.id}:`,
              updateError,
            );
            errors++;
          } else {
            updated++;
          }
        }

        return { processed: updated, errors };
      },
    );

    // Step 2: Regenerate job embeddings (for webhook-enabled jobs)
    const jobStats = await step.run("regenerate-job-embeddings", async () => {
      // Find webhook jobs missing embeddings or updated recently
      const oneDayAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: jobs, error } = await supabase
        .from("x402_jobs")
        .select("id, name, description, workflow_definition")
        .eq("is_active", true)
        .or('trigger_type.eq.webhook,trigger_methods.cs.{"webhook":true}')
        .or(`embedding.is.null,updated_at.gte.${oneDayAgo}`)
        .limit(500);

      if (error) {
        logger.error("Failed to fetch jobs:", error);
        return { processed: 0, errors: 1 };
      }

      if (!jobs || jobs.length === 0) {
        logger.info("No jobs need embedding updates");
        return { processed: 0, errors: 0 };
      }

      logger.info(`Found ${jobs.length} jobs to process`);

      // Build embedding texts
      const texts = jobs.map((j) => buildJobEmbeddingText(j as JobData));

      // Generate embeddings in batch
      const embeddings = await generateEmbeddingsBatch(texts);

      // Update jobs with embeddings
      let updated = 0;
      let errors = 0;

      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const embedding = embeddings[i];
        if (!job || !embedding) {
          errors++;
          continue;
        }

        const { error: updateError } = await supabase
          .from("x402_jobs")
          .update({ embedding: `[${embedding.join(",")}]` })
          .eq("id", job.id);

        if (updateError) {
          logger.error(`Failed to update job ${job.id}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      }

      return { processed: updated, errors };
    });

    logger.info("Embedding regeneration complete", {
      resources: resourceStats,
      jobs: jobStats,
    });

    return {
      resources: resourceStats,
      jobs: jobStats,
    };
  },
);
