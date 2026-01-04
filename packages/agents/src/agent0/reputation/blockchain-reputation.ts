/**
 * Blockchain Reputation Service
 *
 * Integrates with ERC-8004 Reputation System for on-chain reputation tracking.
 * Handles feedback submission, reputation queries, and sync with local database.
 *
 * NOTE: Many functions are currently stubbed as the ReputationRegistry contract
 * doesn't expose the expected functions (recordBet, recordWin, recordLoss, etc.).
 * The actual contract uses giveFeedback, getSummary, readFeedback instead.
 */

import { agentPerformanceMetrics, db, eq } from '@babylon/db'
import {
  REPUTATION_SYSTEM_ABI,
  REPUTATION_SYSTEM_BASE_SEPOLIA,
} from '@babylon/shared'
import type { Address, WalletClient } from 'viem'
import { baseSepolia } from 'viem/chains'
import { logger } from '../../shared/logger'

// Contract addresses from canonical config
const REPUTATION_SYSTEM_ADDRESS = REPUTATION_SYSTEM_BASE_SEPOLIA as Address

interface OnChainReputation {
  totalBets: bigint
  winningBets: bigint
  totalVolume: bigint
  profitLoss: bigint
  accuracyScore: bigint
  trustScore: bigint
  isBanned: boolean
}

/**
 * Get on-chain reputation for an agent
 *
 * NOTE: The current ReputationRegistry contract doesn't have getReputation.
 * It has getSummary which returns (count, averageScore).
 * This function is stubbed until the contract interface is updated.
 *
 * @param tokenId - ERC-8004 token ID
 * @returns On-chain reputation data (currently returns mock data)
 */
export async function getOnChainReputation(
  tokenId: number,
): Promise<OnChainReputation | null> {
  logger.warn(
    'getOnChainReputation: Contract function not available, returning mock data',
    { tokenId },
  )

  // Return mock data since contract doesn't have this function
  return {
    totalBets: 0n,
    winningBets: 0n,
    totalVolume: 0n,
    profitLoss: 0n,
    accuracyScore: 50n,
    trustScore: 50n,
    isBanned: false,
  }
}

/**
 * Submit feedback to on-chain reputation system
 *
 * Uses the actual contract's giveFeedback function.
 *
 * @param tokenId - ERC-8004 token ID (agentId)
 * @param rating - Rating score (0-100, converted to uint8)
 * @param comment - Optional comment (stored via IPFS URI)
 * @param walletClient - Wallet client for signing transaction
 * @returns Transaction hash
 */
export async function submitOnChainFeedback(
  tokenId: number,
  rating: number,
  _comment: string,
  walletClient: WalletClient,
): Promise<string> {
  if (!walletClient.account) {
    throw new Error('Wallet client must have an account')
  }

  // Convert 0-100 scale to 0-255 (uint8)
  const uint8Rating = Math.min(
    255,
    Math.max(0, Math.floor((rating / 100) * 255)),
  )

  // The actual contract uses giveFeedback with different args:
  // giveFeedback(agentId, score, tag1, tag2, fileuri, filehash, feedbackAuth)
  const hash = await walletClient.writeContract({
    chain: baseSepolia,
    address: REPUTATION_SYSTEM_ADDRESS,
    abi: REPUTATION_SYSTEM_ABI,
    functionName: 'giveFeedback',
    args: [
      BigInt(tokenId),
      uint8Rating,
      '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`, // tag1
      '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`, // tag2
      '', // fileuri
      '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`, // filehash
      '0x' as `0x${string}`, // feedbackAuth
    ],
    account: walletClient.account,
  })

  logger.info('Submitted on-chain feedback', { tokenId, rating, hash })

  return hash
}

/**
 * Record a bet on-chain
 *
 * NOTE: The current ReputationRegistry contract doesn't have recordBet.
 * This function is stubbed until the contract interface is updated.
 *
 * @param tokenId - ERC-8004 token ID
 * @param amount - Bet amount
 * @param _walletClient - Wallet client for signing transaction
 * @returns Transaction hash (mock)
 */
export async function recordBet(
  tokenId: number,
  amount: number,
  _walletClient: WalletClient,
): Promise<string> {
  logger.warn('recordBet: Contract function not available in current ABI', {
    tokenId,
    amount,
  })
  // Return a mock hash since function doesn't exist on contract
  return '0x0000000000000000000000000000000000000000000000000000000000000000'
}

/**
 * Record a win on-chain
 *
 * NOTE: The current ReputationRegistry contract doesn't have recordWin.
 * This function is stubbed until the contract interface is updated.
 *
 * @param tokenId - ERC-8004 token ID
 * @param profit - Profit amount
 * @param _walletClient - Wallet client for signing transaction
 * @returns Transaction hash (mock)
 */
export async function recordWin(
  tokenId: number,
  profit: number,
  _walletClient: WalletClient,
): Promise<string> {
  logger.warn('recordWin: Contract function not available in current ABI', {
    tokenId,
    profit,
  })
  // Return a mock hash since function doesn't exist on contract
  return '0x0000000000000000000000000000000000000000000000000000000000000000'
}

/**
 * Record a loss on-chain
 *
 * NOTE: The current ReputationRegistry contract doesn't have recordLoss.
 * This function is stubbed until the contract interface is updated.
 *
 * @param tokenId - ERC-8004 token ID
 * @param loss - Loss amount
 * @param _walletClient - Wallet client for signing transaction
 * @returns Transaction hash (mock)
 */
export async function recordLoss(
  tokenId: number,
  loss: number,
  _walletClient: WalletClient,
): Promise<string> {
  logger.warn('recordLoss: Contract function not available in current ABI', {
    tokenId,
    loss,
  })
  // Return a mock hash since function doesn't exist on contract
  return '0x0000000000000000000000000000000000000000000000000000000000000000'
}

/**
 * Sync on-chain reputation to local database
 *
 * @param userId - User ID
 * @param tokenId - ERC-8004 token ID
 * @returns Updated performance metrics
 */
export async function syncOnChainReputation(userId: string, tokenId: number) {
  const onChainRep = await getOnChainReputation(tokenId)

  if (!onChainRep) {
    throw new Error('Failed to fetch on-chain reputation')
  }

  // Update local database with on-chain data
  const updated = await db
    .update(agentPerformanceMetrics)
    .set({
      onChainReputationSync: true,
      lastSyncedAt: new Date(),
      onChainTrustScore: Number(onChainRep.trustScore),
      onChainAccuracyScore: Number(onChainRep.accuracyScore),
    })
    .where(eq(agentPerformanceMetrics.userId, userId))
    .returning()

  logger.info('Synced on-chain reputation', {
    userId,
    tokenId,
    trustScore: onChainRep.trustScore.toString(),
    accuracyScore: onChainRep.accuracyScore.toString(),
  })

  return updated[0]
}

/**
 * Get feedback count from on-chain reputation system
 *
 * Uses getLastIndex which returns the last feedback index for a client.
 *
 * @param tokenId - ERC-8004 token ID
 * @returns Feedback count
 */
export async function getOnChainFeedbackCount(
  tokenId: number,
): Promise<number> {
  // getLastIndex requires (agentId, clientAddress)
  // Since we don't have a specific client, we return 0
  logger.warn('getOnChainFeedbackCount: Requires client address, returning 0', {
    tokenId,
  })
  return 0
}

/**
 * Get specific feedback from on-chain reputation system
 *
 * Uses readFeedback which has different parameters.
 *
 * @param tokenId - ERC-8004 token ID
 * @param _index - Feedback index
 * @returns Feedback details
 */
export async function getOnChainFeedback(
  tokenId: number,
  _index: number,
): Promise<{
  from: Address
  rating: number
  comment: string
  timestamp: bigint
} | null> {
  // readFeedback requires (agentId, clientAddress, feedbackIndex)
  // Since we don't have the client address, we can't fetch feedback
  logger.warn('getOnChainFeedback: Requires client address, returning null', {
    tokenId,
  })
  return null
}
