#!/usr/bin/env bun
/**
 * Pre-Development Setup (Decentralized Mode)
 *
 * Sets up complete development environment using Jeju decentralized services:
 * - CQL (CovenantSQL) database
 * - Jeju Cache service
 * - IPFS storage via Jeju
 * - OAuth3 authentication
 *
 * This script is called by `jeju dev` when running Babylon as a vendor app.
 * It can also be run standalone if Jeju services are already running.
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

const COLORS = {
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  CYAN: '\x1b[36m',
  DIM: '\x1b[2m',
};

// Jeju service defaults
const JEJU_DEFAULTS = {
  CQL_BLOCK_PRODUCER_ENDPOINT: 'http://localhost:4300',
  JEJU_CACHE_SERVICE_URL: 'http://localhost:4015',
  JEJU_STORAGE_SERVICE_URL: 'http://localhost:5004',
  JEJU_OAUTH3_SERVICE_URL: 'http://localhost:5011',
  JEJU_KMS_ENDPOINT: 'http://localhost:5012',
  CQL_DATABASE_ID: 'babylon-dev',
  JEJU_NETWORK: 'localnet',
};

interface ServiceStatus {
  name: string;
  url: string;
  healthy: boolean;
  required: boolean;
}

async function checkService(
  name: string,
  url: string,
  healthPath: string,
  required: boolean
): Promise<ServiceStatus> {
  try {
    const response = await fetch(`${url}${healthPath}`, {
      signal: AbortSignal.timeout(5000),
    });
    return { name, url, healthy: response.ok, required };
  } catch {
    return { name, url, healthy: false, required };
  }
}

async function waitForJejuServices(maxWaitMs = 60000): Promise<boolean> {
  console.log(`${COLORS.CYAN}Waiting for Jeju services...${COLORS.RESET}`);

  const startTime = Date.now();
  const requiredServices = [
    {
      name: 'CQL Database',
      url: JEJU_DEFAULTS.CQL_BLOCK_PRODUCER_ENDPOINT,
      path: '/health',
    },
    {
      name: 'Cache',
      url: JEJU_DEFAULTS.JEJU_CACHE_SERVICE_URL,
      path: '/health',
    },
  ];

  while (Date.now() - startTime < maxWaitMs) {
    const statuses = await Promise.all(
      requiredServices.map((s) => checkService(s.name, s.url, s.path, true))
    );

    const allHealthy = statuses.every((s) => s.healthy);
    if (allHealthy) {
      console.log(
        `${COLORS.GREEN}✓ All required Jeju services are ready${COLORS.RESET}`
      );
      return true;
    }

    // Show progress
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const unhealthy = statuses.filter((s) => !s.healthy).map((s) => s.name);
    process.stdout.write(
      `\r${COLORS.DIM}[${elapsed}s] Waiting for: ${unhealthy.join(', ')}...${COLORS.RESET}`
    );

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('');
  return false;
}

function updateEnvForJeju(): void {
  const envPath = join(process.cwd(), '.env');
  let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

  const updates: Record<string, string> = {};

  // Set Jeju service URLs if not already set
  for (const [key, value] of Object.entries(JEJU_DEFAULTS)) {
    if (!process.env[key] && !envContent.includes(`${key}=`)) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length > 0) {
    const newLines = Object.entries(updates)
      .map(([k, v]) => `${k}="${v}"`)
      .join('\n');

    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n';
    }
    envContent += `\n# Jeju Decentralized Services (auto-configured)\n${newLines}\n`;
    writeFileSync(envPath, envContent);

    console.log(
      `${COLORS.GREEN}✓ Updated .env with Jeju service defaults${COLORS.RESET}`
    );

    // Set in current process
    for (const [k, v] of Object.entries(updates)) {
      process.env[k] = v;
    }
  }
}

async function initializeCQLSchema(): Promise<void> {
  console.log(
    `${COLORS.CYAN}Initializing CQL database schema...${COLORS.RESET}`
  );

  const endpoint =
    process.env.CQL_BLOCK_PRODUCER_ENDPOINT ||
    JEJU_DEFAULTS.CQL_BLOCK_PRODUCER_ENDPOINT;
  const databaseId =
    process.env.CQL_DATABASE_ID || JEJU_DEFAULTS.CQL_DATABASE_ID;

  try {
    // Import schema generator
    const { generateAllDDL } = await import(
      '../../packages/db/src/decentralized/cql-schema'
    );
    const ddlStatements = generateAllDDL();

    let created = 0;
    let skipped = 0;

    for (const ddl of ddlStatements) {
      const response = await fetch(`${endpoint}/api/v1/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database: databaseId,
          type: 'exec',
          sql: ddl,
          params: [],
          timestamp: Date.now(),
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        created++;
      } else {
        const text = await response.text();
        if (text.includes('already exists')) {
          skipped++;
        }
      }
    }

    console.log(
      `${COLORS.GREEN}✓ CQL schema ready (${created} created, ${skipped} already exist)${COLORS.RESET}`
    );
  } catch (err) {
    console.log(
      `${COLORS.YELLOW}⚠ Schema initialization skipped: ${(err as Error).message}${COLORS.RESET}`
    );
  }
}

async function seedDatabaseIfEmpty(): Promise<void> {
  const endpoint =
    process.env.CQL_BLOCK_PRODUCER_ENDPOINT ||
    JEJU_DEFAULTS.CQL_BLOCK_PRODUCER_ENDPOINT;
  const databaseId =
    process.env.CQL_DATABASE_ID || JEJU_DEFAULTS.CQL_DATABASE_ID;

  try {
    // Check if actors exist
    const response = await fetch(`${endpoint}/api/v1/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database: databaseId,
        type: 'query',
        sql: 'SELECT COUNT(*) as count FROM "Actor"',
        params: [],
        timestamp: Date.now(),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error('Query failed');
    }

    const result = await response.json();
    const count = result.rows?.[0]?.count ?? 0;

    if (count === 0) {
      console.log(`${COLORS.CYAN}Seeding database...${COLORS.RESET}`);
      const { $ } = await import('bun');
      await $`bun run db:seed`;
      console.log(`${COLORS.GREEN}✓ Database seeded${COLORS.RESET}`);
    } else {
      console.log(
        `${COLORS.GREEN}✓ Database has ${count} actors${COLORS.RESET}`
      );
    }
  } catch (err) {
    console.log(
      `${COLORS.YELLOW}⚠ Seed check skipped: ${(err as Error).message}${COLORS.RESET}`
    );
  }
}

async function cleanupNextLock(): Promise<void> {
  const nextLockPath = join(
    process.cwd(),
    'apps',
    'web',
    '.next',
    'dev',
    'lock'
  );
  try {
    if (existsSync(nextLockPath)) {
      unlinkSync(nextLockPath);
      console.log(`${COLORS.DIM}Cleaned up Next.js lock file${COLORS.RESET}`);
    }
  } catch {
    // Ignore
  }
}

async function main(): Promise<void> {
  console.log(
    `\n${COLORS.CYAN}=== Babylon Decentralized Dev Setup ===${COLORS.RESET}\n`
  );

  // Check if running under Jeju dev
  const isJejuDev = !!process.env.JEJU_RPC_URL || !!process.env.L2_RPC_URL;

  if (isJejuDev) {
    console.log(
      `${COLORS.GREEN}Running under Jeju dev environment${COLORS.RESET}`
    );
  } else {
    console.log(
      `${COLORS.YELLOW}Standalone mode - ensure Jeju services are running${COLORS.RESET}`
    );
    console.log(
      `${COLORS.DIM}Start with: cd /path/to/jeju && bun run dev${COLORS.RESET}\n`
    );
  }

  // Update .env with Jeju defaults
  updateEnvForJeju();

  // Clean up stale locks
  await cleanupNextLock();

  // Wait for Jeju services
  const servicesReady = await waitForJejuServices();

  if (!servicesReady) {
    console.log(
      `\n${COLORS.RED}✗ Required Jeju services not available${COLORS.RESET}`
    );
    console.log(
      `${COLORS.DIM}Please start Jeju: cd /path/to/jeju && bun run dev${COLORS.RESET}`
    );
    process.exit(1);
  }

  // Check all services (including optional)
  console.log(`\n${COLORS.CYAN}Service Status:${COLORS.RESET}`);

  const services = await Promise.all([
    checkService(
      'CQL Database',
      JEJU_DEFAULTS.CQL_BLOCK_PRODUCER_ENDPOINT,
      '/health',
      true
    ),
    checkService(
      'Cache',
      JEJU_DEFAULTS.JEJU_CACHE_SERVICE_URL,
      '/health',
      true
    ),
    checkService(
      'Storage (IPFS)',
      JEJU_DEFAULTS.JEJU_STORAGE_SERVICE_URL,
      '/api/v0/id',
      false
    ),
    checkService(
      'OAuth3',
      JEJU_DEFAULTS.JEJU_OAUTH3_SERVICE_URL,
      '/health',
      false
    ),
    checkService('KMS', JEJU_DEFAULTS.JEJU_KMS_ENDPOINT, '/health', false),
  ]);

  for (const service of services) {
    const icon = service.healthy ? '✓' : service.required ? '✗' : '○';
    const color = service.healthy
      ? COLORS.GREEN
      : service.required
        ? COLORS.RED
        : COLORS.YELLOW;
    console.log(
      `  ${color}${icon} ${service.name}${COLORS.RESET} ${COLORS.DIM}${service.url}${COLORS.RESET}`
    );
  }

  console.log('');

  // Initialize CQL schema
  await initializeCQLSchema();

  // Seed if empty
  await seedDatabaseIfEmpty();

  console.log('');
  console.log(`${COLORS.GREEN}=== Babylon Ready ===${COLORS.RESET}`);
  console.log('');
  console.log('Services:');
  console.log(`  CQL:     ${JEJU_DEFAULTS.CQL_BLOCK_PRODUCER_ENDPOINT}`);
  console.log(`  Cache:   ${JEJU_DEFAULTS.JEJU_CACHE_SERVICE_URL}`);
  console.log(`  Storage: ${JEJU_DEFAULTS.JEJU_STORAGE_SERVICE_URL}`);
  console.log('');
  console.log('App:');
  console.log('  Web:     http://localhost:5007');
  console.log('');
}

main().catch((err) => {
  console.error(`${COLORS.RED}Error: ${err.message}${COLORS.RESET}`);
  process.exit(1);
});
