#!/usr/bin/env bun
/**
 * Deploy Static Assets to IPFS
 *
 * This script uploads the built Next.js static assets to IPFS via Jeju Storage.
 * It should be run after `bun run build` to deploy static assets to decentralized storage.
 *
 * Usage:
 *   bun run scripts/deploy-static-to-ipfs.ts
 *   bun run build:deploy  # runs build + this script
 *
 * Environment:
 *   JEJU_STORAGE_SERVICE_URL: IPFS/Arweave gateway URL (default: http://localhost:5004)
 *   IPFS_PIN: Set to 'true' to pin content (default: true for production)
 */

import { readdir, stat } from 'fs/promises';
import { join, relative } from 'path';

const COLORS = {
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  CYAN: '\x1b[36m',
  DIM: '\x1b[2m',
};

const STORAGE_URL =
  process.env.JEJU_STORAGE_SERVICE_URL || 'http://localhost:5004';
const SHOULD_PIN = process.env.IPFS_PIN !== 'false';

async function checkStorageHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${STORAGE_URL}/api/v0/id`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function uploadDirectory(dirPath: string): Promise<string> {
  // Use IPFS directory upload
  const formData = new FormData();

  async function addFiles(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);
      const relativePath = relative(dirPath, fullPath);

      if (entry.isDirectory()) {
        await addFiles(fullPath);
      } else {
        const file = Bun.file(fullPath);
        const content = await file.arrayBuffer();
        formData.append('file', new Blob([content]), relativePath);
      }
    }
  }

  await addFiles(dirPath);

  const response = await fetch(
    `${STORAGE_URL}/api/v0/add?wrap-with-directory=true&pin=${SHOULD_PIN}`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Directory upload failed: ${response.status}`);
  }

  // Parse NDJSON response - last line is the directory CID
  const text = await response.text();
  const lines = text.trim().split('\n');
  const lastLine = JSON.parse(lines[lines.length - 1]);

  return lastLine.Hash || lastLine.cid;
}

async function getDirectoryStats(
  dirPath: string
): Promise<{ files: number; size: number }> {
  let files = 0;
  let size = 0;

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        files++;
        const stats = await stat(fullPath);
        size += stats.size;
      }
    }
  }

  await walk(dirPath);
  return { files, size };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main(): Promise<void> {
  console.log(
    `\n${COLORS.CYAN}=== Deploy Static Assets to IPFS ===${COLORS.RESET}\n`
  );

  // Check storage is available
  console.log(`${COLORS.DIM}Storage: ${STORAGE_URL}${COLORS.RESET}`);

  if (!(await checkStorageHealth())) {
    console.log(`${COLORS.RED}✗ IPFS storage not available${COLORS.RESET}`);
    console.log(
      `${COLORS.DIM}Start Jeju: cd /path/to/jeju && bun run dev${COLORS.RESET}`
    );
    process.exit(1);
  }

  console.log(`${COLORS.GREEN}✓ Storage connected${COLORS.RESET}\n`);

  // Check for build output
  const staticDir = join(process.cwd(), 'apps', 'web', '.next', 'static');
  const publicDir = join(process.cwd(), 'apps', 'web', 'public');

  const staticExists = await stat(staticDir).catch(() => null);
  if (!staticExists) {
    console.log(
      `${COLORS.YELLOW}No build output found. Run 'bun run build' first.${COLORS.RESET}`
    );
    process.exit(1);
  }

  // Upload static directory
  console.log(`${COLORS.CYAN}Uploading .next/static...${COLORS.RESET}`);
  const staticStats = await getDirectoryStats(staticDir);
  console.log(
    `${COLORS.DIM}  ${staticStats.files} files, ${formatSize(staticStats.size)}${COLORS.RESET}`
  );

  const staticCid = await uploadDirectory(staticDir);
  console.log(
    `${COLORS.GREEN}✓ Static assets: ipfs://${staticCid}${COLORS.RESET}`
  );

  // Upload public directory if it exists
  const publicExists = await stat(publicDir).catch(() => null);
  let publicCid: string | null = null;

  if (publicExists) {
    console.log(`\n${COLORS.CYAN}Uploading public/...${COLORS.RESET}`);
    const publicStats = await getDirectoryStats(publicDir);
    console.log(
      `${COLORS.DIM}  ${publicStats.files} files, ${formatSize(publicStats.size)}${COLORS.RESET}`
    );

    publicCid = await uploadDirectory(publicDir);
    console.log(
      `${COLORS.GREEN}✓ Public assets: ipfs://${publicCid}${COLORS.RESET}`
    );
  }

  // Output summary
  console.log(`\n${COLORS.GREEN}=== Deployment Complete ===${COLORS.RESET}\n`);
  console.log('CIDs:');
  console.log(`  Static:  ${staticCid}`);
  if (publicCid) {
    console.log(`  Public:  ${publicCid}`);
  }
  console.log('');
  console.log('Gateway URLs:');
  console.log(`  Static:  ${STORAGE_URL}/ipfs/${staticCid}`);
  if (publicCid) {
    console.log(`  Public:  ${STORAGE_URL}/ipfs/${publicCid}`);
  }
  console.log('');

  // Save deployment info
  const deploymentInfo = {
    timestamp: new Date().toISOString(),
    static: {
      cid: staticCid,
      files: staticStats.files,
      size: staticStats.size,
    },
    public: publicCid
      ? {
          cid: publicCid,
          files: (await getDirectoryStats(publicDir)).files,
          size: (await getDirectoryStats(publicDir)).size,
        }
      : null,
    gatewayUrl: STORAGE_URL,
    pinned: SHOULD_PIN,
  };

  const infoPath = join(
    process.cwd(),
    'apps',
    'web',
    '.next',
    'ipfs-deployment.json'
  );
  await Bun.write(infoPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(
    `${COLORS.DIM}Saved deployment info to ${infoPath}${COLORS.RESET}`
  );
}

main().catch((err) => {
  console.error(`${COLORS.RED}Error: ${err.message}${COLORS.RESET}`);
  process.exit(1);
});
