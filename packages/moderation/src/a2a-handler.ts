/**
 * @fileoverview A2A Protocol handler for moderation methods
 * @module @babylon/moderation/a2a-handler
 *
 * Provides A2A-compatible handlers for agents to interact with
 * the Jeju moderation marketplace.
 */

import type { Address } from 'viem';
import { ModerationClient } from './client';
import type { BanCase, JejuModerationConfig, VotePosition } from './types';

interface A2ARequest {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
  id: string | number;
}

interface A2AResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number;
}

type ModerationHandler = (
  client: ModerationClient,
  params: Record<string, unknown>
) => Promise<unknown>;

const handlers: Record<string, ModerationHandler> = {
  'moderation.getBanStatus': async (client, params) => {
    const address = params.address as Address;
    const appId = params.appId as `0x${string}` | undefined;

    const isBanned = await client.isBanned(address, appId);
    const activeCase = await client.getActiveCase(address);

    let banCase: BanCase | null = null;
    if (activeCase) {
      banCase = await client.getCase(activeCase);
    }

    return {
      status: banCase?.status ?? (isBanned ? 3 : 0), // BANNED = 3, NONE = 0
      reason: banCase?.reason,
      caseId: activeCase,
    };
  },

  'moderation.proposeBan': async (client, params) => {
    const targetAddress = params.targetAddress as Address;
    const reason = params.reason as string;
    const evidence = params.evidence as string | undefined;

    // Convert evidence to bytes32 hash if provided
    const evidenceHash = evidence
      ? (`0x${Buffer.from(evidence).toString('hex').padEnd(64, '0').slice(0, 64)}` as `0x${string}`)
      : ('0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`);

    // Return transaction request for the caller to submit
    const txRequest = client.buildOpenCaseRequest(
      targetAddress,
      reason,
      evidenceHash
    );

    return {
      type: 'transaction_request',
      txRequest,
      message: 'Submit this transaction to open a ban case',
    };
  },

  'moderation.challengeBan': async (client, params) => {
    const caseId = params.caseId as `0x${string}`;
    const stakeAmount = BigInt(params.stakeAmount as string);

    const txRequest = client.buildChallengeCaseRequest(caseId, stakeAmount);

    return {
      type: 'transaction_request',
      txRequest,
      message: 'Submit this transaction to challenge the ban case',
    };
  },

  'moderation.vote': async (client, params) => {
    const caseId = params.caseId as `0x${string}`;
    const position = params.position === 'yes' ? 0 : 1; // YES = 0, NO = 1

    const txRequest = client.buildVoteRequest(caseId, position as VotePosition);

    return {
      type: 'transaction_request',
      txRequest,
      message: 'Submit this transaction to vote on the case',
    };
  },

  'moderation.getActiveCases': async (client, params) => {
    const limit = (params.limit as number) ?? 10;
    const offset = (params.offset as number) ?? 0;

    const allCaseIds = await client.getAllCaseIds();
    const paginatedIds = allCaseIds.slice(offset, offset + limit);

    const cases = await Promise.all(
      paginatedIds.map((id) => client.getCase(id))
    );

    // Filter to only active (unresolved) cases
    const activeCases = cases.filter((c) => !c.resolved);

    return {
      cases: activeCases,
      total: allCaseIds.length,
    };
  },

  'moderation.getCase': async (client, params) => {
    const caseId = params.caseId as `0x${string}`;
    return client.getCase(caseId);
  },

  'moderation.getStake': async (client, params) => {
    const address = params.address as Address;
    return client.getStake(address);
  },

  'moderation.canReport': async (client, params) => {
    const address = params.address as Address;
    return { canReport: await client.canReport(address) };
  },

  'moderation.stake': async (client, params) => {
    const amount = BigInt(params.amount as string);
    const txRequest = client.buildStakeRequest(amount);
    return { type: 'transaction_request', txRequest };
  },

  'moderation.unstake': async (client, params) => {
    const amount = BigInt(params.amount as string);
    const txRequest = client.buildUnstakeRequest(amount);
    return { type: 'transaction_request', txRequest };
  },

  'moderation.resolveCase': async (client, params) => {
    const caseId = params.caseId as `0x${string}`;
    const txRequest = client.buildResolveCaseRequest(caseId);
    return { type: 'transaction_request', txRequest };
  },

  'moderation.requestReReview': async (client, params) => {
    const caseId = params.caseId as `0x${string}`;
    const stakeAmount = BigInt(params.stakeAmount as string);
    const txRequest = client.buildReReviewRequest(caseId, stakeAmount);
    return { type: 'transaction_request', txRequest };
  },

  'moderation.claimRewards': async (client, params) => {
    const caseId = params.caseId as `0x${string}`;
    const txRequest = client.buildClaimRewardsRequest(caseId);
    return { type: 'transaction_request', txRequest };
  },
};

/**
 * Create an A2A handler for moderation methods
 */
export function createModerationA2AHandler(config: JejuModerationConfig) {
  const client = new ModerationClient(config);

  return async (request: A2ARequest): Promise<A2AResponse> => {
    const { method, params, id } = request;

    // Check if this is a moderation method
    if (!method.startsWith('moderation.')) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
        id,
      };
    }

    const handler = handlers[method];
    if (!handler) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Unknown moderation method: ${method}`,
        },
        id,
      };
    }

    try {
      const result = await handler(client, params);
      return {
        jsonrpc: '2.0',
        result,
        id,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: errorMessage,
          data: error,
        },
        id,
      };
    }
  };
}

/**
 * Get the list of supported moderation methods
 */
export function getSupportedModerationMethods(): string[] {
  return Object.keys(handlers);
}
