#!/usr/bin/env bun

/**
 * Initialize Decentralized Services
 *
 * Sets up connection to Jeju services for decentralized operation:
 * - CQL (CovenantSQL) database
 * - Cache service
 * - Storage service (IPFS)
 * - KMS service
 * - OAuth3 service
 * - Compute triggers
 *
 * Run manually: bun run scripts/init-decentralized-services.ts
 * Or via pre-dev: bun run dev (automatically called)
 */

import { logger } from '@babylon/shared';
import { $ } from 'bun';

// Configuration
const JEJU_GATEWAY_URL =
  process.env.JEJU_GATEWAY_URL ?? 'http://localhost:4300';
const JEJU_RPC_URL = process.env.JEJU_RPC_URL ?? 'http://localhost:9545';

interface ServiceStatus {
  name: string;
  url: string;
  healthy: boolean;
  error?: string;
}

async function checkService(name: string, url: string): Promise<ServiceStatus> {
  const healthUrl = url.endsWith('/health') ? url : `${url}/health`;

  const response = await fetch(healthUrl, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!response?.ok) {
    return { name, url, healthy: false, error: 'Not reachable' };
  }

  return { name, url, healthy: true };
}

async function checkJejuGateway(): Promise<boolean> {
  const status = await checkService('Jeju Gateway', JEJU_GATEWAY_URL);
  return status.healthy;
}

async function initializeCQL(): Promise<void> {
  logger.info('[Init] Initializing CQL database...');

  const endpoint =
    process.env.CQL_BLOCK_PRODUCER_ENDPOINT ?? `${JEJU_GATEWAY_URL}`;
  const databaseId = process.env.CQL_DATABASE_ID ?? 'babylon';

  // Test connection
  const response = await fetch(`${endpoint}/v1/health`, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!response?.ok) {
    logger.warn('[Init] CQL not available, will use PostgreSQL fallback');
    return;
  }

  // Set environment variables for the app
  process.env.CQL_BLOCK_PRODUCER_ENDPOINT = endpoint;
  process.env.CQL_DATABASE_ID = databaseId;

  logger.info('[Init] CQL database connected', { endpoint, databaseId });
}

async function initializeCache(): Promise<void> {
  logger.info('[Init] Initializing cache service...');

  const cacheUrl =
    process.env.JEJU_CACHE_SERVICE_URL ?? `${JEJU_GATEWAY_URL}/v1/cache`;

  const response = await fetch(`${cacheUrl}/health`, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!response?.ok) {
    logger.warn('[Init] Cache service not available, will use Redis fallback');
    return;
  }

  process.env.JEJU_CACHE_SERVICE_URL = cacheUrl;
  logger.info('[Init] Cache service connected', { url: cacheUrl });
}

async function initializeStorage(): Promise<void> {
  logger.info('[Init] Initializing storage service...');

  const storageUrl =
    process.env.JEJU_STORAGE_SERVICE_URL ?? `${JEJU_GATEWAY_URL}/v1/storage`;

  const response = await fetch(`${storageUrl}/health`, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!response?.ok) {
    logger.warn('[Init] Storage service not available');
    return;
  }

  process.env.JEJU_STORAGE_SERVICE_URL = storageUrl;
  logger.info('[Init] Storage service connected', { url: storageUrl });
}

async function initializeKMS(): Promise<void> {
  logger.info('[Init] Initializing KMS service...');

  const kmsUrl =
    process.env.JEJU_KMS_SERVICE_URL ?? `${JEJU_GATEWAY_URL}/v1/kms`;

  const response = await fetch(`${kmsUrl}/health`, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!response?.ok) {
    logger.warn('[Init] KMS service not available');
    return;
  }

  process.env.JEJU_KMS_SERVICE_URL = kmsUrl;
  logger.info('[Init] KMS service connected', { url: kmsUrl });
}

async function initializeComputeTriggers(): Promise<void> {
  logger.info('[Init] Initializing compute triggers...');

  // Set up environment for compute triggers
  process.env.COMPUTE_RPC_URL = JEJU_RPC_URL;
  process.env.JEJU_RPC_URL = JEJU_RPC_URL;

  // Check if devnet is running
  const response = await fetch(JEJU_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_chainId',
      params: [],
      id: 1,
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!response?.ok) {
    logger.warn('[Init] Jeju devnet not available');
    return;
  }

  const data = (await response.json()) as { result: string };
  const chainId = parseInt(data.result, 16);

  process.env.CHAIN_ID = chainId.toString();
  logger.info('[Init] Jeju devnet connected', {
    rpcUrl: JEJU_RPC_URL,
    chainId,
  });

  // Register default triggers if trigger registry is configured
  const triggerRegistryAddress = process.env.TRIGGER_REGISTRY_ADDRESS;
  if (triggerRegistryAddress && triggerRegistryAddress !== '0x0') {
    logger.info('[Init] Registering compute triggers...');
    // Triggers will be registered when the app starts
  }
}

async function registerTriggers(): Promise<void> {
  // Import dynamically to avoid loading before env is set
  const { initializeComputeTriggers } = await import(
    '@babylon/api/services/compute-trigger-service'
  ).catch(() => ({ initializeComputeTriggers: null }));

  if (initializeComputeTriggers) {
    await initializeComputeTriggers();
    logger.info('[Init] Compute triggers registered');
  }
}

async function printStatus(services: ServiceStatus[]): Promise<void> {
  console.log('');
  console.log('═'.repeat(60));
  console.log('JEJU DECENTRALIZED SERVICES STATUS');
  console.log('═'.repeat(60));

  for (const service of services) {
    const icon = service.healthy ? '✅' : '❌';
    const status = service.healthy ? 'Connected' : (service.error ?? 'Failed');
    console.log(`${icon} ${service.name.padEnd(20)} ${status}`);
  }

  console.log('═'.repeat(60));
}

async function main(): Promise<void> {
  console.log('');
  console.log('[Jeju] Initializing decentralized services...');

  // Check if Jeju gateway is available
  const gatewayAvailable = await checkJejuGateway();

  if (!gatewayAvailable) {
    console.log('');
    console.log('⚠️  Jeju services not available');
    console.log('');
    console.log('To start Jeju:');
    console.log('  cd /path/to/jeju && bun run dev');
    console.log('');
    console.log('Running with fallback services (PostgreSQL, Redis)...');
    return;
  }

  // Initialize all services
  const services: ServiceStatus[] = [];

  // CQL
  await initializeCQL();
  services.push(
    await checkService('CQL Database', `${JEJU_GATEWAY_URL}/v1/cql`)
  );

  // Cache
  await initializeCache();
  services.push(await checkService('Cache', `${JEJU_GATEWAY_URL}/v1/cache`));

  // Storage
  await initializeStorage();
  services.push(
    await checkService('Storage (IPFS)', `${JEJU_GATEWAY_URL}/v1/storage`)
  );

  // KMS
  await initializeKMS();
  services.push(await checkService('KMS', `${JEJU_GATEWAY_URL}/v1/kms`));

  // OAuth3
  services.push(await checkService('OAuth3', `${JEJU_GATEWAY_URL}/v1/oauth3`));

  // Devnet
  await initializeComputeTriggers();
  services.push(await checkService('Devnet RPC', JEJU_RPC_URL));

  // Print status
  await printStatus(services);

  // Register compute triggers
  await registerTriggers();

  const healthyCount = services.filter((s) => s.healthy).length;
  console.log(`[Jeju] ${healthyCount}/${services.length} services ready`);

  if (healthyCount === services.length) {
    console.log('[Jeju] ✅ All decentralized services initialized');
  } else {
    console.log('[Jeju] ⚠️  Some services unavailable, using fallbacks');
  }
}

main().catch((err) => {
  console.error('[Jeju] Initialization failed:', err.message);
  process.exit(1);
});
