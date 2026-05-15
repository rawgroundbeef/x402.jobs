#!/usr/bin/env node

/**
 * Upload sponsor logos to Supabase storage
 * Usage: node upload-sponsor-logos.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = 'generated-images';

async function uploadFromUrl(url, fileName) {
  console.log(`📥 Downloading from: ${url}`);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'x402-jobs/1.0' }
  });

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';

  const filePath = `sponsor-logos/${fileName}`;

  console.log(`📤 Uploading to: ${filePath}`);

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType,
      upsert: true
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

async function uploadFromFile(localPath, fileName) {
  console.log(`📂 Reading file: ${localPath}`);

  const buffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  const filePath = `sponsor-logos/${fileName}`;

  console.log(`📤 Uploading to: ${filePath}`);

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType,
      upsert: true
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

async function main() {
  console.log('🚀 Uploading sponsor logos for Hackathon #2\n');

  // Sponsor 1: Wurk.fun
  const wurkUrl = await uploadFromUrl(
    'https://wurk.fun/assets/twlogo.jpg?v=3',
    'wurk-fun.jpg'
  );
  console.log(`✅ Wurk.fun logo: ${wurkUrl}\n`);

  // Sponsor 2: Daydreams/Boat
  const daydreamsLocalPath = process.argv[2] || '/Users/rawgroundbeef/Downloads/Q_j6HuZm_400x400 (1).jpg';

  if (!fs.existsSync(daydreamsLocalPath)) {
    console.error(`❌ Daydreams logo not found at: ${daydreamsLocalPath}`);
    console.log('Please provide the path as an argument: node upload-sponsor-logos.mjs /path/to/image.jpg');
    process.exit(1);
  }

  const daydreamsUrl = await uploadFromFile(daydreamsLocalPath, 'daydreams.jpg');
  console.log(`✅ Daydreams logo: ${daydreamsUrl}\n`);

  console.log('='.repeat(60));
  console.log('📋 Use these URLs in the migration:');
  console.log(`   Wurk.fun:   ${wurkUrl}`);
  console.log(`   Daydreams:  ${daydreamsUrl}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
