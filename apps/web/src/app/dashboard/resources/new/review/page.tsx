"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { WizardShell } from "@/components/wizard/WizardShell";
import { getDraft, clearDraft, WizardDraft } from "@/lib/wizard-draft";
import { RESOURCE_CATEGORIES } from "@/constants/categories";
import { getNetwork } from "@/lib/networks";
import { authenticatedFetch, authenticatedFetcher } from "@/lib/api";
import { Loader2 } from "lucide-react";

const TYPE_TO_API: Record<string, string> = {
  link: "external",
  proxy: "proxy",
  claude: "prompt_template",
  openrouter: "openrouter_instant",
};

const TYPE_DISPLAY: Record<string, string> = {
  link: "Link Existing",
  proxy: "Proxy",
  claude: "Claude Prompt",
  openrouter: "OpenRouter",
};

export default function ReviewPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");

  const { data: profileData } = useSWR<{ profile: { username: string } | null }>(
    "/user/profile",
    authenticatedFetcher
  );
  const username = profileData?.profile?.username || "username";

  useEffect(() => {
    const loadedDraft = getDraft();
    if (!loadedDraft?.type || !loadedDraft?.name) {
      router.replace("/dashboard/resources/new");
      return;
    }
    setDraft(loadedDraft);
    setIsLoaded(true);
  }, [router]);

  const handlePublish = async () => {
    if (!draft) return;
    setIsPublishing(true);
    setPublishError("");

    try {
      // Link Existing uses POST /resources (external registration endpoint)
      if (draft.type === "link") {
        const lc = draft.linkConfig as Record<string, unknown>;

        const body: Record<string, unknown> = {
          resourceUrl: lc.url as string,
          network: draft.network,
          name: draft.name!.trim(),
          payTo: lc.payTo as string,
          description: draft.description?.trim() || (lc.description as string) || null,
          category: draft.category,
          avatarUrl: draft.imageUrl?.trim() || (lc.avatarUrl as string) || null,
          maxAmountRequired: lc.maxAmountRequired as string,
          asset: lc.asset as string | undefined,
          mimeType: lc.mimeType as string | undefined,
          maxTimeoutSeconds: lc.maxTimeoutSeconds as number | undefined,
          outputSchema: lc.outputSchema as object | undefined,
          isA2A: lc.isA2A as boolean | undefined,
          supportsRefunds: lc.supportsRefunds as boolean | undefined,
        };

        const res = await authenticatedFetch("/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to create resource");
        }

        // External endpoint returns { resource, server, updated }
        const data = await res.json();
        const serverSlug = data.server?.slug || draft.serverSlug || username;
        clearDraft();
        router.push(`/resources/${serverSlug}/${data.resource.slug}`);
        return;
      }

      // Instant types (proxy, claude, openrouter) use POST /resources/instant
      // Build the API body based on resource type
      // For now, all types share the same base fields
      // Type-specific config fields will be added by later phases (21-24)
      const body: Record<string, unknown> = {
        resourceType: TYPE_TO_API[draft.type!] || draft.type,
        name: draft.name!.trim(),
        slug: draft.slug!.trim(),
        description: draft.description?.trim() || null,
        priceUsdc: parseFloat(draft.price!),
        network: draft.network,
        category: draft.category,
        avatarUrl: draft.imageUrl?.trim() || null,
      };

      // Add type-specific fields from draft config objects
      // Proxy: proxyConfig has origin URL, method, headers
      if (draft.type === "proxy" && draft.proxyConfig) {
        Object.assign(body, {
          proxyOriginUrl: draft.proxyConfig.originUrl,
          proxyMethod: draft.proxyConfig.method,
          proxyAuthHeader: draft.proxyConfig.authHeader || null,
        });
      }
      // Claude & OpenRouter: config objects passed through
      // (will be wired in Phases 23-24)
      if (draft.type === "claude" && draft.claudeConfig) {
        Object.assign(body, draft.claudeConfig);
      }
      if (draft.type === "openrouter" && draft.openrouterConfig) {
        Object.assign(body, draft.openrouterConfig);
      }

      const res = await authenticatedFetch("/resources/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create resource");
      }

      // Success - clear draft and redirect to the new resource's detail page
      clearDraft();
      router.push(`/resources/@${username}/${draft.slug}`);
    } catch (err) {
      setPublishError(
        err instanceof Error ? err.message : "Failed to publish resource"
      );
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isLoaded || !draft) return null;

  return (
    <WizardShell
      step={4}
      totalSteps={4}
      title="Review & Publish"
      backHref="/dashboard/resources/new/details"
      footer={
        <Button onClick={handlePublish} disabled={isPublishing}>
          {isPublishing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Publishing...
            </>
          ) : (
            "Publish Resource"
          )}
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Type badge */}
        <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
          {TYPE_DISPLAY[draft.type!] || draft.type}
        </div>

        {/* Error banner */}
        {publishError && (
          <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
            {publishError}
          </div>
        )}

        {/* Basic Information section */}
        <div className="rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">
              Basic Information
            </h2>
            <button
              type="button"
              onClick={() => router.push("/dashboard/resources/new/details")}
              className="text-sm text-primary hover:underline"
            >
              Edit
            </button>
          </div>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="text-base font-medium text-foreground">
                {draft.name}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">URL</dt>
              <dd className="text-sm font-mono text-primary">
                {draft.type === "link" && draft.serverSlug
                  ? `https://x402.jobs/resources/${draft.serverSlug}/${draft.slug}`
                  : `https://x402.jobs/resources/@${username}/${draft.slug}`}
              </dd>
            </div>
            {draft.description && (
              <div>
                <dt className="text-sm text-muted-foreground">Description</dt>
                <dd className="text-sm text-foreground">{draft.description}</dd>
              </div>
            )}
            {draft.imageUrl && (
              <div>
                <dt className="text-sm text-muted-foreground">Image</dt>
                <dd>
                  <img
                    src={draft.imageUrl}
                    alt={draft.name || "Resource image"}
                    className="max-w-[200px] rounded-lg border border-border"
                  />
                </dd>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">Category</dt>
                <dd className="text-sm text-foreground">
                  {RESOURCE_CATEGORIES.find((c) => c.value === draft.category)
                    ?.label || draft.category}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Price</dt>
                <dd className="text-sm font-semibold text-foreground">
                  ${draft.price} USDC
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Network</dt>
                <dd className="text-sm text-foreground">
                  {getNetwork(draft.network).name}
                </dd>
              </div>
            </div>
          </dl>
        </div>

        {/* Type Configuration section */}
        <div className="rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">
              Configuration
            </h2>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/resources/new/${draft.type}`)}
              className="text-sm text-primary hover:underline"
            >
              Edit
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Type: {TYPE_DISPLAY[draft.type!] || draft.type}
          </p>
          {/* Type-specific config display will be expanded by Phases 21-24 */}
          {draft.type === "link" && draft.linkConfig && (() => {
            const linkConfig = draft.linkConfig as { url?: string; method?: string };
            return (
              <div className="mt-3 space-y-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Endpoint URL</dt>
                  <dd className="text-sm font-mono text-foreground break-all">
                    {linkConfig.url || draft.resourceUrl || ''}
                  </dd>
                </div>
                {linkConfig.method && (
                  <div>
                    <dt className="text-sm text-muted-foreground">HTTP Method</dt>
                    <dd className="text-sm font-medium text-foreground">
                      {linkConfig.method}
                    </dd>
                  </div>
                )}
              </div>
            );
          })()}
          {draft.type === "proxy" && draft.proxyConfig && (() => {
            const proxyConfig = draft.proxyConfig as {
              originUrl?: string;
              method?: string;
              authHeader?: string;
            };
            return (
              <div className="mt-3 space-y-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Origin URL</dt>
                  <dd className="text-sm font-mono text-foreground break-all">
                    {proxyConfig.originUrl || ""}
                  </dd>
                </div>
                {proxyConfig.method && (
                  <div>
                    <dt className="text-sm text-muted-foreground">HTTP Method</dt>
                    <dd className="text-sm font-medium text-foreground">
                      {proxyConfig.method}
                    </dd>
                  </div>
                )}
                {proxyConfig.authHeader && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Auth Header</dt>
                    <dd className="text-sm text-foreground">Configured (encrypted on publish)</dd>
                  </div>
                )}
              </div>
            );
          })()}

        {draft.type === "claude" && draft.claudeConfig && (() => {
          const claudeConfig = draft.claudeConfig as {
            systemPrompt?: string;
            parameters?: Array<{
              name: string;
              description?: string;
              required?: boolean;
              default?: string;
            }>;
            maxTokens?: number;
          };
          return (
            <div className="mt-3 space-y-3">
              <div>
                <dt className="text-sm text-muted-foreground">System Prompt</dt>
                <dd className="text-sm font-mono text-foreground mt-1 p-2 bg-muted/30 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {claudeConfig.systemPrompt || ""}
                </dd>
              </div>
              {claudeConfig.parameters && claudeConfig.parameters.length > 0 && (
                <div>
                  <dt className="text-sm text-muted-foreground">Parameters</dt>
                  <dd className="space-y-2 mt-1">
                    {claudeConfig.parameters.map((param, i) => (
                      <div key={i} className="p-2 bg-muted/30 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-primary">
                            {"{" + param.name + "}{/" + param.name + "}"}
                          </code>
                          {!param.required && (
                            <span className="text-xs text-muted-foreground">(optional)</span>
                          )}
                        </div>
                        {param.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {param.description}
                          </p>
                        )}
                        {param.default && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Default: {param.default}
                          </p>
                        )}
                      </div>
                    ))}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-muted-foreground">Max Tokens</dt>
                <dd className="text-sm font-mono text-foreground">
                  {claudeConfig.maxTokens?.toLocaleString() || "4,096"}
                </dd>
              </div>
            </div>
          );
        })()}

        {draft.type === "openrouter" && draft.openrouterConfig && (() => {
          const orConfig = draft.openrouterConfig as {
            modelId?: string;
            modelName?: string;
            provider?: string;
            systemPrompt?: string;
            parameters?: Array<{
              name: string;
              description?: string;
              required?: boolean;
              default?: string;
            }>;
            temperature?: number;
            maxTokens?: number;
          };
          return (
            <div className="mt-3 space-y-3">
              <div>
                <dt className="text-sm text-muted-foreground">Model</dt>
                <dd className="text-sm font-medium text-foreground mt-1">
                  {orConfig.modelName || orConfig.modelId || "Unknown model"}
                  {orConfig.provider && (
                    <span className="text-muted-foreground font-normal ml-2">
                      by {orConfig.provider}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">System Prompt</dt>
                <dd className="text-sm font-mono text-foreground mt-1 p-2 bg-muted/30 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {orConfig.systemPrompt || ""}
                </dd>
              </div>
              {orConfig.parameters && orConfig.parameters.length > 0 && (
                <div>
                  <dt className="text-sm text-muted-foreground">Parameters</dt>
                  <dd className="space-y-2 mt-1">
                    {orConfig.parameters.map((param, i) => (
                      <div key={i} className="p-2 bg-muted/30 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-primary">
                            {"{" + param.name + "}{/" + param.name + "}"}
                          </code>
                          {!param.required && (
                            <span className="text-xs text-muted-foreground">(optional)</span>
                          )}
                        </div>
                        {param.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {param.description}
                          </p>
                        )}
                        {param.default && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Default: {param.default}
                          </p>
                        )}
                      </div>
                    ))}
                  </dd>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Temperature:</span>
                  <span className="font-mono ml-2">{orConfig.temperature ?? 1.0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max Tokens:</span>
                  <span className="font-mono ml-2">{orConfig.maxTokens?.toLocaleString() || "4,096"}</span>
                </div>
              </div>
            </div>
          );
        })()}
        </div>
      </div>
    </WizardShell>
  );
}
