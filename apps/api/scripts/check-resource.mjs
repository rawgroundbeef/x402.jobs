#!/usr/bin/env node

/**
 * Check if a resource exists in the database and its network value
 * Usage: node check-resource.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Checking for x402-airdrop-distributor resource...\n');

  // 1. Check by resource_url
  console.log('1. Searching by resource_url containing "airdrop-distributor"...');
  const { data: byUrl, error: urlError } = await supabase
    .from('x402_resources')
    .select('id, slug, name, resource_url, network, is_active, server_id, created_at')
    .ilike('resource_url', '%airdrop-distributor%');

  if (urlError) {
    console.error('Error:', urlError);
  } else {
    console.log('Found:', byUrl?.length || 0, 'resources');
    if (byUrl?.length) {
      byUrl.forEach(r => {
        console.log(`  - ID: ${r.id}`);
        console.log(`    Name: ${r.name}`);
        console.log(`    Slug: ${r.slug}`);
        console.log(`    URL: ${r.resource_url}`);
        console.log(`    Network: "${r.network}" (type: ${typeof r.network})`);
        console.log(`    Active: ${r.is_active}`);
        console.log(`    Server ID: ${r.server_id}`);
        console.log(`    Created: ${r.created_at}`);
        console.log('');
      });
    }
  }

  // 2. Check by server slug
  console.log('\n2. Checking server by slug...');
  const { data: server, error: serverError } = await supabase
    .from('x402_servers')
    .select('id, slug, name, origin_url')
    .eq('slug', 'x402-airdrop-distributor-onrender-com')
    .single();

  if (serverError) {
    console.error('Server not found or error:', serverError.message);
  } else {
    console.log('Found server:', server);
  }

  // 3. Check all Base network resources
  console.log('\n3. Counting all Base network resources...');
  const { data: baseResources, error: baseError, count } = await supabase
    .from('x402_resources')
    .select('id, name, network', { count: 'exact' })
    .eq('network', 'base')
    .eq('is_active', true);

  if (baseError) {
    console.error('Error:', baseError);
  } else {
    console.log(`Total active Base resources: ${count}`);
  }

  // 4. Check for any case variations of the network field
  console.log('\n4. Checking for network case variations...');
  const { data: allNetworks, error: netError } = await supabase
    .from('x402_resources')
    .select('network')
    .eq('is_active', true);

  if (!netError && allNetworks) {
    const networkCounts = {};
    allNetworks.forEach(r => {
      const net = r.network || 'NULL';
      networkCounts[net] = (networkCounts[net] || 0) + 1;
    });
    console.log('Network value distribution:');
    Object.entries(networkCounts).sort((a, b) => b[1] - a[1]).forEach(([net, count]) => {
      console.log(`  "${net}": ${count} resources`);
    });
  }

  // 5. Check if display_path was populated
  console.log('\n5. Checking display_path for our resource...');
  const { data: resourceWithPath, error: pathError } = await supabase
    .from('x402_resources')
    .select('id, slug, name, display_path, resource_url')
    .ilike('resource_url', '%airdrop-distributor%')
    .single();

  if (pathError) {
    console.error('Error:', pathError);
  } else {
    console.log('Resource display_path:', resourceWithPath?.display_path);
    console.log('Full resource:', resourceWithPath);
  }

  // 6. Test search using display_path (the exact format users type)
  const searchTerm = 'x402-airdrop-distributor-onrender-com/tes';
  console.log(`\n6. Testing search for "${searchTerm}" using display_path...`);
  const { data: searchResults, error: searchError } = await supabase
    .from('x402_resources')
    .select('id, slug, name, display_path, network')
    .eq('network', 'base')
    .eq('is_active', true)
    .or(`display_path.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,slug.ilike.%${searchTerm}%`);

  if (searchError) {
    console.error('Search error:', searchError);
  } else {
    console.log(`Found ${searchResults?.length || 0} resources:`);
    searchResults?.forEach(r => {
      console.log(`  - ${r.display_path}: ${r.name}`);
    });
  }

  // 7. Test partial search "airdrop"
  console.log('\n7. Testing search for "airdrop"...');
  const { data: partialResults, error: partialError } = await supabase
    .from('x402_resources')
    .select('id, slug, name, display_path, network')
    .eq('network', 'base')
    .eq('is_active', true)
    .ilike('display_path', '%airdrop%');

  if (partialError) {
    console.error('Search error:', partialError);
  } else {
    console.log(`Found ${partialResults?.length || 0} resources:`);
    partialResults?.forEach(r => {
      console.log(`  - ${r.display_path}: ${r.name}`);
    });
  }
}

main().catch(console.error);

