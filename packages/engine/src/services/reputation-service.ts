/**
 * Reputation Service
 *
 * @description Handles on-chain reputation updates based on prediction market
 * outcomes. Winners get +10 reputation, losers get -5 reputation.
 * Also provides an optional interface for syncing reputation to ERC-8004.
 */

import { db, eq, inArray, positions, users } from '@babylon/db'
import {
  createBabylonPublicClient,
  getCurrentRpcUrl,
  logger,
  REPUTATION_SYSTEM_ABI,
  REPUTATION_SYSTEM_BASE_SEPOLIA,
  readContract,
} from '@babylon/shared'
import { type Address, createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

// =============================================================================
// Reputation Sync Interface
// =============================================================================

/**
 * Result of batch reputation sync
 */
export interface ReputationSyncResult {
  synced: number
  failed: number
  total: number
  skipped?: number
}

/**
 * Options for reputation sync
 */
export interface ReputationSyncOptions {
  limit?: number
  offset?: number
  forceRecalculate?: boolean
  prioritizeNew?: boolean
}

/**
 * Reputation sync service interface
 */
export interface ReputationSyncServiceInterface {
  batchSync(options?: ReputationSyncOptions): Promise<ReputationSyncResult>
}

/**
 * Global reputation sync service provider
 */
let reputationSyncService: ReputationSyncServiceInterface | null = null

/**
 * Set the reputation sync service provider
 */
export function setReputationSyncService(
  service: ReputationSyncServiceInterface | null,
): void {
  reputationSyncService = service
}

/**
 * Get the reputation sync service provider
 */
export function getReputationSyncService(): ReputationSyncServiceInterface | null {
  return reputationSyncService
}

/**
 * Sync reputation if service is available
 */
export async function syncReputationIfAvailable(
  options?: ReputationSyncOptions,
): Promise<ReputationSyncResult | null> {
  if (!reputationSyncService) {
    return null
  }
  return await reputationSyncService.batchSync(options)
}

import { getDeployerPrivateKey } from '../config/dev-keys'

// Contract addresses from canonical config
const REPUTATION_SYSTEM = REPUTATION_SYSTEM_BASE_SEPOLIA as Address

/**
 * Market resolution information
 */
interface MarketResolution {
  marketId: string
  outcome: boolean // true = YES, false = NO
}

/**
 * Reputation update result
 */
interface ReputationUpdate {
  userId: string
  tokenId: number
  change: number // +10 or -5
  txHash?: string
  error?: string
}

/**
 * Update reputation for all users who had positions in a resolved market
 */
export async function updateReputationForResolvedMarket(
  resolution: MarketResolution,
): Promise<ReputationUpdate[]> {
  const results: ReputationUpdate[] = []

  // 1. Get all positions for this market
  const positionsData = await db
    .select({
      id: positions.id,
      userId: positions.userId,
      side: positions.side,
      shares: positions.shares,
    })
    .from(positions)
    .where(eq(positions.marketId, resolution.marketId))

  if (positionsData.length === 0) {
    logger.info(
      `No positions found for market ${resolution.marketId}`,
      undefined,
      'ReputationService',
    )
    return []
  }

  // Get user data for all positions
  const userIds: string[] = [
    ...new Set(positionsData.map((p) => String(p.userId))),
  ]
  const usersData = await db
    .select({
      id: users.id,
      nftTokenId: users.nftTokenId,
      onChainRegistered: users.onChainRegistered,
    })
    .from(users)
    .where(inArray(users.id, userIds))

  const userMap = new Map(usersData.map((u) => [String(u.id), u]))

  logger.info(
    `Updating reputation for ${positionsData.length} positions in market ${resolution.marketId}`,
    { count: positionsData.length, marketId: resolution.marketId },
    'ReputationService',
  )

  // 2. Create clients
  const publicClient = createBabylonPublicClient({
    chain: baseSepolia,
    rpcUrl: getCurrentRpcUrl(),
  })

  const account = privateKeyToAccount(getDeployerPrivateKey())
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(getCurrentRpcUrl()),
  })

  // 3. Process each position
  for (const position of positionsData) {
    const positionUserId = String(position.userId)
    const user = userMap.get(positionUserId)

    // Skip if user is not registered on-chain
    if (!user?.onChainRegistered || !user.nftTokenId) {
      results.push({
        userId: positionUserId,
        tokenId: 0,
        change: 0,
        error: 'User not registered on-chain',
      })
      continue
    }

    const tokenId = Number(user.nftTokenId)
    const positionSide = Boolean(position.side)
    const isWinner = positionSide === resolution.outcome
    const sharesAmount = Number(position.shares)
    const amount = parseEther(Math.abs(sharesAmount).toString())

    let txHash: `0x${string}`

    if (isWinner) {
      // Winner: +10 reputation
      logger.info(
        `Recording WIN for token ${tokenId} (+10 reputation)`,
        { tokenId, change: 10 },
        'ReputationService',
      )
      txHash = await walletClient.writeContract({
        address: REPUTATION_SYSTEM,
        abi: REPUTATION_SYSTEM_ABI,
        functionName: 'recordWin',
        args: [BigInt(tokenId), amount],
        chain: baseSepolia,
        account,
      })
    } else {
      // Loser: -5 reputation
      logger.info(
        `Recording LOSS for token ${tokenId} (-5 reputation)`,
        { tokenId, change: -5 },
        'ReputationService',
      )
      txHash = await walletClient.writeContract({
        address: REPUTATION_SYSTEM,
        abi: REPUTATION_SYSTEM_ABI,
        functionName: 'recordLoss',
        args: [BigInt(tokenId), amount],
        chain: baseSepolia,
        account,
      })
    }

    // Wait for transaction confirmation
    await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    })

    results.push({
      userId: positionUserId,
      tokenId,
      change: isWinner ? 10 : -5,
      txHash,
    })

    logger.info(
      `Updated reputation for token ${tokenId}`,
      { tokenId, txHash, change: isWinner ? 10 : -5 },
      'ReputationService',
    )
  }

  return results
}

/**
 * Get current on-chain reputation for a user
 */
export async function getOnChainReputation(
  userId: string,
): Promise<number | null> {
  // Get user's NFT token ID
  const [user] = await db
    .select({
      nftTokenId: users.nftTokenId,
      onChainRegistered: users.onChainRegistered,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user || !user.onChainRegistered || !user.nftTokenId) {
    return null
  }

  // Query on-chain reputation
  const publicClient = createBabylonPublicClient({
    chain: baseSepolia,
    rpcUrl: getCurrentRpcUrl(),
  })

  const reputation = await readContract(publicClient, {
    address: REPUTATION_SYSTEM,
    abi: REPUTATION_SYSTEM_ABI,
    functionName: 'getReputation',
    args: [BigInt(Number(user.nftTokenId))],
  })

  // Reputation returns tuple: [totalBets, winningBets, totalVolume, profitLoss, accuracyScore, trustScore, isBanned]
  // We want trustScore (index 5) which is 0-10000 scale (divide by 100 to get 0-100)
  const trustScore = Number(reputation[5])
  return Math.floor(trustScore / 100) // Convert from 0-10000 to 0-100
}

/**
 * Sync database reputation with on-chain reputation
 */
export async function syncUserReputation(
  userId: string,
): Promise<number | null> {
  const onChainReputation = await getOnChainReputation(userId)

  if (onChainReputation === null) {
    return null
  }

  return onChainReputation
}

/**
 * Batch update reputation for multiple market resolutions
 */
export async function batchUpdateReputation(
  resolutions: MarketResolution[],
): Promise<Record<string, ReputationUpdate[]>> {
  const allResults: Record<string, ReputationUpdate[]> = {}

  for (const resolution of resolutions) {
    const results = await updateReputationForResolvedMarket(resolution)
    allResults[resolution.marketId] = results
  }

  return allResults
}
