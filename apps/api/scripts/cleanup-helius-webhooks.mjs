/**
 * Cleanup duplicate Helius webhooks
 * 
 * Run with: node apps/x402-jobs-api/scripts/cleanup-helius-webhooks.mjs
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const KEEP_WEBHOOK_ID = '2e6ff4d9-ab71-4019-aca9-593b605bf241'; // The one we want to keep

if (!HELIUS_API_KEY) {
  console.error('❌ HELIUS_API_KEY environment variable required');
  console.log('Run with: HELIUS_API_KEY=your-key node apps/x402-jobs-api/scripts/cleanup-helius-webhooks.mjs');
  process.exit(1);
}

const BASE_URL = 'https://api.helius.xyz';

async function listWebhooks() {
  const response = await fetch(`${BASE_URL}/v0/webhooks?api-key=${HELIUS_API_KEY}`);
  if (!response.ok) {
    throw new Error(`Failed to list webhooks: ${response.status}`);
  }
  return response.json();
}

async function deleteWebhook(webhookId) {
  const response = await fetch(`${BASE_URL}/v0/webhooks/${webhookId}?api-key=${HELIUS_API_KEY}`, {
    method: 'DELETE',
  });
  return response.ok;
}

async function main() {
  console.log('🔍 Fetching all webhooks...\n');
  
  const webhooks = await listWebhooks();
  console.log(`Found ${webhooks.length} total webhooks\n`);

  // Filter for x402.jobs webhooks
  const x402Webhooks = webhooks.filter(w => 
    w.webhookURL?.includes('api.x402.jobs/webhooks/helius')
  );

  console.log(`Found ${x402Webhooks.length} webhooks for api.x402.jobs/webhooks/helius:\n`);

  for (const w of x402Webhooks) {
    const isKeeper = w.webhookID === KEEP_WEBHOOK_ID;
    console.log(`  ${isKeeper ? '✅ KEEP' : '❌ DELETE'}: ${w.webhookID}`);
    console.log(`     Addresses: ${w.accountAddresses?.length || 0}`);
  }

  // Webhooks to delete
  const toDelete = x402Webhooks.filter(w => w.webhookID !== KEEP_WEBHOOK_ID);

  if (toDelete.length === 0) {
    console.log('\n✨ No duplicates to delete!');
    return;
  }

  console.log(`\n🗑️  Deleting ${toDelete.length} duplicate webhooks...\n`);

  let deleted = 0;
  let failed = 0;

  for (const w of toDelete) {
    process.stdout.write(`  Deleting ${w.webhookID}... `);
    const success = await deleteWebhook(w.webhookID);
    if (success) {
      console.log('✅');
      deleted++;
    } else {
      console.log('❌ FAILED');
      failed++;
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Deleted: ${deleted}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Kept: 1 (${KEEP_WEBHOOK_ID})`);
}

main().catch(console.error);

