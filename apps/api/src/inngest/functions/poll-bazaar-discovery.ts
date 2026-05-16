/**
 * Poll Bazaar Discovery APIs
 *
 * Cron job that periodically polls facilitator discovery APIs
 * to index new x402-enabled servers and resources.
 */

import { inngest } from "../../lib/inngest";
import { pollAllBazaars, discoverFacilitators } from "../../indexers/bazaar";

/**
 * Poll all Bazaar/discovery APIs every 5 minutes
 */
export const pollBazaarDiscovery = inngest.createFunction(
  {
    id: "poll-bazaar-discovery",
    retries: 2,
  },
  // Run every 5 minutes
  { cron: "*/5 * * * *" },
  async ({ step, logger }) => {
    // Step 1: Discover/update facilitator capabilities
    const facilitatorsUpdated = await step.run(
      "discover-facilitators",
      async () => {
        logger.info("Discovering facilitator capabilities...");
        const updated = await discoverFacilitators();
        logger.info(`Updated ${updated} facilitators`);
        return updated;
      },
    );

    // Step 2: Poll all bazaar discovery APIs
    const pollResults = await step.run("poll-bazaars", async () => {
      logger.info("Polling Bazaar discovery APIs...");
      const results = await pollAllBazaars();
      logger.info("Bazaar poll complete", results);
      return results;
    });

    return {
      facilitatorsUpdated,
      ...pollResults,
    };
  },
);

/**
 * Manual trigger to poll bazaars on demand
 */
export const triggerBazaarPoll = inngest.createFunction(
  {
    id: "trigger-bazaar-poll",
    retries: 1,
  },
  { event: "x402/bazaar.poll" },
  async ({ step, logger }) => {
    logger.info("Manual bazaar poll triggered");

    const results = await step.run("poll-bazaars", async () => {
      return await pollAllBazaars();
    });

    return results;
  },
);
