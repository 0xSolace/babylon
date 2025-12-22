/**
 * Zod Schemas for Runtime Validation
 *
 * Provides type-safe validation for configuration, state, and encrypted data.
 */

import type { Address, Hex } from 'viem';
import { z } from 'zod';

// ============================================================================
// Primitive Schemas
// ============================================================================

export const HexSchema = z
  .string()
  .startsWith('0x')
  .refine((val): val is Hex => /^0x[a-fA-F0-9]*$/.test(val), {
    message: 'Invalid hex string',
  }) as z.ZodType<Hex>;

export const AddressSchema = z
  .string()
  .regex(
    /^0x[a-fA-F0-9]{40}$/,
    'Invalid Ethereum address'
  ) as z.ZodType<Address>;

export const ChainIdSchema = z.enum(['mainnet', 'sepolia', 'localhost']);

// ============================================================================
// Encrypted Payload Schemas
// ============================================================================

export const EncryptedPayloadSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  alg: z.literal('AES-256-GCM'),
});

export const SealedDataSchema = z.object({
  payload: EncryptedPayloadSchema,
  version: z.number().int().positive(),
  label: z.string().min(1),
});

// ============================================================================
// Configuration Schemas
// ============================================================================

export const EnclaveConfigSchema = z.object({
  codeHash: HexSchema,
  instanceId: z.string().min(1),
  verbose: z.boolean().optional(),
});

export const BootstrapConfigSchema = z.object({
  privateKey: HexSchema,
  contractAddress: AddressSchema,
  chainId: ChainIdSchema.default('localhost'),
  rpcUrl: z.string().url().optional(),
  ipfsProvider: z.enum(['local', 'infura', 'pinata']).optional(),
  ipfsProjectId: z.string().optional(),
  ipfsProjectSecret: z.string().optional(),
  gameCodeHash: HexSchema.optional(),
  instanceId: z.string().optional(),
  trainingBatchSize: z.number().int().positive().optional(),
  trainingEpochs: z.number().int().positive().optional(),
  heartbeatIntervalMs: z.number().int().positive().optional(),
  useSimulatedIPFS: z.boolean().optional(),
});

// ============================================================================
// Agent State Schemas
// ============================================================================

export const AgentStateSchema = z.object({
  inputWeights: z.array(z.array(z.number())),
  hiddenWeights: z.array(z.array(z.number())),
  bias1: z.array(z.number()),
  bias2: z.array(z.number()),
  epoch: z.number().int().min(0),
  totalSamples: z.number().int().min(0),
  averageLoss: z.number().min(0),
});

export const GameStatsSchema = z.object({
  totalSessions: z.number().int().min(0),
  playerWins: z.number().int().min(0),
  agentWins: z.number().int().min(0),
});

export const TrainingStatsSchema = z.object({
  totalCycles: z.number().int().min(0),
  currentLoss: z.number().min(0),
});

// ============================================================================
// Saved Game State Schema (for IPFS persistence)
// ============================================================================

export const SavedGameStateSchema = z.object({
  agent: AgentStateSchema,
  gameStats: GameStatsSchema,
  trainingStats: TrainingStatsSchema,
  version: z.number().int().positive(),
  timestamp: z.number().int().positive(),
});

// ============================================================================
// Training Data Schema
// ============================================================================

export const TrainingSampleSchema = z.object({
  input: z.array(z.number()),
  target: z.array(z.number()),
  timestamp: z.number().int().positive(),
});

export const TrainingDatasetSchema = z.object({
  epoch: z.number().int().positive(),
  timestamp: z.number().int().positive(),
  samples: z.array(z.record(z.string(), z.number().or(z.array(z.number())))),
});

// ============================================================================
// Contract Governance Schemas
// ============================================================================

export const ProposalParamsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

// ============================================================================
// Type exports for schema inference
// ============================================================================

export type ValidatedBootstrapConfig = z.infer<typeof BootstrapConfigSchema>;
export type ValidatedEnclaveConfig = z.infer<typeof EnclaveConfigSchema>;
export type ValidatedSealedData = z.infer<typeof SealedDataSchema>;
export type ValidatedSavedGameState = z.infer<typeof SavedGameStateSchema>;
export type ValidatedTrainingDataset = z.infer<typeof TrainingDatasetSchema>;
export type ValidatedProposalParams = z.infer<typeof ProposalParamsSchema>;
