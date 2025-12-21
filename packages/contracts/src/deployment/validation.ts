import type { DeploymentEnv } from './env-detection';
import { detectEnvironment, validateEnvironment } from './env-detection';

export interface ValidationResult {
  deployed: boolean;
  valid: boolean;
  errors: string[];
}

const REQUIRED_CONTRACT_VARS: Record<DeploymentEnv, string[]> = {
  localnet: [],
  testnet: [
    'BABYLON_TREASURY_ADDRESS',
    'BABYLON_DAO_ADDRESS',
    'BABYLON_AGENT_VAULT_ADDRESS',
    'TRAINING_ORCHESTRATOR_ADDRESS',
  ],
  mainnet: [
    'BABYLON_TREASURY_ADDRESS',
    'BABYLON_DAO_ADDRESS',
    'BABYLON_AGENT_VAULT_ADDRESS',
    'TRAINING_ORCHESTRATOR_ADDRESS',
  ],
};

export function validateDeployment(
  env: DeploymentEnv = detectEnvironment(),
  rpcUrl?: string
): ValidationResult {
  const envResult = validateEnvironment(env);
  const missingContracts = REQUIRED_CONTRACT_VARS[env].filter(
    (key) => !process.env[key]
  );

  const errors = [...envResult.errors];
  if (missingContracts.length > 0) {
    errors.push(`Missing contract addresses: ${missingContracts.join(', ')}`);
  }
  if (!rpcUrl && env !== 'localnet') {
    errors.push(
      'JEJU_RPC_URL (or provided rpcUrl) is required for contract validation'
    );
  }

  return {
    deployed: missingContracts.length === 0,
    valid: errors.length === 0,
    errors,
  };
}
