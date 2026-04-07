import {
  getCurrentChainId,
  getCurrentRpcUrl,
  PUBLIC_CONFIG,
} from '@babylon/shared';
import type { Address } from 'viem';
import baseDeployment from '../../deployments/base';
import baseSepoliaDeployment from '../../deployments/base-sepolia';
import localDeployment from '../../deployments/local';

const ethereumDeployment = {
  contracts: PUBLIC_CONFIG.networks.ethereum.contracts,
};

type RawContracts = Partial<Record<string, string>>;
type RawDeployment = {
  contracts?: RawContracts;
};

function asDeployment(moduleValue: unknown): RawDeployment {
  return typeof moduleValue === 'object' && moduleValue !== null
    ? (moduleValue as RawDeployment)
    : {};
}

function readAddress(value: unknown): Address | undefined {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? (value as Address)
    : undefined;
}

export interface DeployedContracts {
  identityRegistry: Address;
  reputationSystem: Address;
  chainId: number;
  network: string;
}

function requireAddress(value: Address | undefined, label: string): Address {
  if (!value) {
    throw new Error(`${label} is not configured`);
  }
  return value;
}

function resolveContracts(
  deploymentValue: unknown,
  chainId: number,
  network: string
): DeployedContracts {
  const deployment = asDeployment(deploymentValue);
  const contracts = deployment.contracts;

  return {
    identityRegistry: requireAddress(
      readAddress(process.env.NEXT_PUBLIC_IDENTITY_REGISTRY) ??
        readAddress(contracts?.identityRegistry),
      `${network} identity registry address`
    ),
    reputationSystem: requireAddress(
      readAddress(process.env.NEXT_PUBLIC_REPUTATION_SYSTEM) ??
        readAddress(contracts?.reputationSystem),
      `${network} reputation system address`
    ),
    chainId,
    network,
  };
}

export function getContractAddresses(): DeployedContracts {
  const chainId = getCurrentChainId();

  if (chainId === 31337) {
    return resolveContracts(localDeployment, chainId, 'localnet');
  }
  if (chainId === 1) {
    return resolveContracts(ethereumDeployment, chainId, 'ethereum');
  }
  if (chainId === 84532) {
    return resolveContracts(baseSepoliaDeployment, chainId, 'base-sepolia');
  }
  return resolveContracts(baseDeployment, chainId, 'base');
}

export function isLocalnet(): boolean {
  return getCurrentChainId() === 31337;
}

export function getRpcUrl(): string {
  return getCurrentRpcUrl();
}
