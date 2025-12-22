/**
 * @fileoverview A2A Protocol handler for moderation methods
 * @module @babylon/moderation/a2a-handler
 *
 * Provides A2A-compatible handlers for agents to interact with
 * the Jeju moderation marketplace.
 */

import type { JsonRpcRequest, JsonRpcResponse } from '@babylon/a2a';
import type { JsonRpcResult } from '@babylon/shared';
import { zeroHash } from 'viem';
import { ModerationClient } from './client';
import {
  CanReportParamsSchema,
  ChallengeBanParamsSchema,
  ClaimRewardsParamsSchema,
  GetActiveCasesParamsSchema,
  GetBanStatusParamsSchema,
  GetCaseParamsSchema,
  GetStakeParamsSchema,
  ProposeBanParamsSchema,
  ReReviewParamsSchema,
  ResolveCaseParamsSchema,
  StakeParamsSchema,
  UnstakeParamsSchema,
  VoteParamsSchema,
} from './schemas';
import type { BanCase, JejuModerationConfig, VotePosition } from './types';
import { BanStatus, VotePosition as VP } from './types';

type ModerationHandler = (
  client: ModerationClient,
  params: Record<string, unknown>
) => Promise<unknown>;

const handlers: Record<string, ModerationHandler> = {
  'moderation.getBanStatus': async (client, params) => {
    const { address, appId } = GetBanStatusParamsSchema.parse(params);

    const isBanned = await client.isBanned(address, appId);
    const activeCase = await client.getActiveCase(address);

    let banCase: BanCase | null = null;
    if (activeCase) {
      banCase = await client.getCase(activeCase);
    }

    return {
      status: banCase?.status ?? (isBanned ? BanStatus.BANNED : BanStatus.NONE),
      reason: banCase?.reason,
      caseId: activeCase,
    };
  },

  'moderation.proposeBan': async (client, params) => {
    const { targetAddress, reason, evidence } =
      ProposeBanParamsSchema.parse(params);

    // Convert evidence to bytes32 hash if provided
    const evidenceHash = evidence
      ? (`0x${Buffer.from(evidence).toString('hex').padEnd(64, '0').slice(0, 64)}` as `0x${string}`)
      : zeroHash;

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
    const { caseId, stakeAmount } = ChallengeBanParamsSchema.parse(params);

    const txRequest = client.buildChallengeCaseRequest(
      caseId,
      BigInt(stakeAmount)
    );

    return {
      type: 'transaction_request',
      txRequest,
      message: 'Submit this transaction to challenge the ban case',
    };
  },

  'moderation.vote': async (client, params) => {
    const { caseId, position } = VoteParamsSchema.parse(params);
    const positionNum = position === 'yes' ? VP.YES : VP.NO;

    const txRequest = client.buildVoteRequest(
      caseId,
      positionNum as VotePosition
    );

    return {
      type: 'transaction_request',
      txRequest,
      message: 'Submit this transaction to vote on the case',
    };
  },

  'moderation.getActiveCases': async (client, params) => {
    const { limit = 10, offset = 0 } = GetActiveCasesParamsSchema.parse(params);

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
    const { caseId } = GetCaseParamsSchema.parse(params);
    return client.getCase(caseId);
  },

  'moderation.getStake': async (client, params) => {
    const { address } = GetStakeParamsSchema.parse(params);
    return client.getStake(address);
  },

  'moderation.canReport': async (client, params) => {
    const { address } = CanReportParamsSchema.parse(params);
    return { canReport: await client.canReport(address) };
  },

  'moderation.stake': async (client, params) => {
    const { amount } = StakeParamsSchema.parse(params);
    const txRequest = client.buildStakeRequest(BigInt(amount));
    return { type: 'transaction_request', txRequest };
  },

  'moderation.unstake': async (client, params) => {
    const { amount } = UnstakeParamsSchema.parse(params);
    const txRequest = client.buildUnstakeRequest(BigInt(amount));
    return { type: 'transaction_request', txRequest };
  },

  'moderation.resolveCase': async (client, params) => {
    const { caseId } = ResolveCaseParamsSchema.parse(params);
    const txRequest = client.buildResolveCaseRequest(caseId);
    return { type: 'transaction_request', txRequest };
  },

  'moderation.requestReReview': async (client, params) => {
    const { caseId, stakeAmount } = ReReviewParamsSchema.parse(params);
    const txRequest = client.buildReReviewRequest(caseId, BigInt(stakeAmount));
    return { type: 'transaction_request', txRequest };
  },

  'moderation.claimRewards': async (client, params) => {
    const { caseId } = ClaimRewardsParamsSchema.parse(params);
    const txRequest = client.buildClaimRewardsRequest(caseId);
    return { type: 'transaction_request', txRequest };
  },
};

/**
 * Create an A2A handler for moderation methods
 */
export function createModerationA2AHandler(config: JejuModerationConfig) {
  const client = new ModerationClient(config);

  return async (request: JsonRpcRequest): Promise<JsonRpcResponse> => {
    const { method, params = {}, id } = request;

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

    // Ensure params is a record (not an array)
    const paramsRecord = Array.isArray(params)
      ? {}
      : (params as Record<string, unknown>);
    const result = await handler(client, paramsRecord);
    return {
      jsonrpc: '2.0',
      result: result as JsonRpcResult,
      id,
    };
  };
}

/**
 * Get the list of supported moderation methods
 */
export function getSupportedModerationMethods(): string[] {
  return Object.keys(handlers);
}
