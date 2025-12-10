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

export interface ModerationRequest {
  method: string;
  params: Record<string, unknown>;
}

export interface ModerationResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Handler function type
type ModerationHandler = (
  params: Record<string, unknown>
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
  const address = params.address as string;
  // This would be implemented by the application using the ModerationClient
  return {
    success: true,
    data: {
      address,
      status: BanStatus.NONE,
      message: 'Ban status check requires ModerationClient configuration',
    },
  };
});

registerModerationHandler('moderation.proposeBan', async (params) => {
  const { targetAddress, reason, category, evidence } = params as {
    targetAddress: string;
    reason: string;
    category: string;
    evidence?: string;
  };

  return {
    success: false,
    error:
      'Ban proposals require staking. Configure ModerationClient to enable.',
    data: { targetAddress, reason, category, evidence },
  };
});

registerModerationHandler('moderation.challengeBan', async (params) => {
  const { caseId, stakeAmount } = params as {
    caseId: string;
    stakeAmount: string;
  };

  return {
    success: false,
    error: 'Challenge requires staking. Configure ModerationClient to enable.',
    data: { caseId, stakeAmount },
  };
});

registerModerationHandler('moderation.vote', async (params) => {
  const { caseId, position } = params as {
    caseId: string;
    position: 'yes' | 'no';
  };

  return {
    success: false,
    error: 'Voting requires staking. Configure ModerationClient to enable.',
    data: { caseId, position },
  };
});

registerModerationHandler('moderation.getActiveCases', async (params) => {
  const { limit = 10, offset = 0 } = params as {
    limit?: number;
    offset?: number;
  };

  return {
    success: true,
    data: {
      cases: [],
      total: 0,
      limit,
      offset,
      message: 'Active cases query requires ModerationClient configuration',
    },
  };
});

registerModerationHandler('moderation.getStake', async (params) => {
  const address = params.address as string;

  return {
    success: true,
    data: {
      address,
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
