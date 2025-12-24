/**
 * Oracle Service
 *
 * Main service for interacting with Jeju GameOracle contract
 * Handles commit-reveal pattern for publishing game results on-chain
 *
 * NOTE: Uses Jeju Network's GameOracle contract.
 * See packages/contracts/src/games/GameOracle.sol for implementation.
 */

import {
  getChainById,
  getContractAddresses,
  getCurrentChainId,
  hardhat,
  keccak256,
  logger,
  safeReadContract,
  toAddress,
  toAddressArray,
  toHexString,
  zeroHash,
} from '@babylon/shared'

function getRpcUrl(): string {
  return process.env.RPC_URL ?? 'http://localhost:6545'
}

import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  type Hash,
  type Hex,
  http,
  parseAbiParameters,
} from 'viem'

function getChainFromId(chainId: number): Chain {
  return getChainById(chainId) ?? hardhat
}

// Viem Log type already includes topics, but we need to filter for indexed events
// The Log type from waitForTransactionReceipt has topics as readonly array
type ReceiptLog = {
  address: Address
  topics: readonly Hex[]
  data: Hex
  blockNumber: bigint
  transactionHash: Hex
}

// Helper to safely access log topics from transaction receipts
// Viem receipt logs include topics at runtime, but TS type is partial
function getLogWithTopics(log: {
  address: Address
  topics?: readonly `0x${string}`[]
  data: `0x${string}`
  blockNumber: bigint
  transactionHash: `0x${string}`
}): ReceiptLog {
  return {
    address: log.address,
    topics: log.topics ?? [],
    data: log.data,
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
  }
}

import { type PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts'
import { getOraclePrivateKey as getOracleKey } from '../../config/dev-keys'
import { CommitmentStore } from '../oracle-commitment-store'
import { GameOracleABI } from './abi/GameOracle'
import type {
  BatchCommitResult,
  BatchRevealResult,
  CommitTransactionResult,
  OracleConfig,
  RevealTransactionResult,
} from './types'

/**
 * Get oracle private key with optional explicit override
 */
function getOraclePrivateKey(configKey?: string): string {
  // Explicit config takes priority
  if (configKey) return configKey

  // Use centralized dev-keys utility
  return getOracleKey()
}

export class OracleService {
  private publicClient: ReturnType<typeof createPublicClient>
  private walletClient: ReturnType<typeof createWalletClient>
  private account: PrivateKeyAccount
  private walletAddress: Address
  private contractAddress: Address
  private chain: Chain
  private config: OracleConfig

  constructor(config?: Partial<OracleConfig>) {
    // Load config from canonical config (default-config.ts)
    const contractAddresses = getContractAddresses()

    const oracleAddress =
      config?.oracleAddress ?? contractAddresses.gameOracle ?? ''

    this.config = {
      oracleAddress,
      privateKey: getOraclePrivateKey(config?.privateKey),
      rpcUrl: config?.rpcUrl ?? getRpcUrl(),
      chainId: config?.chainId ?? getCurrentChainId(),
      gasMultiplier: config?.gasMultiplier ?? 1.2,
      maxGasPrice: config?.maxGasPrice,
      confirmations: config?.confirmations ?? 1,
    }

    if (!this.config.oracleAddress) {
      throw new Error('Oracle address not configured')
    }

    this.contractAddress = toAddress(this.config.oracleAddress)

    // Setup viem clients with proper chain for type inference
    this.chain = getChainFromId(this.config.chainId)
    this.account = privateKeyToAccount(toHexString(this.config.privateKey))
    this.walletAddress = this.account.address

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    })

    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    })

    logger.info(
      'Oracle service initialized',
      {
        oracle: this.config.oracleAddress,
        wallet: this.walletAddress,
        chainId: this.config.chainId,
      },
      'OracleService',
    )
  }

  /**
   * Generate commitment for a game outcome
   */
  private generateCommitment(outcome: boolean, salt: string): string {
    // keccak256(abi.encode(outcome, salt))
    const encoded = encodeAbiParameters(parseAbiParameters('bool, bytes32'), [
      outcome,
      toHexString(salt),
    ])
    return keccak256(encoded)
  }

  /**
   * Commit a game to the oracle (when question is created)
   */
  async commitGame(
    questionId: string,
    questionNumber: number,
    question: string,
    category: string,
    outcome: boolean,
  ): Promise<CommitTransactionResult> {
    logger.info(
      `Committing game: ${questionId}`,
      { questionNumber, question: question.substring(0, 50) },
      'OracleService',
    )

    // Generate salt and commitment
    const salt = CommitmentStore.generateSalt()
    const commitment = this.generateCommitment(outcome, salt)

    // Store commitment locally
    await CommitmentStore.store({
      questionId,
      sessionId: '', // Set after transaction completes
      salt,
      commitment,
      createdAt: new Date(),
    })

    // Verify contract has code at address
    const code = await this.publicClient.getBytecode({
      address: this.contractAddress,
    })
    if (!code || code === '0x' || code === '0x0') {
      throw new Error(
        `No contract code found at address ${this.config.oracleAddress}`,
      )
    }

    // Write to contract
    const txHash = await this.walletClient.writeContract({
      account: this.account,
      chain: this.chain,
      address: this.contractAddress,
      abi: GameOracleABI,
      functionName: 'commitGame',
      args: [
        questionId,
        BigInt(questionNumber),
        question,
        toHexString(commitment),
        category,
      ],
    })

    logger.info(`Transaction sent: ${txHash}`, { questionId }, 'OracleService')

    // Wait for confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: this.config.confirmations,
    })

    // Parse event to get sessionId - look for GameCommitted event
    // The sessionId will be in the first topic after the event signature
    // Event signature: keccak256("GameCommitted(bytes32,string,uint256,uint256)")
    const logsWithTopics = receipt.logs.map(getLogWithTopics)
    const gameCommittedLog = logsWithTopics.find((log) => log.topics.length > 1)
    // topics[1] is already a Hex type from ReceiptLog, zeroHash is also Hex which is compatible with Hash
    const sessionId: Hash = gameCommittedLog?.topics[1] ?? zeroHash

    // Update stored commitment with sessionId
    const stored = await CommitmentStore.retrieve(questionId)
    if (stored) {
      await CommitmentStore.store({
        ...stored,
        sessionId: sessionId.toString(),
      })
    }

    logger.info(
      'Game committed successfully',
      {
        questionId,
        sessionId: sessionId.toString(),
        txHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
      },
      'OracleService',
    )

    return {
      sessionId: sessionId.toString(),
      questionId,
      commitment,
      txHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
      gasUsed: receipt.gasUsed.toString(),
    }
  }

  /**
   * Reveal a game outcome (when question is resolved)
   */
  async revealGame(
    questionId: string,
    outcome: boolean,
    winners: string[] = [],
    totalPayout: bigint = BigInt(0),
  ): Promise<RevealTransactionResult> {
    logger.info(
      `Revealing game: ${questionId}`,
      { outcome, winnersCount: winners.length },
      'OracleService',
    )

    // Retrieve stored commitment
    const stored = await CommitmentStore.retrieve(questionId)
    if (!stored) {
      logger.warn(
        'Cannot reveal game - no commitment found',
        { questionId },
        'OracleService',
      )
      throw new Error(`No commitment found for question ${questionId}`)
    }

    // Call contract
    const emptyTeeQuote: Hex = '0x' // Empty TEE quote for now
    const txHash = await this.walletClient.writeContract({
      account: this.account,
      chain: this.chain,
      address: this.contractAddress,
      abi: GameOracleABI,
      functionName: 'revealGame',
      args: [
        toHexString(stored.sessionId),
        outcome,
        toHexString(stored.salt),
        emptyTeeQuote,
        toAddressArray(winners),
        totalPayout,
      ],
    })

    logger.info(
      `Reveal transaction sent: ${txHash}`,
      { questionId, sessionId: stored.sessionId },
      'OracleService',
    )

    // Wait for confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: this.config.confirmations,
    })

    // Cleanup stored commitment
    await CommitmentStore.delete(questionId)

    logger.info(
      'Game revealed successfully',
      {
        questionId,
        sessionId: stored.sessionId,
        outcome,
        txHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
      },
      'OracleService',
    )

    return {
      sessionId: stored.sessionId,
      questionId,
      outcome,
      txHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
      gasUsed: receipt.gasUsed.toString(),
    }
  }

  /**
   * Batch commit multiple games (gas optimization)
   */
  async batchCommitGames(
    games: Array<{
      questionId: string
      questionNumber: number
      question: string
      category: string
      outcome: boolean
    }>,
  ): Promise<BatchCommitResult> {
    const successful: CommitTransactionResult[] = []
    const failed: Array<{ questionId: string; error: string }> = []

    logger.info(
      `Batch committing ${games.length} games`,
      undefined,
      'OracleService',
    )

    // Prepare batch data
    const questionIds: string[] = []
    const questionNumbers: number[] = []
    const questions: string[] = []
    const commitments: string[] = []
    const categories: string[] = []
    const salts: string[] = []

    for (const game of games) {
      const salt = CommitmentStore.generateSalt()
      const commitment = this.generateCommitment(game.outcome, salt)

      questionIds.push(game.questionId)
      questionNumbers.push(game.questionNumber)
      questions.push(game.question)
      commitments.push(commitment)
      categories.push(game.category)
      salts.push(salt)

      // Store commitment
      await CommitmentStore.store({
        questionId: game.questionId,
        sessionId: '', // Set after transaction completes
        salt,
        commitment,
        createdAt: new Date(),
      })
    }

    if (questionIds.length === 0) {
      return { successful, failed }
    }

    // Verify contract has code at address
    const code = await this.publicClient.getBytecode({
      address: this.contractAddress,
    })
    if (!code || code === '0x' || code === '0x0') {
      throw new Error(
        `No contract code found at address ${this.config.oracleAddress}`,
      )
    }

    // Call batch contract method - validate commitments as Hex[]
    const hexCommitments: Hex[] = commitments.map((c) => toHexString(c))
    const txHash = await this.walletClient.writeContract({
      account: this.account,
      chain: this.chain,
      address: this.contractAddress,
      abi: GameOracleABI,
      functionName: 'batchCommitGames',
      args: [
        questionIds,
        questionNumbers.map((n) => BigInt(n)),
        questions,
        hexCommitments,
        categories,
      ],
    })

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: this.config.confirmations,
    })

    // Parse events to get session IDs
    const logsWithTopics = receipt.logs.map(getLogWithTopics)
    const events = logsWithTopics
      .filter((log) => log.topics.length > 1)
      .map((log) => ({
        sessionId: (log.topics[1] ?? zeroHash) as Hash,
      }))

    // Update stored commitments and build results
    // List all pending commitments before retrieval for monitoring
    const allPending = await CommitmentStore.listPending()
    logger.info(
      `Found ${allPending.length} pending commitments before update`,
      {
        questionIds: allPending
          .map((c: { questionId: string }) => c.questionId)
          .slice(0, 10),
      },
      'OracleService',
    )

    for (let i = 0; i < questionIds.length; i++) {
      const event = events[i]
      const sessionId = event?.sessionId?.toString() || zeroHash

      const questionId = questionIds[i]
      if (!questionId) {
        throw new Error(`Question ID not found at index ${i}`)
      }
      const stored = await CommitmentStore.retrieve(questionId)
      if (stored) {
        await CommitmentStore.store({
          ...stored,
          sessionId,
        })
      } else {
        logger.warn(
          `Could not find commitment for questionId ${questionId} after batch commit`,
          {
            questionId,
            allPendingCount: allPending.length,
            searchedFor: questionId,
          },
          'OracleService',
        )
      }

      const commitment = commitments[i]
      if (!commitment) {
        throw new Error(`Commitment not found at index ${i}`)
      }
      successful.push({
        sessionId,
        questionId,
        commitment,
        txHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: (receipt.gasUsed / BigInt(questionIds.length)).toString(),
      })
    }

    logger.info(
      `Batch commit successful: ${successful.length} games`,
      {
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
      },
      'OracleService',
    )

    return { successful, failed }
  }

  /**
   * Batch reveal multiple games (gas optimization)
   */
  async batchRevealGames(
    reveals: Array<{
      questionId: string
      outcome: boolean
      winners?: string[]
      totalPayout?: bigint
    }>,
  ): Promise<BatchRevealResult> {
    const successful: RevealTransactionResult[] = []
    const failed: Array<{ questionId: string; error: string }> = []

    logger.info(
      `Batch revealing ${reveals.length} games`,
      undefined,
      'OracleService',
    )

    // Prepare batch data
    const sessionIds: string[] = []
    const outcomes: boolean[] = []
    const salts: string[] = []
    const teeQuotes: string[] = []
    const winnersArrays: string[][] = []
    const totalPayouts: bigint[] = []
    const questionIds: string[] = []

    for (const reveal of reveals) {
      const stored = await CommitmentStore.retrieve(reveal.questionId)
      if (!stored) {
        throw new Error(`No commitment found for question ${reveal.questionId}`)
      }

      sessionIds.push(stored.sessionId)
      outcomes.push(reveal.outcome)
      salts.push(stored.salt)
      teeQuotes.push('0x')
      winnersArrays.push(reveal.winners || [])
      totalPayouts.push(reveal.totalPayout || BigInt(0))
      questionIds.push(reveal.questionId)
    }

    if (sessionIds.length === 0) {
      return { successful, failed }
    }

    // Verify contract has code at address
    const code = await this.publicClient.getBytecode({
      address: this.contractAddress,
    })
    if (!code || code === '0x' || code === '0x0') {
      throw new Error(
        `No contract code found at address ${this.config.oracleAddress}`,
      )
    }

    // Validate teeQuotes - ensure they're valid bytes
    const emptyHex: Hex = '0x'
    const validTeeQuotes: Hex[] = teeQuotes.map((quote) => {
      if (!quote || quote === '') {
        return emptyHex // Empty bytes
      }
      // Ensure it's a valid hex string
      if (!quote.startsWith('0x')) {
        return `0x${quote}` as Hex
      }
      return quote as Hex
    })

    // Validate all hex arrays for contract call
    const hexSessionIds: Hex[] = sessionIds.map((s) => toHexString(s))
    const hexSalts: Hex[] = salts.map((s) => toHexString(s))
    const addressWinnersArrays: Address[][] = winnersArrays.map((arr) =>
      toAddressArray(arr),
    )

    // Call batch contract method
    const txHash = await this.walletClient.writeContract({
      account: this.account,
      chain: this.chain,
      address: this.contractAddress,
      abi: GameOracleABI,
      functionName: 'batchRevealGames',
      args: [
        hexSessionIds,
        outcomes,
        hexSalts,
        validTeeQuotes,
        addressWinnersArrays,
        totalPayouts,
      ],
    })

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: this.config.confirmations,
    })

    // Build results and cleanup
    for (let i = 0; i < questionIds.length; i++) {
      const questionId = questionIds[i]
      if (!questionId) {
        throw new Error(`Question ID not found at index ${i}`)
      }
      await CommitmentStore.delete(questionId)

      const sessionId = sessionIds[i]
      if (!sessionId) {
        throw new Error(`Session ID not found at index ${i}`)
      }
      const outcome = outcomes[i]
      if (!outcome) {
        throw new Error(`Outcome not found at index ${i}`)
      }
      successful.push({
        sessionId,
        questionId,
        outcome,
        txHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: (receipt.gasUsed / BigInt(sessionIds.length)).toString(),
      })
    }

    logger.info(
      `Batch reveal successful: ${successful.length} games`,
      {
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
      },
      'OracleService',
    )

    return { successful, failed }
  }

  /**
   * Get game info from oracle
   */
  async getGameInfo(sessionId: string) {
    const info = await safeReadContract(this.publicClient, {
      address: this.contractAddress,
      abi: GameOracleABI,
      functionName: 'getCompleteGameInfo',
      args: [toHexString(sessionId)],
    })
    return info
  }

  /**
   * Get oracle statistics
   */
  async getStatistics() {
    const stats = await safeReadContract<[bigint, bigint, bigint]>(
      this.publicClient,
      {
        address: this.contractAddress,
        abi: GameOracleABI,
        functionName: 'getStatistics',
      },
    )
    const [committed, revealed, pending] = stats
    return {
      committed: committed.toString(),
      revealed: revealed.toString(),
      pending: pending.toString(),
    }
  }

  /**
   * Health check - verify oracle is accessible and properly configured
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    // Check contract is deployed
    const code = await this.publicClient.getBytecode({
      address: this.contractAddress,
    })
    if (!code || code === '0x' || code === '0x0') {
      return {
        healthy: false,
        error: 'Oracle contract not deployed',
      }
    }

    // Check wallet has balance
    const balance = await this.publicClient.getBalance({
      address: this.walletAddress,
    })
    if (balance === BigInt(0)) {
      return {
        healthy: false,
        error: 'Wallet has no balance for gas',
      }
    }

    // Try to read from contract
    await safeReadContract(this.publicClient, {
      address: this.contractAddress,
      abi: GameOracleABI,
      functionName: 'version',
    })

    return { healthy: true }
  }
}

// Singleton instance
let oracleServiceInstance: OracleService | null = null

/**
 * Get or create oracle service instance
 */
export function getOracleService(
  config?: Partial<OracleConfig>,
): OracleService {
  if (!oracleServiceInstance) {
    oracleServiceInstance = new OracleService(config)
  }
  return oracleServiceInstance
}
