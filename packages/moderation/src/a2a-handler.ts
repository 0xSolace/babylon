/**
 * @fileoverview A2A Protocol handler for moderation methods
 * @module @babylon/moderation/a2a-handler
 *
 * Provides A2A-compatible handlers for agents to interact with
 * the Jeju moderation marketplace.
 */

import type { JsonRpcRequest, JsonRpcResponse } from '@babylon/a2a'
import type { JsonRpcResult } from '@babylon/shared'
import { isObject, isPlainObject } from '@jejunetwork/shared'
import { type Address, isHex, zeroHash } from 'viem'
import { ModerationClient } from './client'

/**
 * Type helper to cast validated address strings to Address type
 * Used because zod's .refine() type predicate doesn't always propagate in TypeScript
 */
function toAddress(addr: string): Address {
  return addr as Address
}

/**
 * Type helper to cast validated bytes32 strings to 0x-prefixed type
 */
function toBytes32(bytes: string): `0x${string}` {
  return bytes as `0x${string}`
}

/**
 * Convert evidence string to a proper bytes32 hex string
 */
function evidenceToBytes32(evidence: string): `0x${string}` {
  const hex = Buffer.from(evidence).toString('hex').padEnd(64, '0').slice(0, 64)
  const result = `0x${hex}`
  if (!isHex(result)) {
    throw new Error('Failed to convert evidence to bytes32')
  }
  return result
}

/**
 * Safely extract params record from JsonRpcRequest params
 */
function extractParamsRecord(
  params: JsonRpcRequest['params'],
): Record<string, unknown> {
  if (!params) return {}
  if (isObject(params)) return params
  return {}
}

/**
 * Type-safe result wrapper - converts handler results to JsonRpcResult
 */
function wrapResult(result: unknown): JsonRpcResult {
  // JsonRpcResult accepts JsonValue types - objects, arrays, primitives
  if (result === null || result === undefined) return null
  // All our handlers return serializable objects/primitives
  // This is a safe cast as we control all handler return types
  if (isPlainObject(result) || Array.isArray(result)) {
    return result as JsonRpcResult
  }
  if (
    typeof result === 'string' ||
    typeof result === 'number' ||
    typeof result === 'boolean'
  ) {
    return result
  }
  return null
}

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
} from './schemas'
import type { BanCase, JejuModerationConfig } from './types'
import { BanStatus, VotePosition } from './types'

type ModerationHandler = (
  client: ModerationClient,
  params: Record<string, unknown>,
) => Promise<unknown>

const handlers: Record<string, ModerationHandler> = {
  'moderation.getBanStatus': async (client, params) => {
    const { address, appId } = GetBanStatusParamsSchema.parse(params)

    const isBanned = await client.isBanned(
      toAddress(address),
      appId ? toBytes32(appId) : undefined,
    )
    const activeCase = await client.getActiveCase(toAddress(address))

    let banCase: BanCase | null = null
    if (activeCase) {
      banCase = await client.getCase(activeCase)
    }

    return {
      status: banCase?.status ?? (isBanned ? BanStatus.BANNED : BanStatus.NONE),
      reason: banCase?.reason,
      caseId: activeCase,
    }
  },

  'moderation.proposeBan': async (client, params) => {
    const { targetAddress, reason, evidence } =
      ProposeBanParamsSchema.parse(params)

    const evidenceHash = evidence ? evidenceToBytes32(evidence) : zeroHash

    const txRequest = client.buildOpenCaseRequest(
      toAddress(targetAddress),
      reason,
      evidenceHash,
    )

    return {
      type: 'transaction_request',
      txRequest,
      message: 'Submit this transaction to open a ban case',
    }
  },

  'moderation.challengeBan': async (client, params) => {
    const { caseId, stakeAmount } = ChallengeBanParamsSchema.parse(params)

    const txRequest = client.buildChallengeCaseRequest(
      toBytes32(caseId),
      BigInt(stakeAmount),
    )

    return {
      type: 'transaction_request',
      txRequest,
      message: 'Submit this transaction to challenge the ban case',
    }
  },

  'moderation.vote': async (client, params) => {
    const { caseId, position } = VoteParamsSchema.parse(params)
    const positionNum = position === 'yes' ? VotePosition.YES : VotePosition.NO

    const txRequest = client.buildVoteRequest(toBytes32(caseId), positionNum)

    return {
      type: 'transaction_request',
      txRequest,
      message: 'Submit this transaction to vote on the case',
    }
  },

  'moderation.getActiveCases': async (client, params) => {
    const { limit = 10, offset = 0 } = GetActiveCasesParamsSchema.parse(params)

    const allCaseIds = await client.getAllCaseIds()
    const paginatedIds = allCaseIds.slice(offset, offset + limit)

    const cases = await Promise.all(
      paginatedIds.map((id) => client.getCase(id)),
    )

    const activeCases = cases.filter((c) => !c.resolved)

    return {
      cases: activeCases,
      total: allCaseIds.length,
    }
  },

  'moderation.getCase': async (client, params) => {
    const { caseId } = GetCaseParamsSchema.parse(params)
    return client.getCase(toBytes32(caseId))
  },

  'moderation.getStake': async (client, params) => {
    const { address } = GetStakeParamsSchema.parse(params)
    return client.getStake(toAddress(address))
  },

  'moderation.canReport': async (client, params) => {
    const { address } = CanReportParamsSchema.parse(params)
    return { canReport: await client.canReport(toAddress(address)) }
  },

  'moderation.stake': async (client, params) => {
    const { amount } = StakeParamsSchema.parse(params)
    const txRequest = client.buildStakeRequest(BigInt(amount))
    return { type: 'transaction_request', txRequest }
  },

  'moderation.unstake': async (client, params) => {
    const { amount } = UnstakeParamsSchema.parse(params)
    const txRequest = client.buildUnstakeRequest(BigInt(amount))
    return { type: 'transaction_request', txRequest }
  },

  'moderation.resolveCase': async (client, params) => {
    const { caseId } = ResolveCaseParamsSchema.parse(params)
    const txRequest = client.buildResolveCaseRequest(toBytes32(caseId))
    return { type: 'transaction_request', txRequest }
  },

  'moderation.requestReReview': async (client, params) => {
    const { caseId, stakeAmount } = ReReviewParamsSchema.parse(params)
    const txRequest = client.buildReReviewRequest(
      toBytes32(caseId),
      BigInt(stakeAmount),
    )
    return { type: 'transaction_request', txRequest }
  },

  'moderation.claimRewards': async (client, params) => {
    const { caseId } = ClaimRewardsParamsSchema.parse(params)
    const txRequest = client.buildClaimRewardsRequest(toBytes32(caseId))
    return { type: 'transaction_request', txRequest }
  },
}

/**
 * Create an A2A handler for moderation methods
 */
export function createModerationA2AHandler(config: JejuModerationConfig) {
  const client = new ModerationClient(config)

  return async (request: JsonRpcRequest): Promise<JsonRpcResponse> => {
    const { method, params = {}, id } = request

    if (!method.startsWith('moderation.')) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
        id,
      }
    }

    const handler = handlers[method]
    if (!handler) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Unknown moderation method: ${method}`,
        },
        id,
      }
    }

    const paramsRecord = extractParamsRecord(params)
    const result = await handler(client, paramsRecord)
    return {
      jsonrpc: '2.0',
      result: wrapResult(result),
      id,
    }
  }
}

/**
 * Get the list of supported moderation methods
 */
export function _getSupportedModerationMethods(): string[] {
  return Object.keys(handlers)
}
