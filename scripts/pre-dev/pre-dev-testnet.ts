#!/usr/bin/env bun
/**
 * Pre-Development Setup for Testnet
 *
 * Validates testnet deployment before starting dev server:
 * - Checks environment variables
 * - Validates contract deployments
 * - Checks Agent0 configuration
 * - Starts local database services
 */

import {
  DeploymentEnv,
  printValidationResult,
  validateEnvironment,
} from '../../packages/contracts/src/deployment/env-detection';
import {
  ValidationResult,
  validateDeployment,
} from '../../packages/contracts/src/deployment/validation';

function printDeploymentResult(
  result: ValidationResult,
  _env: DeploymentEnv
): void {
  if (!result.deployed) {
    console.error('❌ Contracts not deployed to testnet', undefined, 'Script');
    console.info('', undefined, 'Script');
    console.info('Deploy contracts with:', undefined, 'Script');
    console.info('  bun run contracts:deploy:testnet', undefined, 'Script');
    process.exit(1);
  }
}

const BASE_SEPOLIA_RPC_URL =
  process.env.BASE_SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  'https://sepolia.base.org';

console.info(
  'Setting up testnet development environment...',
  undefined,
  'Script'
);
console.info('='.repeat(60), undefined, 'Script');

// Set environment for testnet
process.env.DEPLOYMENT_ENV = 'testnet';
process.env.NEXT_PUBLIC_CHAIN_ID = '84532';

// 1. Validate environment variables
console.info('Validating environment...', undefined, 'Script');
const envValidation = validateEnvironment('testnet');

if (!envValidation.valid) {
  console.error('❌ Environment validation failed', undefined, 'Script');
  envValidation.errors.forEach((error) => {
    console.error(`   ${error}`, undefined, 'Script');
  });
  console.info('', undefined, 'Script');
  console.info('To fix:', undefined, 'Script');
  console.info(
    '  1. Copy .env.testnet.example to .env.testnet',
    undefined,
    'Script'
  );
  console.info('  2. Fill in required values', undefined, 'Script');
  console.info(
    '  3. Deploy contracts: bun run contracts:deploy:testnet',
    undefined,
    'Script'
  );
  process.exit(1);
}

printValidationResult(envValidation);

// 2. Validate contract deployment
console.info('', undefined, 'Script');
console.info('Validating contract deployment...', undefined, 'Script');

const contractValidation = await validateDeployment(
  'testnet',
  BASE_SEPOLIA_RPC_URL
);

if (!contractValidation.deployed) {
  console.error('❌ Contracts not deployed to testnet', undefined, 'Script');
  console.info('', undefined, 'Script');
  console.info('Deploy contracts with:', undefined, 'Script');
  console.info('  bun run contracts:deploy:testnet', undefined, 'Script');
  process.exit(1);
}

if (!contractValidation.valid) {
  console.error('❌ Contract validation failed', undefined, 'Script');
  contractValidation.errors.forEach((error) => {
    console.error(`   ${error}`, undefined, 'Script');
  });
  process.exit(1);
}

printDeploymentResult(contractValidation, 'testnet');

// 3. Verify Jeju services (no centralized fallbacks)
console.info('', undefined, 'Script');
console.info('Checking Jeju services...', undefined, 'Script');

const gateway = process.env.JEJU_GATEWAY_URL ?? 'http://localhost:4300';
const rpcUrl = process.env.JEJU_TESTNET_RPC_URL ?? process.env.JEJU_RPC_URL;
const cql = process.env.CQL_BLOCK_PRODUCER_ENDPOINT;
const cache = process.env.JEJU_CACHE_SERVICE_URL;
const storage = process.env.JEJU_STORAGE_SERVICE_URL;
const oauth3 = process.env.JEJU_OAUTH3_SERVICE_URL;
const kms = process.env.JEJU_KMS_SERVICE_URL;

async function expectHealthy(
  name: string,
  url: string,
  path: string
): Promise<void> {
  const target = `${url}${path}`;
  const response = await fetch(target, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`${name} not healthy at ${target}`);
  }
  console.info(`✅ ${name} healthy @ ${url}`, undefined, 'Script');
}

if (!rpcUrl) {
  throw new Error('JEJU_RPC_URL is required for testnet');
}

await expectHealthy('Jeju gateway', gateway, '/health');
await expectHealthy('CQL', cql, '/health');
await expectHealthy('Cache', cache, '/health');
await expectHealthy('Storage', storage, '/health');
await expectHealthy('OAuth3', oauth3, '/health');
await expectHealthy('KMS', kms, '/health');

console.info('', undefined, 'Script');
console.info('='.repeat(60), undefined, 'Script');
console.info('✅ Jeju testnet environment ready!', undefined, 'Script');
console.info('', undefined, 'Script');
console.info('Network:', undefined, 'Script');
console.info('  Chain: Jeju Testnet (420690)', undefined, 'Script');
console.info('  RPC: ' + rpcUrl, undefined, 'Script');
console.info('  Gateway: ' + gateway, undefined, 'Script');
console.info('', undefined, 'Script');
console.info('Starting Next.js...', undefined, 'Script');
console.info('='.repeat(60), undefined, 'Script');
