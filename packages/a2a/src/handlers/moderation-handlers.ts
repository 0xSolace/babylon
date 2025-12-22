/**
 * @fileoverview A2A handlers for moderation operations
 * @module @babylon/a2a/handlers/moderation
 *
 * Handles moderation-related A2A requests including:
 * - Ban proposals and challenges
 * - Voting on moderation cases
 * - Ban status queries
 * - Stake management
 */

import type { JsonValue } from '@babylon/shared';
import { z } from 'zod';

// Types matching Jeju ModerationMarketplace
export enum BanStatus {
  NONE = 0,
  ON_NOTICE = 1,
  CHALLENGED = 2,
  BANNED = 3,
  CLEARED = 4,
  APPEALING = 5,
}

export enum VotePosition {
  YES = 0,
  NO = 1,
}

// Zod schemas for moderation parameters
export const GetBanStatusParamsSchema = z.object({
  address: z.string().min(1),
});

export const ProposeBanParamsSchema = z.object({
  targetAddress: z.string().min(1),
  reason: z.string().min(1),
  category: z.string().min(1),
  evidence: z.string().optional(),
});

export const ChallengeBanParamsSchema = z.object({
  caseId: z.string().min(1),
  stakeAmount: z.string().min(1),
});

export const VoteParamsSchema = z.object({
  caseId: z.string().min(1),
  position: z.enum(['yes', 'no']),
});

export const GetActiveCasesParamsSchema = z.object({
  limit: z.number().optional().default(10),
  offset: z.number().optional().default(0),
});

export const GetStakeParamsSchema = z.object({
  address: z.string().min(1),
});

// Inferred types from schemas
export type GetBanStatusParams = z.infer<typeof GetBanStatusParamsSchema>;
export type ProposeBanParams = z.infer<typeof ProposeBanParamsSchema>;
export type ChallengeBanParams = z.infer<typeof ChallengeBanParamsSchema>;
export type VoteParams = z.infer<typeof VoteParamsSchema>;
export type GetActiveCasesParams = z.infer<typeof GetActiveCasesParamsSchema>;
export type GetStakeParams = z.infer<typeof GetStakeParamsSchema>;

export interface ModerationRequest {
  method: string;
  params: Record<string, JsonValue>;
}

export interface ModerationResponse {
  success: boolean;
  data?: JsonValue;
  error?: string;
}

// Handler function type
type ModerationHandler = (
  params: Record<string, JsonValue>
) => Promise<ModerationResponse>;

// Handler registry
const handlers: Record<string, ModerationHandler> = {};

/**
 * Register a moderation handler
 */
export function registerModerationHandler(
  method: string,
  handler: ModerationHandler
): void {
  handlers[method] = handler;
}

/**
 * Handle a moderation request
 */
export async function handleModerationRequest(
  request: ModerationRequest
): Promise<ModerationResponse> {
  const handler = handlers[request.method];

  if (!handler) {
    return {
      success: false,
      error: `Unknown moderation method: ${request.method}`,
    };
  }

  return handler(request.params);
}

/**
 * Get list of supported moderation methods
 */
export function getSupportedModerationMethods(): string[] {
  return Object.keys(handlers);
}

// Default handlers (stubs that can be overridden with actual implementations)

registerModerationHandler('moderation.getBanStatus', async (params) => {
  const validated = GetBanStatusParamsSchema.parse(params);
  // This would be implemented by the application using the ModerationClient
  return {
    success: true,
    data: {
      address: validated.address,
      status: BanStatus.NONE,
      message: 'Ban status check requires ModerationClient configuration',
    },
  };
});

registerModerationHandler('moderation.proposeBan', async (params) => {
  const validated = ProposeBanParamsSchema.parse(params);

  return {
    success: false,
    error:
      'Ban proposals require staking. Configure ModerationClient to enable.',
    data: {
      targetAddress: validated.targetAddress,
      reason: validated.reason,
      category: validated.category,
      evidence: validated.evidence ?? null,
    },
  };
});

registerModerationHandler('moderation.challengeBan', async (params) => {
  const validated = ChallengeBanParamsSchema.parse(params);

  return {
    success: false,
    error: 'Challenge requires staking. Configure ModerationClient to enable.',
    data: { caseId: validated.caseId, stakeAmount: validated.stakeAmount },
  };
});

registerModerationHandler('moderation.vote', async (params) => {
  const validated = VoteParamsSchema.parse(params);

  return {
    success: false,
    error: 'Voting requires staking. Configure ModerationClient to enable.',
    data: { caseId: validated.caseId, position: validated.position },
  };
});

registerModerationHandler('moderation.getActiveCases', async (params) => {
  const validated = GetActiveCasesParamsSchema.parse(params);

  return {
    success: true,
    data: {
      cases: [],
      total: 0,
      limit: validated.limit,
      offset: validated.offset,
      message: 'Active cases query requires ModerationClient configuration',
    },
  };
});

registerModerationHandler('moderation.getStake', async (params) => {
  const validated = GetStakeParamsSchema.parse(params);

  return {
    success: true,
    data: {
      address: validated.address,
      amount: '0',
      isStaked: false,
      canReport: false,
      message: 'Stake query requires ModerationClient configuration',
    },
  };
});

/**
 * Check if a method is a moderation method
 */
export function isModerationMethod(method: string): boolean {
  return method.startsWith('moderation.');
}

/**
 * Moderation method categories for documentation
 */
export const MODERATION_METHOD_CATEGORIES = {
  query: [
    'moderation.getBanStatus',
    'moderation.getActiveCases',
    'moderation.getCase',
    'moderation.getStake',
    'moderation.canReport',
  ],
  action: [
    'moderation.proposeBan',
    'moderation.challengeBan',
    'moderation.vote',
    'moderation.resolveCase',
    'moderation.requestReReview',
    'moderation.claimRewards',
  ],
  stake: ['moderation.stake', 'moderation.unstake'],
} as const;
