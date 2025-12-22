/**
 * Deployment environment detection for Babylon on Jeju.
 *
 * Centralized fallbacks are not supported. This module fails fast
 * if required Jeju variables are absent.
 */

import { type DeploymentEnv, DeploymentEnvSchema } from '../schemas';

export type { DeploymentEnv };

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_BY_ENV: Record<DeploymentEnv, string[]> = {
  localnet: [
    'CQL_BLOCK_PRODUCER_ENDPOINT',
    'CQL_DATABASE_ID',
    'JEJU_CACHE_SERVICE_URL',
    'JEJU_STORAGE_SERVICE_URL',
    'JEJU_OAUTH3_SERVICE_URL',
    'JEJU_KMS_SERVICE_URL',
    'JEJU_RPC_URL',
  ],
  testnet: [
    'CQL_BLOCK_PRODUCER_ENDPOINT',
    'CQL_DATABASE_ID',
    'JEJU_CACHE_SERVICE_URL',
    'JEJU_STORAGE_SERVICE_URL',
    'JEJU_OAUTH3_SERVICE_URL',
    'JEJU_KMS_SERVICE_URL',
    'JEJU_RPC_URL',
    'BABYLON_TREASURY_ADDRESS',
    'BABYLON_DAO_ADDRESS',
    'BABYLON_AGENT_VAULT_ADDRESS',
    'TRAINING_ORCHESTRATOR_ADDRESS',
  ],
  mainnet: [
    'CQL_BLOCK_PRODUCER_ENDPOINT',
    'CQL_DATABASE_ID',
    'JEJU_CACHE_SERVICE_URL',
    'JEJU_STORAGE_SERVICE_URL',
    'JEJU_OAUTH3_SERVICE_URL',
    'JEJU_KMS_SERVICE_URL',
    'JEJU_RPC_URL',
    'BABYLON_TREASURY_ADDRESS',
    'BABYLON_DAO_ADDRESS',
    'BABYLON_AGENT_VAULT_ADDRESS',
    'TRAINING_ORCHESTRATOR_ADDRESS',
  ],
};

export function detectEnvironment(): DeploymentEnv {
  const envValue = process.env.DEPLOYMENT_ENV ?? process.env.JEJU_NETWORK;
  const result = DeploymentEnvSchema.safeParse(envValue);

  if (result.success) {
    return result.data;
  }

  return 'localnet';
}

export function validateEnvironment(env: DeploymentEnv): EnvValidationResult {
  const missing = REQUIRED_BY_ENV[env].filter((key) => !process.env[key]);

  return {
    valid: missing.length === 0,
    errors:
      missing.length === 0
        ? []
        : missing.map((key) => `${key} is required for ${env} and is not set`),
    warnings: [],
  };
}

export function printValidationResult(result: EnvValidationResult): void {
  if (result.valid) {
    console.info(
      `[env] ${result.errors.length === 0 ? '✅' : '⚠️'} environment validated`
    );
    return;
  }

  console.error('[env] ❌ environment validation failed');
  result.errors.forEach((error) => console.error(`   - ${error}`));
}
