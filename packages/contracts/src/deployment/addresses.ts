/**
 * @packageDocumentation
 * @module @babylon/contracts/deployment/addresses
 *
 * Contract address loader for Babylon deployments.
 *
 * Resolution order:
 * 1. Explicit environment overrides
 * 2. Saved deployment metadata in `packages/contracts/deployments/*`
 * 3. Canonical public config defaults
 */

import {
  getCurrentChainId,
  getCurrentRpcUrl,
  PUBLIC_CONFIG,
} from '@babylon/shared';
import type { Address } from 'viem';
import baseDeployment from '../../deployments/base';
import baseSepoliaDeployment from '../../deployments/base-sepolia';
import localDeployment from '../../deployments/local';

type RawContracts = Partial<Record<string, string>>;
type RawDeployment = {
  contracts?: RawContracts;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

function asDeployment(moduleValue: unknown): RawDeployment {
  return typeof moduleValue === 'object' && moduleValue !== null
    ? (moduleValue as RawDeployment)
    : {};
}

function isAddress(value: unknown): value is Address {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isNonZeroAddress(value: unknown): value is Address {
  return isAddress(value) && value !== ZERO_ADDRESS;
}

function envAddress(...keys: string[]): Address | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (isNonZeroAddress(value)) {
      return value;
    }
  }

  return undefined;
}

function fromContracts(
  contracts: RawContracts | undefined,
  key: string
): Address | undefined {
  const value = contracts?.[key];
  return isNonZeroAddress(value) ? value : undefined;
}

function fromConfig(
  network:
    | typeof PUBLIC_CONFIG.networks.local
    | typeof PUBLIC_CONFIG.networks.baseSepolia
    | typeof PUBLIC_CONFIG.networks.base,
  key: string
): Address | undefined {
  const value = (
    network.contracts as unknown as Record<string, string | undefined>
  )[key];
  return isNonZeroAddress(value) ? (value as Address) : undefined;
}

function requireAddress(value: Address | undefined, message: string): Address {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

/**
 * Deployed contract addresses for the current network.
 */
export interface DeployedContracts {
  diamond: Address;
  babylonOracle: Address;
  predictionMarketFacet: Address;
  identityRegistry: Address;
  reputationSystem: Address;
  gameOracleFacet?: Address;
  oracleFacet?: Address;
  liquidityPoolFacet?: Address;
  perpetualMarketFacet?: Address;
  referralSystemFacet?: Address;
  priceStorageFacet?: Address;
  perpAdminFacet?: Address;
  perpCollateralFacet?: Address;
  perpOrderFacet?: Address;
  perpSettlementFacet?: Address;
  perpViewFacet?: Address;
  mockUsdc?: Address;
  chainId: number;
  network: string;
}

function resolveLocalContracts(chainId: number): DeployedContracts {
  const deployment = asDeployment(localDeployment);
  const contracts = deployment.contracts;

  const diamond = requireAddress(
    envAddress('BABYLON_DIAMOND_ADDRESS', 'NEXT_PUBLIC_DIAMOND_ADDRESS') ??
      fromContracts(contracts, 'diamond') ??
      fromConfig(PUBLIC_CONFIG.networks.local, 'diamond'),
    'Local Babylon diamond address is not configured'
  );
  const identityRegistry = requireAddress(
    envAddress('NEXT_PUBLIC_IDENTITY_REGISTRY') ??
      fromContracts(contracts, 'identityRegistry') ??
      fromConfig(PUBLIC_CONFIG.networks.local, 'identityRegistry'),
    'Local identity registry address is not configured'
  );
  const reputationSystem = requireAddress(
    envAddress('NEXT_PUBLIC_REPUTATION_SYSTEM') ??
      fromContracts(contracts, 'reputationSystem') ??
      fromConfig(PUBLIC_CONFIG.networks.local, 'reputationSystem'),
    'Local reputation system address is not configured'
  );
  const predictionMarketFacet = requireAddress(
    envAddress('NEXT_PUBLIC_PREDICTION_MARKET_FACET') ??
      fromContracts(contracts, 'predictionMarketFacet') ??
      fromConfig(PUBLIC_CONFIG.networks.local, 'predictionMarketFacet'),
    'Local prediction market facet address is not configured'
  );
  const babylonOracle = requireAddress(
    envAddress('NEXT_PUBLIC_BABYLON_ORACLE') ??
      fromContracts(contracts, 'babylonOracle') ??
      fromConfig(PUBLIC_CONFIG.networks.local, 'babylonOracle'),
    'Local Babylon oracle address is not configured'
  );

  return {
    diamond,
    babylonOracle,
    predictionMarketFacet,
    identityRegistry,
    reputationSystem,
    gameOracleFacet:
      envAddress('NEXT_PUBLIC_GAME_ORACLE_FACET') ??
      fromContracts(contracts, 'gameOracleFacet'),
    oracleFacet:
      envAddress('NEXT_PUBLIC_ORACLE_FACET') ??
      fromContracts(contracts, 'oracleFacet') ??
      fromConfig(PUBLIC_CONFIG.networks.local, 'oracleFacet'),
    liquidityPoolFacet:
      envAddress('NEXT_PUBLIC_LIQUIDITY_POOL_FACET') ??
      fromContracts(contracts, 'liquidityPoolFacet'),
    perpetualMarketFacet:
      envAddress('NEXT_PUBLIC_PERPETUAL_MARKET_FACET') ??
      fromContracts(contracts, 'perpetualMarketFacet'),
    referralSystemFacet:
      envAddress('NEXT_PUBLIC_REFERRAL_SYSTEM_FACET') ??
      fromContracts(contracts, 'referralSystemFacet'),
    priceStorageFacet:
      envAddress('NEXT_PUBLIC_PRICE_STORAGE_FACET') ??
      fromContracts(contracts, 'priceStorageFacet'),
    perpAdminFacet:
      envAddress('NEXT_PUBLIC_PERP_ADMIN_FACET') ??
      fromContracts(contracts, 'perpAdminFacet'),
    perpCollateralFacet:
      envAddress('NEXT_PUBLIC_PERP_COLLATERAL_FACET') ??
      fromContracts(contracts, 'perpCollateralFacet'),
    perpOrderFacet:
      envAddress('NEXT_PUBLIC_PERP_ORDER_FACET') ??
      fromContracts(contracts, 'perpOrderFacet'),
    perpSettlementFacet:
      envAddress('NEXT_PUBLIC_PERP_SETTLEMENT_FACET') ??
      fromContracts(contracts, 'perpSettlementFacet'),
    perpViewFacet:
      envAddress('NEXT_PUBLIC_PERP_VIEW_FACET') ??
      fromContracts(contracts, 'perpViewFacet'),
    mockUsdc:
      envAddress('NEXT_PUBLIC_MOCK_USDC') ??
      fromContracts(contracts, 'mockUsdc'),
    chainId,
    network: 'localnet',
  };
}

function resolveBaseSepoliaContracts(chainId: number): DeployedContracts {
  const deployment = asDeployment(baseSepoliaDeployment);
  const contracts = deployment.contracts;

  const diamond = requireAddress(
    envAddress('BABYLON_DIAMOND_ADDRESS', 'NEXT_PUBLIC_DIAMOND_ADDRESS') ??
      fromContracts(contracts, 'diamond') ??
      fromConfig(PUBLIC_CONFIG.networks.baseSepolia, 'diamond'),
    'Base Sepolia Babylon diamond address is not configured'
  );
  const identityRegistry = requireAddress(
    envAddress('NEXT_PUBLIC_IDENTITY_REGISTRY') ??
      fromContracts(contracts, 'identityRegistry') ??
      fromConfig(PUBLIC_CONFIG.networks.baseSepolia, 'identityRegistry'),
    'Base Sepolia identity registry address is not configured'
  );
  const reputationSystem = requireAddress(
    envAddress('NEXT_PUBLIC_REPUTATION_SYSTEM') ??
      fromContracts(contracts, 'reputationSystem') ??
      fromConfig(PUBLIC_CONFIG.networks.baseSepolia, 'reputationSystem'),
    'Base Sepolia reputation system address is not configured'
  );
  const predictionMarketFacet = requireAddress(
    envAddress('NEXT_PUBLIC_PREDICTION_MARKET_FACET') ??
      fromContracts(contracts, 'predictionMarketFacet') ??
      fromConfig(PUBLIC_CONFIG.networks.baseSepolia, 'predictionMarketFacet'),
    'Base Sepolia prediction market facet address is not configured'
  );
  const babylonOracle = requireAddress(
    envAddress('NEXT_PUBLIC_BABYLON_ORACLE') ??
      fromContracts(contracts, 'babylonOracle') ??
      fromContracts(contracts, 'oracleFacet'),
    'Base Sepolia Babylon oracle address is not configured'
  );

  return {
    diamond,
    babylonOracle,
    predictionMarketFacet,
    identityRegistry,
    reputationSystem,
    gameOracleFacet:
      envAddress('NEXT_PUBLIC_GAME_ORACLE_FACET') ??
      fromContracts(contracts, 'gameOracleFacet'),
    oracleFacet:
      envAddress('NEXT_PUBLIC_ORACLE_FACET') ??
      fromContracts(contracts, 'oracleFacet') ??
      fromConfig(PUBLIC_CONFIG.networks.baseSepolia, 'oracleFacet'),
    liquidityPoolFacet:
      envAddress('NEXT_PUBLIC_LIQUIDITY_POOL_FACET') ??
      fromContracts(contracts, 'liquidityPoolFacet'),
    perpetualMarketFacet:
      envAddress('NEXT_PUBLIC_PERPETUAL_MARKET_FACET') ??
      fromContracts(contracts, 'perpetualMarketFacet'),
    referralSystemFacet:
      envAddress('NEXT_PUBLIC_REFERRAL_SYSTEM_FACET') ??
      fromContracts(contracts, 'referralSystemFacet'),
    priceStorageFacet:
      envAddress('NEXT_PUBLIC_PRICE_STORAGE_FACET') ??
      fromContracts(contracts, 'priceStorageFacet'),
    perpAdminFacet:
      envAddress('NEXT_PUBLIC_PERP_ADMIN_FACET') ??
      fromContracts(contracts, 'perpAdminFacet'),
    perpCollateralFacet:
      envAddress('NEXT_PUBLIC_PERP_COLLATERAL_FACET') ??
      fromContracts(contracts, 'perpCollateralFacet'),
    perpOrderFacet:
      envAddress('NEXT_PUBLIC_PERP_ORDER_FACET') ??
      fromContracts(contracts, 'perpOrderFacet'),
    perpSettlementFacet:
      envAddress('NEXT_PUBLIC_PERP_SETTLEMENT_FACET') ??
      fromContracts(contracts, 'perpSettlementFacet'),
    perpViewFacet:
      envAddress('NEXT_PUBLIC_PERP_VIEW_FACET') ??
      fromContracts(contracts, 'perpViewFacet'),
    mockUsdc:
      envAddress('NEXT_PUBLIC_MOCK_USDC') ??
      fromContracts(contracts, 'mockUsdc'),
    chainId,
    network: 'base-sepolia',
  };
}

function resolveBaseMainnetContracts(chainId: number): DeployedContracts {
  const deployment = asDeployment(baseDeployment);
  const contracts = deployment.contracts;

  const diamond = requireAddress(
    envAddress('BABYLON_DIAMOND_ADDRESS', 'NEXT_PUBLIC_DIAMOND_ADDRESS') ??
      fromContracts(contracts, 'diamond') ??
      fromConfig(PUBLIC_CONFIG.networks.base, 'diamond'),
    'Base mainnet Babylon diamond address is not configured. Deploy contracts first or set BABYLON_DIAMOND_ADDRESS.'
  );
  const identityRegistry = requireAddress(
    envAddress('NEXT_PUBLIC_IDENTITY_REGISTRY') ??
      fromContracts(contracts, 'identityRegistry') ??
      fromConfig(PUBLIC_CONFIG.networks.base, 'identityRegistry'),
    'Base mainnet identity registry address is not configured'
  );
  const reputationSystem = requireAddress(
    envAddress('NEXT_PUBLIC_REPUTATION_SYSTEM') ??
      fromContracts(contracts, 'reputationSystem') ??
      fromConfig(PUBLIC_CONFIG.networks.base, 'reputationSystem'),
    'Base mainnet reputation system address is not configured'
  );
  const predictionMarketFacet = requireAddress(
    envAddress('NEXT_PUBLIC_PREDICTION_MARKET_FACET') ??
      fromContracts(contracts, 'predictionMarketFacet') ??
      fromConfig(PUBLIC_CONFIG.networks.base, 'predictionMarketFacet'),
    'Base mainnet prediction market facet address is not configured'
  );
  const babylonOracle = requireAddress(
    envAddress('NEXT_PUBLIC_BABYLON_ORACLE') ??
      fromContracts(contracts, 'babylonOracle') ??
      fromContracts(contracts, 'oracleFacet'),
    'Base mainnet Babylon oracle address is not configured'
  );

  return {
    diamond,
    babylonOracle,
    predictionMarketFacet,
    identityRegistry,
    reputationSystem,
    gameOracleFacet:
      envAddress('NEXT_PUBLIC_GAME_ORACLE_FACET') ??
      fromContracts(contracts, 'gameOracleFacet'),
    oracleFacet:
      envAddress('NEXT_PUBLIC_ORACLE_FACET') ??
      fromContracts(contracts, 'oracleFacet') ??
      fromConfig(PUBLIC_CONFIG.networks.base, 'oracleFacet'),
    liquidityPoolFacet:
      envAddress('NEXT_PUBLIC_LIQUIDITY_POOL_FACET') ??
      fromContracts(contracts, 'liquidityPoolFacet'),
    perpetualMarketFacet:
      envAddress('NEXT_PUBLIC_PERPETUAL_MARKET_FACET') ??
      fromContracts(contracts, 'perpetualMarketFacet'),
    referralSystemFacet:
      envAddress('NEXT_PUBLIC_REFERRAL_SYSTEM_FACET') ??
      fromContracts(contracts, 'referralSystemFacet'),
    priceStorageFacet:
      envAddress('NEXT_PUBLIC_PRICE_STORAGE_FACET') ??
      fromContracts(contracts, 'priceStorageFacet'),
    perpAdminFacet:
      envAddress('NEXT_PUBLIC_PERP_ADMIN_FACET') ??
      fromContracts(contracts, 'perpAdminFacet'),
    perpCollateralFacet:
      envAddress('NEXT_PUBLIC_PERP_COLLATERAL_FACET') ??
      fromContracts(contracts, 'perpCollateralFacet'),
    perpOrderFacet:
      envAddress('NEXT_PUBLIC_PERP_ORDER_FACET') ??
      fromContracts(contracts, 'perpOrderFacet'),
    perpSettlementFacet:
      envAddress('NEXT_PUBLIC_PERP_SETTLEMENT_FACET') ??
      fromContracts(contracts, 'perpSettlementFacet'),
    perpViewFacet:
      envAddress('NEXT_PUBLIC_PERP_VIEW_FACET') ??
      fromContracts(contracts, 'perpViewFacet'),
    chainId,
    network: 'base',
  };
}

export function getContractAddresses(): DeployedContracts {
  const chainId = getCurrentChainId();

  if (chainId === 31337) {
    return resolveLocalContracts(chainId);
  }

  if (chainId === 84532) {
    return resolveBaseSepoliaContracts(chainId);
  }

  if (chainId === 8453) {
    return resolveBaseMainnetContracts(chainId);
  }

  if (chainId === 1) {
    const ethContracts = PUBLIC_CONFIG.networks.ethereum.contracts;
    return {
      diamond: ZERO_ADDRESS,
      babylonOracle: ZERO_ADDRESS,
      predictionMarketFacet: ZERO_ADDRESS,
      identityRegistry: ethContracts.identityRegistry as Address,
      reputationSystem: ethContracts.reputationSystem as Address,
      chainId,
      network: 'ethereum',
    };
  }

  if (
    process.env.NODE_ENV === 'production' ||
    process.env.DEPLOYMENT_ENV === 'mainnet'
  ) {
    throw new Error(
      `Unsupported chain ID ${chainId} in production. Supported: 1, 8453, 84532, 31337.`
    );
  }

  return resolveLocalContracts(31337);
}

export function isLocalnet(): boolean {
  return getCurrentChainId() === 31337;
}

export function getRpcUrl(): string {
  return getCurrentRpcUrl();
}
