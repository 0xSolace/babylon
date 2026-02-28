#!/usr/bin/env bun
/**
 * Development wrapper that starts Next.js (and Hardhat for localnet).
 *
 * Cron scheduling is handled by Kronos, which runs via docker-compose.
 * Start it separately with: docker compose up kronos -d
 */

// @ts-ignore - bun global is available in bun runtime
import { $ } from 'bun';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { detectEnvironment } from '../packages/contracts/src/deployment/env-detection';

// Load .env file to detect environment
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

const detectedEnv = detectEnvironment();
const isLocalnet = detectedEnv === 'localnet';

if (isLocalnet) {
  await $`concurrently --kill-others-on-fail -n "hardhat,deploy,next" -c "yellow,blue,cyan" "cd packages/contracts && bunx hardhat node --hostname 0.0.0.0" "bun run scripts/wait-for-hardhat-and-deploy.ts" "cd apps/web && bun run dev"`.nothrow();
} else {
  await $`cd apps/web && bun run dev`.nothrow();
}
