/**
 * Deployment Validation Utilities - Node.js Only
 *
 * File system operations for deployment management.
 * These functions require Node.js and are NOT compatible with browser/edge runtime.
 *
 * @remarks Import from '@babylon/contracts/deployment/validation-node' for Node.js scripts only.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DeploymentEnv } from './env-detection';
import { logger } from './logger';
import type { ContractAddresses, DeploymentInfo } from './validation';

const deploymentPaths: Record<DeploymentEnv, string> = {
  localnet: 'packages/contracts/deployments/local',
  testnet: 'packages/contracts/deployments/base-sepolia',
  mainnet: 'packages/contracts/deployments/base',
};

const REMOVED_FACET_ENV_KEYS = [
  'NEXT_PUBLIC_LIQUIDITY_POOL_FACET',
  'NEXT_PUBLIC_PERPETUAL_MARKET_FACET',
  'NEXT_PUBLIC_PRICE_STORAGE_FACET',
] as const;

function getDeploymentFilePath(env: DeploymentEnv): string {
  return path.join(process.cwd(), deploymentPaths[env], 'index.json');
}

export async function loadDeploymentFromDisk(
  env: DeploymentEnv
): Promise<DeploymentInfo | null> {
  if (typeof process === 'undefined' || typeof process.cwd !== 'function') {
    throw new Error(
      'loadDeploymentFromDisk requires Node.js environment with file system access. Not available in edge runtime.'
    );
  }

  const filepath = getDeploymentFilePath(env);
  if (!fs.existsSync(filepath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filepath, 'utf-8')) as DeploymentInfo;
}

/**
 * Save deployment information to JSON file.
 *
 * @remarks This function uses Node.js file system APIs and is not compatible
 * with edge runtime. Only use in Node.js environments (scripts, build-time, etc.).
 *
 * @param env - Deployment environment
 * @param deployment - Deployment information to save
 * @throws Error if file system access is not available
 */
export async function saveDeployment(
  env: DeploymentEnv,
  deployment: DeploymentInfo
): Promise<void> {
  if (typeof process === 'undefined' || typeof process.cwd !== 'function') {
    throw new Error(
      'saveDeployment requires Node.js environment with file system access. Not available in edge runtime.'
    );
  }

  const filepath = getDeploymentFilePath(env);
  const dirpath = path.dirname(filepath);

  if (!fs.existsSync(dirpath)) {
    fs.mkdirSync(dirpath, { recursive: true });
  }

  fs.writeFileSync(filepath, JSON.stringify(deployment, null, 2));
  logger.info(
    `Deployment saved to ${filepath}`,
    undefined,
    'DeploymentValidation'
  );
}

/**
 * Update environment file with contract addresses
 *
 * NOTE: This function uses Node.js file system APIs and is not compatible with edge runtime.
 * Only use this in Node.js environments (scripts, build-time, etc.).
 */
export async function updateEnvFile(
  env: DeploymentEnv,
  contracts: ContractAddresses
): Promise<void> {
  if (typeof process === 'undefined' || typeof process.cwd !== 'function') {
    throw new Error(
      'updateEnvFile requires Node.js environment with file system access. Not available in edge runtime.'
    );
  }

  const envFiles = {
    localnet: '.env.local',
    testnet: '.env.testnet',
    mainnet: '.env.production',
  };

  const envFile = path.join(process.cwd(), envFiles[env]);

  let envContent = '';
  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf-8');
  }

  for (const key of REMOVED_FACET_ENV_KEYS) {
    envContent = envContent.replace(new RegExp(`^${key}=.*\\n?`, 'gm'), '');
  }

  const updates: Record<string, string | undefined> = {
    NEXT_PUBLIC_DIAMOND_ADDRESS: contracts.diamond,
    NEXT_PUBLIC_IDENTITY_REGISTRY: contracts.identityRegistry,
    NEXT_PUBLIC_REPUTATION_SYSTEM: contracts.reputationSystem,
    NEXT_PUBLIC_PREDICTION_MARKET_FACET: contracts.predictionMarketFacet,
    NEXT_PUBLIC_ORACLE_FACET: contracts.oracleFacet,
    NEXT_PUBLIC_GAME_ORACLE_FACET: contracts.gameOracleFacet,
    NEXT_PUBLIC_REFERRAL_SYSTEM_FACET: contracts.referralSystemFacet,
    NEXT_PUBLIC_PERP_ADMIN_FACET: contracts.perpAdminFacet,
    NEXT_PUBLIC_PERP_COLLATERAL_FACET: contracts.perpCollateralFacet,
    NEXT_PUBLIC_PERP_ORDER_FACET: contracts.perpOrderFacet,
    NEXT_PUBLIC_PERP_SETTLEMENT_FACET: contracts.perpSettlementFacet,
    NEXT_PUBLIC_PERP_VIEW_FACET: contracts.perpViewFacet,
    NEXT_PUBLIC_BAN_MANAGER: contracts.banManager,
    NEXT_PUBLIC_BABYLON_ORACLE: contracts.babylonOracle,
    NEXT_PUBLIC_MOCK_USDC: contracts.mockUsdc,
    NEXT_PUBLIC_TEST_TOKEN: contracts.testToken,
  };

  if (contracts.chainlinkOracle) {
    updates.NEXT_PUBLIC_CHAINLINK_ORACLE = contracts.chainlinkOracle;
  }

  if (contracts.mockOracle) {
    updates.NEXT_PUBLIC_MOCK_ORACLE = contracts.mockOracle;
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const match = envContent.match(regex);
      if (match) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }
  }

  fs.writeFileSync(envFile, envContent);
  logger.info(
    `Updated ${envFile} with contract addresses`,
    undefined,
    'DeploymentValidation'
  );
}
