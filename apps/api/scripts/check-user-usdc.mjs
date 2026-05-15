#!/usr/bin/env node

/**
 * Check a user's USDC balance on Solana
 * Usage: node check-user-usdc.mjs <user_email>
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const connection = new Connection(solanaRpcUrl, 'confirmed');

// USDC mint on Solana mainnet
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDC_DECIMALS = 6;

async function main() {
  const email = process.argv[2] || 'krebit.token@gmail.com';
  
  console.log(`🔍 Checking user: ${email}\n`);

  // 1. Look up user by email
  console.log('1. Looking up user in auth.users...');
  const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('Error listing users:', authError);
    process.exit(1);
  }

  const user = authUser.users.find(u => u.email === email);
  if (!user) {
    console.error(`User not found with email: ${email}`);
    console.log('\nAvailable users (first 10):');
    authUser.users.slice(0, 10).forEach(u => {
      console.log(`  - ${u.email} (${u.id})`);
    });
    process.exit(1);
  }

  console.log(`   Found user: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Created: ${user.created_at}`);

  // 2. Get user's wallet
  console.log('\n2. Looking up wallet...');
  const { data: wallet, error: walletError } = await supabase
    .from('x402_user_wallets')
    .select('address, base_address, balance_usdc, total_spent_usdc, total_jobs_run, created_at')
    .eq('user_id', user.id)
    .single();

  if (walletError || !wallet) {
    console.error('No wallet found:', walletError?.message || 'No wallet record');
    process.exit(1);
  }

  console.log(`   Solana address: ${wallet.address}`);
  console.log(`   Base address: ${wallet.base_address || 'Not set'}`);
  console.log(`   Cached balance: $${wallet.balance_usdc || 0}`);
  console.log(`   Total spent: $${wallet.total_spent_usdc || 0}`);
  console.log(`   Total jobs: ${wallet.total_jobs_run || 0}`);
  console.log(`   Created: ${wallet.created_at}`);

  // 3. Check actual on-chain SOL balance
  console.log('\n3. Checking on-chain SOL balance...');
  try {
    const pubkey = new PublicKey(wallet.address);
    const balance = await connection.getBalance(pubkey);
    console.log(`   SOL balance: ${balance / 1e9} SOL`);
  } catch (err) {
    console.error('   Error checking SOL balance:', err.message);
  }

  // 4. Check USDC token account
  console.log('\n4. Checking USDC token account...');
  try {
    const pubkey = new PublicKey(wallet.address);
    const ataAddress = await getAssociatedTokenAddress(USDC_MINT, pubkey);
    console.log(`   Expected USDC ATA: ${ataAddress.toString()}`);

    // Check if the ATA exists
    const ataInfo = await connection.getAccountInfo(ataAddress);
    if (!ataInfo) {
      console.log(`   ❌ USDC token account does NOT exist!`);
      console.log(`   This is the root cause - user needs to create a USDC token account.`);
      console.log(`\n   💡 Solution: User needs to deposit USDC to this wallet.`);
      console.log(`   When USDC is sent to ${wallet.address}, the ATA will be created automatically.`);
    } else {
      console.log(`   ✅ USDC token account exists`);
      console.log(`   Account owner: ${ataInfo.owner.toString()}`);
      console.log(`   Account lamports: ${ataInfo.lamports}`);
      
      // Get the actual USDC balance
      const tokenBalance = await connection.getTokenAccountBalance(ataAddress);
      const usdcAmount = parseFloat(tokenBalance.value.amount) / Math.pow(10, USDC_DECIMALS);
      console.log(`   USDC balance: $${usdcAmount.toFixed(2)}`);
    }
  } catch (err) {
    console.error('   Error checking USDC account:', err.message);
  }

  // 5. Check all token accounts for this wallet
  console.log('\n5. Checking all SPL token accounts...');
  try {
    const pubkey = new PublicKey(wallet.address);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    });
    
    if (tokenAccounts.value.length === 0) {
      console.log('   No token accounts found for this wallet');
    } else {
      console.log(`   Found ${tokenAccounts.value.length} token account(s):`);
      for (const account of tokenAccounts.value) {
        const info = account.account.data.parsed.info;
        const mint = info.mint;
        const balance = info.tokenAmount.uiAmount;
        const decimals = info.tokenAmount.decimals;
        
        let label = mint;
        if (mint === USDC_MINT.toString()) {
          label = 'USDC';
        }
        
        console.log(`   - ${label}: ${balance} (${decimals} decimals)`);
      }
    }
  } catch (err) {
    console.error('   Error listing token accounts:', err.message);
  }

  // 6. Check Base USDC balance (if base address exists)
  if (wallet.base_address) {
    console.log('\n6. Checking Base USDC balance...');
    try {
      const baseRpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
      const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      
      // Minimal ERC20 ABI for balanceOf
      const response = await fetch(baseRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [
            {
              to: BASE_USDC_ADDRESS,
              data: '0x70a08231000000000000000000000000' + wallet.base_address.slice(2).toLowerCase()
            },
            'latest'
          ]
        })
      });
      
      const result = await response.json();
      if (result.result) {
        const balanceWei = BigInt(result.result);
        const balanceUsdc = Number(balanceWei) / 1e6;
        console.log(`   Base USDC balance: $${balanceUsdc.toFixed(2)}`);
        if (balanceUsdc > 0) {
          console.log(`   ⚠️ User has USDC on Base but platform fee requires Solana USDC!`);
        }
      } else {
        console.log('   Could not fetch Base balance:', result.error?.message || 'Unknown error');
      }
    } catch (err) {
      console.error('   Error checking Base balance:', err.message);
    }
  }

  // 7. Check recent job runs for this user
  console.log('\n7. Checking recent job runs...');
  const { data: runs, error: runsError } = await supabase
    .from('x402_job_runs')
    .select('id, status, error, created_at, completed_at, total_cost')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3);

  if (runsError) {
    console.error('Error fetching runs:', runsError);
  } else if (!runs || runs.length === 0) {
    console.log('   No job runs found');
  } else {
    console.log(`   Last ${runs.length} runs:`);
    for (const run of runs) {
      const status = run.status === 'failed' ? `❌ ${run.status}` : `✅ ${run.status}`;
      console.log(`   - ${run.created_at}: ${status} (cost: $${run.total_cost || 0})`);
      if (run.error) {
        console.log(`     Error: ${run.error.substring(0, 100)}`);
      }
    }
  }
}

main().catch(console.error);

