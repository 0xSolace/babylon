#!/usr/bin/env bun
/**
 * Development wrapper for fully decentralized mode.
 *
 * Assumptions:
 * - Jeju services are running (started by pre-dev-decentralized.ts or jeju dev)
 * - No local Hardhat/Postgres/Redis fallbacks
 */

// @ts-ignore - bun global is available in bun runtime
import { $ } from 'bun';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Load .env file to hydrate process env (fail fast if missing required vars)
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0 && !process.env[key]) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  }
}

const requiredEnv = [
  'JEJU_NETWORK',
  'CQL_BLOCK_PRODUCER_ENDPOINT',
  'CQL_DATABASE_ID',
  'JEJU_CACHE_SERVICE_URL',
  'JEJU_STORAGE_SERVICE_URL',
  'JEJU_OAUTH3_SERVICE_URL',
  'JEJU_KMS_SERVICE_URL',
  'JEJU_RPC_URL',
];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required Jeju environment: ${missing.join(', ')}. Start Jeju and rerun pre-dev.`
  );
}

// Start web + cron only. Chains/contracts are expected to be provided by Jeju.
await $`concurrently --kill-others-on-fail --kill-others -n "next,cron" -c "cyan,magenta" "bunx turbo dev" "bun run scripts/local-cron-simulator.ts"`.nothrow();
