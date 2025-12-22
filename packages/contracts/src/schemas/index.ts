/**
 * Zod schemas for environment and configuration validation
 *
 * Provides runtime validation for deployment configurations,
 * addresses, and environment variables.
 */

import { z } from 'zod';

// =============================================================================
// Base Schemas
// =============================================================================

export const DeploymentEnvSchema = z.enum(['localnet', 'testnet', 'mainnet']);
export type DeploymentEnv = z.infer<typeof DeploymentEnvSchema>;

export const PrivateKeySchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format');

export const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');
export type Address = z.infer<typeof AddressSchema>;

export const ChainIdSchema = z.coerce.number().int().positive();

export const Bytes32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid bytes32 format');

// =============================================================================
// Network Configuration Schemas
// =============================================================================

export const NetworkConfigSchema = z.object({
  chainId: ChainIdSchema,
  domainId: ChainIdSchema,
  rpc: z.string().url(),
  mailbox: AddressSchema,
  igp: AddressSchema,
});
export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;

export const DeployedContractSchema = z.object({
  token: AddressSchema,
  warpRoute: AddressSchema,
  rpc: z.string().url(),
});

export const DeployedNetworkSchema = z.object({
  chainId: ChainIdSchema,
  domainId: ChainIdSchema,
  token: AddressSchema,
  warpRoute: AddressSchema.optional(),
  igp: AddressSchema.optional(),
  mailbox: AddressSchema.optional(),
  rpc: z.string().url(),
});
export type DeployedNetwork = z.infer<typeof DeployedNetworkSchema>;

// =============================================================================
// Contract Address Schemas
// =============================================================================

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const ContractAddressesSchema = z.object({
  network: z.string(),
  chainId: ChainIdSchema,
  // DAO Infrastructure
  dao: AddressSchema.default(ZERO_ADDRESS),
  agentVault: AddressSchema.default(ZERO_ADDRESS),
  treasury: AddressSchema.default(ZERO_ADDRESS),
  trainingOrchestrator: AddressSchema.default(ZERO_ADDRESS),
  // Legacy/Other
  banManager: AddressSchema.default(ZERO_ADDRESS),
  moderationMarketplace: AddressSchema.default(ZERO_ADDRESS),
  x402Facilitator: AddressSchema.default(ZERO_ADDRESS),
  paymaster: AddressSchema.default(ZERO_ADDRESS),
  entryPoint: AddressSchema.default(
    '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
  ),
  // Registries
  identityRegistry: AddressSchema.default(ZERO_ADDRESS),
  reputationSystem: AddressSchema.default(ZERO_ADDRESS),
  diamond: AddressSchema.default(ZERO_ADDRESS),
  serverRegistry: AddressSchema.default(ZERO_ADDRESS),
  modelRegistry: AddressSchema.default(ZERO_ADDRESS),
  jobRegistry: AddressSchema.default(ZERO_ADDRESS),
  gameOracle: AddressSchema.default(ZERO_ADDRESS),
});
// Note: ContractAddresses type is defined in index.ts with viem's Address type for proper typing

// =============================================================================
// Solana Configuration Schema
// =============================================================================

export const SolanaConfigSchema = z.object({
  mint: z.string().min(32).max(44), // Base58 Solana address
  domainId: ChainIdSchema,
  mailbox: z.string().min(32).max(44),
  rpc: z.string().url().optional(),
  igp: z.string().min(32).max(44).optional(),
});
export type SolanaConfig = z.infer<typeof SolanaConfigSchema>;

// =============================================================================
// Deployment Result Schema
// =============================================================================

export const DeploymentResultSchema = z.object({
  network: z.string(),
  chainId: ChainIdSchema,
  addresses: z.record(z.string(), AddressSchema),
  txHashes: z.array(Bytes32Schema),
});
export type DeploymentResult = z.infer<typeof DeploymentResultSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validates an address string, returning null if invalid
 */
export function parseAddress(value: string | undefined): Address | null {
  if (!value) return null;
  const result = AddressSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Validates an address string, throwing if invalid
 */
export function requireAddress(
  value: string | undefined,
  name: string
): Address {
  if (!value) {
    throw new Error(`${name} is required but not set`);
  }
  const result = AddressSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`${name} has invalid format: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Validates a chain ID from string or number
 */
export function parseChainId(
  value: string | number | undefined
): number | null {
  if (value === undefined) return null;
  const result = ChainIdSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Validates deployment environment
 */
export function parseDeploymentEnv(
  value: string | undefined
): DeploymentEnv | null {
  if (!value) return null;
  const result = DeploymentEnvSchema.safeParse(value);
  return result.success ? result.data : null;
}
