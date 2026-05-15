#!/usr/bin/env node

/**
 * Create Helius Webhook
 * 
 * Creates a new Helius webhook to track USDC transfers to x402 server addresses.
 * Run with: HELIUS_API_KEY=xxx node apps/x402-jobs-api/scripts/create-helius-webhook.mjs
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://api.x402.jobs/webhooks/helius';

if (!HELIUS_API_KEY) {
  console.error('❌ HELIUS_API_KEY is required');
  process.exit(1);
}

async function main() {
  console.log('🔍 Checking for existing webhooks...');
  
  // List existing webhooks
  const listRes = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}`);
  const webhooks = await listRes.json();
  
  // Find existing webhook for our URL
  const existing = webhooks.find(w => w.webhookURL === WEBHOOK_URL);
  
  if (existing) {
    console.log(`✅ Webhook already exists: ${existing.webhookID}`);
    console.log(`   URL: ${existing.webhookURL}`);
    console.log(`   Addresses: ${existing.accountAddresses?.length || 0}`);
    return;
  }
  
  console.log(`📝 No existing webhook found for ${WEBHOOK_URL}`);
  console.log('🚀 Creating new webhook...');
  
  // Get server addresses from the database (or use defaults)
  // For now, let's use the known facilitator addresses
  const addresses = [
    // PayAI facilitator
    '2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4',
    'CjNFTjvBhbJJd2B5ePPMHRLx1ELZpa8dwQgGL727eKww',
    // x402.jobs facilitator  
    'DevFFyNWxZPtYLpEjzUnN1PFc9Po6PH7eZCi9f3tTkTw',
    // Dexter facilitator
    '6Yw8BnPU6sadbsZtB6LykxTVfhj8qmEVL2cyjdh5ChKh',
    // Add more known addresses here...
  ];
  
  const createRes = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountAddresses: addresses,
      webhookURL: WEBHOOK_URL,
      transactionTypes: ['TRANSFER'],
      webhookType: 'enhanced',
    }),
  });
  
  const result = await createRes.json();
  
  if (result.webhookID) {
    console.log(`✅ Webhook created: ${result.webhookID}`);
    console.log(`   URL: ${result.webhookURL}`);
    console.log(`   Addresses: ${addresses.length}`);
    console.log('\n⚠️  Remember to set the Authentication Header in Helius dashboard:');
    console.log(`   Bearer YOUR_HELIUS_WEBHOOK_SECRET`);
  } else {
    console.error('❌ Failed to create webhook:', result);
  }
}

main().catch(console.error);

