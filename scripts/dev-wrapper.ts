#!/usr/bin/env bun
/**
 * Development wrapper that conditionally starts the local chain based on environment
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
  // Parse .env file and set environment variables
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
  // Start Anvil, Next.js, and cron for local development.
  await $`concurrently --kill-others-on-fail -n "anvil,next,cron" -c "yellow,cyan,magenta" "bun run anvil" "cd apps/web && bun run dev" "bun run scripts/local-cron-simulator.ts"`.nothrow();
} else {
  // Start Next.js and cron only (no local chain)
  await $`concurrently --kill-others-on-fail -n "next,cron" -c "cyan,magenta" "cd apps/web && bun run dev" "bun run scripts/local-cron-simulator.ts"`.nothrow();
}
