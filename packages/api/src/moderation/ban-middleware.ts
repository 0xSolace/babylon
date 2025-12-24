/**
 * Ban Check Middleware
 *
 * Provides middleware and utilities for checking ban status on API requests.
 * Integrates with Jeju's BanManager for on-chain ban enforcement.
 *
 * Usage:
 * - Use `requireNotBanned` as a wrapper for API handlers
 * - Use `checkBanStatus` for manual ban checking
 * - Ban status is cached briefly to avoid excessive on-chain calls
 */

import { logger } from '@babylon/shared'
import type { Address } from 'viem'
import {
  type BanCheckResult,
  BanType,
  checkBabylonAccess,
} from './ban-manager-client'

// Cache ban status for 30 seconds to avoid excessive on-chain calls
const banStatusCache = new Map<
  string,
  { result: BanCheckResult; timestamp: number }
>()
const BAN_CACHE_TTL_MS = 30_000

/**
 * Check ban status with caching
 */
export async function checkBanStatus(
  walletAddress?: Address,
  agentId?: bigint,
): Promise<BanCheckResult> {
  // Build cache key
  const cacheKey = `${walletAddress ?? 'none'}:${agentId?.toString() ?? 'none'}`

  // Check cache
  const cached = banStatusCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < BAN_CACHE_TTL_MS) {
    return cached.result
  }

  // Query on-chain ban status
  const result = await checkBabylonAccess(walletAddress, agentId)

  // Cache result
  banStatusCache.set(cacheKey, { result, timestamp: Date.now() })

  return result
}

/**
 * Clear ban cache for a specific user (call after ban/unban events)
 */
export function clearBanCache(walletAddress?: Address, agentId?: bigint): void {
  const cacheKey = `${walletAddress ?? 'none'}:${agentId?.toString() ?? 'none'}`
  banStatusCache.delete(cacheKey)
}

/**
 * Clear entire ban cache
 */
export function clearAllBanCache(): void {
  banStatusCache.clear()
}

/**
 * Ban check result for API responses
 */
export interface BanErrorResponse {
  success: false
  error: string
  code: 'BANNED' | 'ON_NOTICE'
  reason?: string
  banType?: string
  caseId?: string
}

/**
 * Create a ban error response
 */
export function createBanErrorResponse(
  result: BanCheckResult,
): BanErrorResponse {
  const banTypeString =
    result.banType !== undefined ? BanType[result.banType] : undefined
  const isPermanent = result.banType === BanType.PERMANENT

  return {
    success: false,
    error: isPermanent
      ? 'Your account has been banned from Babylon'
      : 'Your account is currently under review',
    code: isPermanent ? 'BANNED' : 'ON_NOTICE',
    reason: result.reason,
    banType: banTypeString,
    caseId: result.caseId,
  }
}

/**
 * Check if ban manager is configured
 */
export function isBanManagerConfigured(): boolean {
  return !!process.env.BAN_MANAGER_ADDRESS
}

/**
 * Wrapper to require that a user is not banned
 * Use this to wrap API handlers that require authenticated users
 *
 * @example
 * ```typescript
 * export const POST = withErrorHandling(
 *   requireNotBanned(async (request: Request) => {
 *     const authUser = await authenticate(request);
 *     // Handler logic...
 *   })
 * );
 * ```
 */
export function requireNotBanned<
  T extends (...args: unknown[]) => Promise<Response>,
>(handler: T): T {
  return (async (...args: unknown[]) => {
    // If ban manager is not configured, skip ban check (dev mode)
    if (!isBanManagerConfigured()) {
      return handler(...args)
    }

    // Extract wallet address from the request
    // This assumes the first argument is a Request-like object
    const request = args[0] as { headers: Headers }
    const walletAddress = extractWalletFromRequest(request)

    if (walletAddress) {
      const banResult = await checkBanStatus(walletAddress as Address)
      if (!banResult.allowed) {
        logger.warn(
          'Banned user attempted access',
          { walletAddress },
          'BanMiddleware',
        )
        const errorResponse = createBanErrorResponse(banResult)
        return new Response(JSON.stringify(errorResponse), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    return handler(...args)
  }) as T
}

/**
 * Extract wallet address from request headers
 * This is a simplified version - in practice, you'd use the full auth flow
 */
function extractWalletFromRequest(request: {
  headers: Headers
}): string | undefined {
  // Check for wallet in various places
  // 1. X-Wallet-Address header (for server-to-server)
  const headerWallet = request.headers.get('x-wallet-address')
  if (headerWallet?.startsWith('0x')) {
    return headerWallet
  }

  // 2. From authorization token (would need to decode JWT)
  // This is handled by the auth middleware typically

  return undefined
}

/**
 * Middleware for checking agent bans specifically
 */
export async function checkAgentBan(agentId: bigint): Promise<BanCheckResult> {
  return checkBanStatus(undefined, agentId)
}

/**
 * Check if a user can perform moderation actions (report, vote)
 * Users on notice or banned cannot participate in moderation
 */
export async function canParticipateInModeration(
  walletAddress: Address,
): Promise<boolean> {
  const result = await checkBanStatus(walletAddress)
  return result.allowed
}
