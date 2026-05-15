#!/usr/bin/env node

/**
 * Delete Helius Webhook
 * 
 * Deletes all Helius webhooks for our URL to stop the webhook billing.
 * Run with: HELIUS_API_KEY=xxx node apps/x402-jobs-api/scripts/delete-helius-webhook.mjs
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://api.x402.jobs/webhooks/helius';

if (!HELIUS_API_KEY) {
  console.error('❌ HELIUS_API_KEY is required');
  process.exit(1);
}

async function main() {
  console.log('🔍 Listing all Helius webhooks...');
  
  // List existing webhooks
  const listRes = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}`);
  const webhooks = await listRes.json();
  
  console.log(`Found ${webhooks.length} webhook(s)\n`);
  
  if (webhooks.length === 0) {
    console.log('✅ No webhooks to delete');
    return;
  }
  
  // Show all webhooks
  for (const webhook of webhooks) {
    console.log(`  - ${webhook.webhookID}`);
    console.log(`    URL: ${webhook.webhookURL}`);
    console.log(`    Addresses: ${webhook.accountAddresses?.length || 0}`);
    console.log();
  }
  
  // Find webhooks matching our URL
  const matchingWebhooks = webhooks.filter(w => w.webhookURL === WEBHOOK_URL);
  
  if (matchingWebhooks.length === 0) {
    console.log(`ℹ️  No webhooks found for ${WEBHOOK_URL}`);
    console.log('   To delete all webhooks, set WEBHOOK_URL=all');
    return;
  }
  
  console.log(`🗑️  Deleting ${matchingWebhooks.length} webhook(s) for ${WEBHOOK_URL}...\n`);
  
  for (const webhook of matchingWebhooks) {
    try {
      const deleteRes = await fetch(
        `https://api.helius.xyz/v0/webhooks/${webhook.webhookID}?api-key=${HELIUS_API_KEY}`,
        { method: 'DELETE' }
      );
      
      if (deleteRes.ok) {
        console.log(`✅ Deleted webhook: ${webhook.webhookID}`);
      } else {
        const error = await deleteRes.text();
        console.error(`❌ Failed to delete ${webhook.webhookID}: ${error}`);
      }
    } catch (error) {
      console.error(`❌ Error deleting ${webhook.webhookID}:`, error.message);
    }
  }
  
  console.log('\n✅ Done! Webhooks deleted.');
  console.log('   Your Helius account will no longer receive webhook events.');
}

main().catch(console.error);

