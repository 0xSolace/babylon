#!/usr/bin/env bun
/**
 * Download NFT Images from GitHub using GitHub CLI
 *
 * Downloads all 100 NFT images from the GitHub repository to the public folder.
 * Uses GitHub CLI for authentication to avoid rate limits.
 *
 * Usage: bun run scripts/download-nft-images.ts
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const GITHUB_REPO = 'BabylonSocial/ProductManagementDocumentation';
const GITHUB_FOLDER = 'NFT Protomonkeys/images';
const OUTPUT_DIR = path.join(import.meta.dir, '../apps/web/public/nft/images');
const COLLECTION_SIZE = 100;

async function downloadImage(
  tokenId: number
): Promise<{ success: boolean; error?: string }> {
  const fileName = `${tokenId}.png`;
  const outputPath = path.join(OUTPUT_DIR, fileName);

  // Skip if already exists
  if (existsSync(outputPath)) {
    return { success: true };
  }

  const filePath = `${GITHUB_FOLDER}/${fileName}`;

  // Use gh api to get the file content (base64 encoded)
  const command = `gh api repos/${GITHUB_REPO}/contents/${encodeURIComponent(filePath)} --jq '.content' | base64 -d`;

  try {
    const result = execSync(command, {
      encoding: 'buffer',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large images
    });

    await writeFile(outputPath, result);
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    // Check for rate limit in error message
    if (errorMessage.includes('rate limit') || errorMessage.includes('403')) {
      return { success: false, error: 'Rate limited' };
    }
    return { success: false, error: errorMessage.slice(0, 100) };
  }
}

async function main() {
  console.log('NFT Image Downloader (using GitHub CLI)');
  console.log('========================================\n');

  // Check if gh is available and authenticated
  try {
    execSync('gh auth status', { stdio: 'pipe' });
  } catch {
    console.error(
      'Error: GitHub CLI not authenticated. Run: gh auth login'
    );
    process.exit(1);
  }

  // Create output directory
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const errors: { tokenId: number; error: string }[] = [];

  for (let tokenId = 1; tokenId <= COLLECTION_SIZE; tokenId++) {
    const outputPath = path.join(OUTPUT_DIR, `${tokenId}.png`);

    if (existsSync(outputPath)) {
      skipCount++;
      process.stdout.write(`\r[${tokenId}/${COLLECTION_SIZE}] Skipped (exists)`);
      continue;
    }

    process.stdout.write(
      `\r[${tokenId}/${COLLECTION_SIZE}] Downloading...     `
    );

    const result = await downloadImage(tokenId);

    if (result.success) {
      successCount++;
      process.stdout.write(`\r[${tokenId}/${COLLECTION_SIZE}] ✓ Downloaded     `);
    } else {
      failCount++;
      errors.push({ tokenId, error: result.error || 'Unknown error' });
      process.stdout.write(
        `\r[${tokenId}/${COLLECTION_SIZE}] ✗ Failed: ${result.error?.slice(0, 30)}`
      );

      // If rate limited, wait and retry
      if (result.error === 'Rate limited') {
        console.log('\nRate limited, waiting 60s...');
        await new Promise((r) => setTimeout(r, 60000));
        tokenId--; // Retry this one
        failCount--; // Don't count as failed yet
        errors.pop();
      }
    }

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log('\n\n--- Summary ---');
  console.log(`Downloaded: ${successCount}`);
  console.log(`Skipped:    ${skipCount}`);
  console.log(`Failed:     ${failCount}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const { tokenId, error } of errors) {
      console.log(`  #${tokenId}: ${error}`);
    }
  }

  console.log('\nDone!');
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
