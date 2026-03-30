/**
 * Deployment Validation Utilities
 *
 * Validate that contracts are deployed and working correctly.
 * This file contains only browser-compatible code.
 *
 * @remarks For Node.js file system operations (saveDeployment, updateEnvFile),
 * import from '@babylon/contracts/deployment/validation-node'.
 */

import { ethers } from 'ethers';
import type { DeploymentEnv } from './env-detection';
import { logger } from './logger';

/**
 * Contract addresses for a deployment.
 *
 * Includes all core contracts and optional components that may be deployed.
 */
export interface ContractAddresses {
  /** Diamond proxy contract address */
  diamond: string;
  /** DiamondCut facet address */
  diamondCutFacet: string;
  /** DiamondLoupe facet address */
  diamondLoupeFacet: string;
  /** PredictionMarket facet address */
  predictionMarketFacet: string;
  /** Oracle facet address */
  oracleFacet: string;
  /** Game Oracle facet address */
  gameOracleFacet?: string;
  /** LiquidityPool facet address (optional) */
  liquidityPoolFacet?: string;
  /** PerpetualMarket facet address (optional) */
  perpetualMarketFacet?: string;
  /** ReferralSystem facet address (optional) */
  referralSystemFacet?: string;
  /** Price storage facet address (optional) */
  priceStorageFacet?: string;
  /** New perp admin facet address (optional) */
  perpAdminFacet?: string;
  /** New perp collateral facet address (optional) */
  perpCollateralFacet?: string;
  /** New perp order facet address (optional) */
  perpOrderFacet?: string;
  /** New perp settlement facet address (optional) */
  perpSettlementFacet?: string;
  /** New perp view facet address (optional) */
  perpViewFacet?: string;
  /** ERC-8004 Identity Registry address */
  identityRegistry: string;
  /** ERC-8004 Reputation System address */
  reputationSystem: string;
  /** Babylon Game Oracle address (optional) */
  babylonOracle?: string;
  /** Hyperbet PM-AMM router address (optional) */
  predictionAmmRouter?: string;
  /** Babylon oracle adapter used by PM-AMM markets (optional) */
  predictionOracleAdapter?: string;
  /** Ban Manager address (optional) */
  banManager?: string;
  /** Chainlink Oracle mock address (testnet only) */
  chainlinkOracle?: string;
  /** Mock Oracle address (testnet only) */
  mockOracle?: string;
  /** Mock USDC collateral token (testnet/local only) */
  mockUsdc?: string;
  /** Test ERC20 token address (testnet only) */
  testToken?: string;
}

export interface DeploymentInfo {
  network: string;
  chainId: number;
  contracts: ContractAddresses;
  deployer: string;
  timestamp: string;
  blockNumber?: number;
  gasUsed?: string;
  explorer?: Record<string, string>;
}

export interface ValidationResult {
  valid: boolean;
  deployed: boolean;
  errors: string[];
  warnings: string[];
  contracts: Partial<ContractAddresses>;
}

/**
 * Load deployment information from module imports.
 *
 * @param env - Deployment environment to load
 * @returns Deployment info or null if not found
 */
export async function loadDeployment(
  env: DeploymentEnv
): Promise<DeploymentInfo | null> {
  if (env === 'localnet') {
    const deployment = await import('../../deployments/local');
    return deployment.default as DeploymentInfo;
  }
  if (env === 'testnet') {
    const deployment = await import('../../deployments/base-sepolia');
    return deployment.default as DeploymentInfo;
  }
  if (env === 'mainnet') {
    const deployment = await import('../../deployments/base');
    return deployment.default as DeploymentInfo;
  }

  return null;
}

/**
 * Validate contract deployment
 */
export async function validateDeployment(
  env: DeploymentEnv,
  rpcUrl: string,
  expectedContracts?: Partial<ContractAddresses>
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const contracts: Partial<ContractAddresses> = {};

  const deployment = await loadDeployment(env);

  if (!deployment) {
    return {
      valid: false,
      deployed: false,
      errors: [
        `No deployment found for ${env}`,
        'Run the deployment script to deploy contracts',
      ],
      warnings: [],
      contracts: {},
    };
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const deploymentChainId = BigInt(deployment.chainId);
  if (network.chainId !== deploymentChainId) {
    errors.push(
      `Chain ID mismatch: provider is ${network.chainId}, deployment is ${deploymentChainId}`
    );
  }

  const contractsToValidate = expectedContracts || deployment.contracts;

  const requiredAddresses: Array<
    [keyof ContractAddresses, string | undefined]
  > = [
    ['diamond', contractsToValidate.diamond],
    ['identityRegistry', contractsToValidate.identityRegistry],
    ['reputationSystem', contractsToValidate.reputationSystem],
  ];

  const optionalAddresses: Array<
    [keyof ContractAddresses, string | undefined]
  > = [
    ['diamondCutFacet', contractsToValidate.diamondCutFacet],
    ['diamondLoupeFacet', contractsToValidate.diamondLoupeFacet],
    ['predictionMarketFacet', contractsToValidate.predictionMarketFacet],
    ['oracleFacet', contractsToValidate.oracleFacet],
    ['gameOracleFacet', contractsToValidate.gameOracleFacet],
    ['liquidityPoolFacet', contractsToValidate.liquidityPoolFacet],
    ['perpetualMarketFacet', contractsToValidate.perpetualMarketFacet],
    ['referralSystemFacet', contractsToValidate.referralSystemFacet],
    ['priceStorageFacet', contractsToValidate.priceStorageFacet],
    ['perpAdminFacet', contractsToValidate.perpAdminFacet],
    ['perpCollateralFacet', contractsToValidate.perpCollateralFacet],
    ['perpOrderFacet', contractsToValidate.perpOrderFacet],
    ['perpSettlementFacet', contractsToValidate.perpSettlementFacet],
    ['perpViewFacet', contractsToValidate.perpViewFacet],
    ['babylonOracle', contractsToValidate.babylonOracle],
    ['predictionAmmRouter', contractsToValidate.predictionAmmRouter],
    ['predictionOracleAdapter', contractsToValidate.predictionOracleAdapter],
    ['banManager', contractsToValidate.banManager],
    ['chainlinkOracle', contractsToValidate.chainlinkOracle],
    ['mockOracle', contractsToValidate.mockOracle],
    ['mockUsdc', contractsToValidate.mockUsdc],
    ['testToken', contractsToValidate.testToken],
  ];

  async function validateAddress(
    label: string,
    key: keyof ContractAddresses,
    address?: string,
    required = false
  ): Promise<void> {
    if (!address) {
      if (required) {
        errors.push(`${label} address is missing from deployment metadata`);
      }
      return;
    }

    const code = await provider.getCode(address);
    if (code === '0x' || code === '0x0') {
      if (required) {
        errors.push(`${label} not deployed at ${address}`);
      } else {
        warnings.push(`${label} not deployed at ${address}`);
      }
      return;
    }

    contracts[key] = address;
    logger.info(
      `✅ ${label} verified at ${address}`,
      undefined,
      'DeploymentValidation'
    );
  }

  for (const [key, address] of requiredAddresses) {
    await validateAddress(key, key, address, true);
  }

  for (const [key, address] of optionalAddresses) {
    await validateAddress(key, key, address, false);
  }

  if (contracts.diamond) {
    const diamondContract = new ethers.Contract(
      contracts.diamond,
      [
        'function getPerpEngineConfig() view returns (address collateralToken,uint8 collateralDecimals,address oracleUpdater,address feeRecipient,uint16 protocolFeeShareBps,uint32 maxOracleDelay,uint256 nextOrderNonce)',
      ],
      provider
    ) as ethers.Contract & {
      getPerpEngineConfig: () => Promise<{
        collateralToken: string;
        collateralDecimals: number;
        oracleUpdater: string;
        feeRecipient: string;
        protocolFeeShareBps: number;
        maxOracleDelay: number;
        nextOrderNonce: bigint;
      }>;
    };

    const engineConfig = await diamondContract.getPerpEngineConfig();
    const typedEngineConfig = engineConfig as {
      collateralToken: string;
      collateralDecimals: number;
      oracleUpdater: string;
      feeRecipient: string;
      protocolFeeShareBps: number;
      maxOracleDelay: number;
      nextOrderNonce: bigint;
    };

    if (
      !typedEngineConfig.collateralToken ||
      typedEngineConfig.collateralToken === ethers.ZeroAddress
    ) {
      errors.push('Diamond perp engine is not initialized');
    } else {
      logger.info(
        `✅ Perp engine initialized with collateral ${typedEngineConfig.collateralToken}`,
        undefined,
        'DeploymentValidation'
      );
    }
  }

  if (contracts.predictionAmmRouter && contracts.predictionOracleAdapter) {
    const routerContract = new ethers.Contract(
      contracts.predictionAmmRouter,
      [
        'function oracleAdapter() view returns (address)',
        'function collateralToken() view returns (address)',
      ],
      provider
    ) as ethers.Contract & {
      oracleAdapter: () => Promise<string>;
      collateralToken: () => Promise<string>;
    };
    const adapterContract = new ethers.Contract(
      contracts.predictionOracleAdapter,
      ['function babylonOracle() view returns (address)'],
      provider
    ) as ethers.Contract & {
      babylonOracle: () => Promise<string>;
    };

    const [routerOracleAdapter, routerCollateralToken, adapterBabylonOracle] =
      await Promise.all([
        routerContract.oracleAdapter(),
        routerContract.collateralToken(),
        adapterContract.babylonOracle(),
      ]);

    if (
      routerOracleAdapter.toLowerCase() !==
      contracts.predictionOracleAdapter.toLowerCase()
    ) {
      errors.push(
        `Prediction router oracle adapter mismatch: router points to ${routerOracleAdapter}, deployment metadata expects ${contracts.predictionOracleAdapter}`
      );
    }

    if (
      contracts.babylonOracle &&
      adapterBabylonOracle.toLowerCase() !== contracts.babylonOracle.toLowerCase()
    ) {
      errors.push(
        `Prediction oracle adapter Babylon oracle mismatch: adapter points to ${adapterBabylonOracle}, deployment metadata expects ${contracts.babylonOracle}`
      );
    }

    if (
      contracts.mockUsdc &&
      routerCollateralToken.toLowerCase() !== contracts.mockUsdc.toLowerCase()
    ) {
      errors.push(
        `Prediction router collateral mismatch: router uses ${routerCollateralToken}, deployment metadata expects ${contracts.mockUsdc}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    deployed: Object.keys(contracts).length > 0,
    errors,
    warnings,
    contracts,
  };
}

/**
 * Check if a contract is deployed at an address
 */
export async function isContractDeployed(
  rpcUrl: string,
  address: string
): Promise<boolean> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const code = await provider.getCode(address);
  return code !== '0x' && code !== '0x0';
}

/**
 * Print deployment validation result
 */
export function printDeploymentValidationResult(
  result: ValidationResult,
  env: DeploymentEnv
): void {
  if (!result.deployed) {
    logger.error(
      `❌ No contracts deployed for ${env}`,
      undefined,
      'DeploymentValidation'
    );
    for (const error of result.errors) {
      logger.error(`   ${error}`, undefined, 'DeploymentValidation');
    }

    logger.info(
      '\nTo deploy contracts, run:',
      undefined,
      'DeploymentValidation'
    );
    logger.info(
      `   bun run contracts:deploy:${env === 'testnet' ? 'testnet' : env === 'mainnet' ? 'mainnet' : 'local'}`,
      undefined,
      'DeploymentValidation'
    );
    return;
  }

  if (result.warnings.length > 0) {
    logger.warn('Warnings:', undefined, 'DeploymentValidation');
    for (const warning of result.warnings) {
      logger.warn(`  ⚠️  ${warning}`, undefined, 'DeploymentValidation');
    }
  }

  if (result.errors.length > 0) {
    logger.error('Validation errors:', undefined, 'DeploymentValidation');
    for (const error of result.errors) {
      logger.error(`  ❌ ${error}`, undefined, 'DeploymentValidation');
    }
    throw new Error('Contract validation failed');
  }

  if (!result.valid) {
    throw new Error('Contract validation failed');
  }

  logger.info(
    '✅ All contracts validated successfully',
    undefined,
    'DeploymentValidation'
  );
}

/**
 * Wait for transaction confirmation.
 *
 * Polls the network until the transaction has the required number of confirmations.
 *
 * @param provider - Ethers provider instance
 * @param txHash - Transaction hash to wait for
 * @param confirmations - Number of confirmations required (default: 1)
 * @returns Transaction receipt or null if timeout
 * @throws Error if confirmation timeout is reached
 */
export async function waitForTransaction(
  provider: ethers.Provider,
  txHash: string,
  confirmations = 1
): Promise<ethers.TransactionReceipt | null> {
  logger.info(
    `Waiting for transaction ${txHash}...`,
    undefined,
    'DeploymentValidation'
  );

  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt && receipt.blockNumber) {
      const currentBlock = await provider.getBlockNumber();
      const confirmedBlocks = currentBlock - receipt.blockNumber;

      if (confirmedBlocks >= confirmations) {
        logger.info(
          `✅ Transaction confirmed (${confirmedBlocks} blocks)`,
          undefined,
          'DeploymentValidation'
        );
        return receipt;
      }

      logger.info(
        `Transaction has ${confirmedBlocks}/${confirmations} confirmations`,
        undefined,
        'DeploymentValidation'
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error('Transaction confirmation timeout');
}
