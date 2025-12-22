/**
 * @fileoverview Zod schemas for moderation system validation
 * @module @babylon/moderation/schemas
 */

import type { Address } from 'viem';
import { z } from 'zod';

// ============================================================================
// Primitive Schemas
// ============================================================================

export const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .transform((val) => val as Address);
export const Bytes32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/)
  .transform((val) => val as `0x${string}`);

// ============================================================================
// Enum Schemas
// ============================================================================

export const BanStatusSchema = z.enum([
  'NONE',
  'ON_NOTICE',
  'CHALLENGED',
  'BANNED',
  'CLEARED',
  'APPEALING',
]);

export const VotePositionSchema = z.enum(['yes', 'no']);

export const ReportCategorySchema = z.enum([
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'misinformation',
  'inappropriate',
  'impersonation',
  'self_harm',
  'csam',
  'illegal',
  'other',
]);

// ============================================================================
// A2A Method Parameter Schemas
// ============================================================================

export const GetBanStatusParamsSchema = z.object({
  address: AddressSchema,
  appId: Bytes32Schema.optional(),
});

export const ProposeBanParamsSchema = z.object({
  targetAddress: AddressSchema,
  reason: z.string().min(1).max(1000),
  category: ReportCategorySchema,
  evidence: z.string().optional(),
});

export const ChallengeBanParamsSchema = z.object({
  caseId: Bytes32Schema,
  stakeAmount: z.string().min(1),
});

export const VoteParamsSchema = z.object({
  caseId: Bytes32Schema,
  position: VotePositionSchema,
});

export const GetActiveCasesParamsSchema = z.object({
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export const GetCaseParamsSchema = z.object({
  caseId: Bytes32Schema,
});

export const GetStakeParamsSchema = z.object({
  address: AddressSchema,
});

export const CanReportParamsSchema = z.object({
  address: AddressSchema,
});

export const StakeParamsSchema = z.object({
  amount: z.string().min(1),
});

export const UnstakeParamsSchema = z.object({
  amount: z.string().min(1),
});

export const ResolveCaseParamsSchema = z.object({
  caseId: Bytes32Schema,
});

export const ReReviewParamsSchema = z.object({
  caseId: Bytes32Schema,
  stakeAmount: z.string().min(1),
});

export const ClaimRewardsParamsSchema = z.object({
  caseId: Bytes32Schema,
});

// ============================================================================
// Config Schema
// ============================================================================

export const JejuModerationConfigSchema = z.object({
  moderationMarketplace: AddressSchema,
  banManager: AddressSchema,
  identityRegistry: AddressSchema,
  chainId: z.number().int().positive(),
  rpcUrl: z.string().url(),
});

// ============================================================================
// Type exports (inferred from schemas)
// ============================================================================

export type GetBanStatusParams = z.infer<typeof GetBanStatusParamsSchema>;
export type ProposeBanParams = z.infer<typeof ProposeBanParamsSchema>;
export type ChallengeBanParams = z.infer<typeof ChallengeBanParamsSchema>;
export type VoteParams = z.infer<typeof VoteParamsSchema>;
export type GetActiveCasesParams = z.infer<typeof GetActiveCasesParamsSchema>;
export type GetCaseParams = z.infer<typeof GetCaseParamsSchema>;
export type GetStakeParams = z.infer<typeof GetStakeParamsSchema>;
export type CanReportParams = z.infer<typeof CanReportParamsSchema>;
export type StakeParams = z.infer<typeof StakeParamsSchema>;
export type UnstakeParams = z.infer<typeof UnstakeParamsSchema>;
export type ResolveCaseParams = z.infer<typeof ResolveCaseParamsSchema>;
export type ReReviewParams = z.infer<typeof ReReviewParamsSchema>;
export type ClaimRewardsParams = z.infer<typeof ClaimRewardsParamsSchema>;
