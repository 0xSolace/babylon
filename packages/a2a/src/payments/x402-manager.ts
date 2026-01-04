/**
 * x402 Micropayment Manager
 * Implements HTTP 402-based micropayment protocol for agent services
 *
 * Uses distributed cache for persistent storage across distributed deployments
 */

import {
  type JsonValue,
  logger,
  type PaymentVerificationParams,
  type PaymentVerificationResult,
  randomBytesHex,
} from '@babylon/shared'
import { type CacheClient, getCacheClient } from '@jejunetwork/shared'
import { createPublicClient, type Hash, http, isHex } from 'viem'
import { z } from 'zod'
import type { PaymentRequest } from '../types/a2a'
import { PaymentRequestSchema } from '../types/a2a'

/**
 * Type for payment request metadata.
 * Restricted to JSON-primitive values for serialization safety.
 */
type PaymentMetadata = Record<string, string | number | boolean | null>

/**
 * Converts PaymentMetadata to JsonValue-compatible Record.
 * PaymentMetadata values are a subset of JsonValue, so this is safe.
 */
function metadataToJsonRecord(
  metadata: PaymentMetadata | undefined,
): Record<string, JsonValue> | undefined {
  return metadata
}

/**
 * Validates that a string is a valid transaction hash.
 * Returns the hash as viem's Hash type or throws.
 */
function toTransactionHash(txHash: string): Hash {
  if (!isHex(txHash) || txHash.length !== 66) {
    throw new Error(`Invalid transaction hash format: ${txHash}`)
  }
  return txHash
}

export interface X402Config {
  rpcUrl: string
  minPaymentAmount?: string // Minimum payment in wei (default: 0)
  paymentTimeout?: number // Payment timeout in ms (default: 5 minutes)
}

interface PendingPayment {
  request: PaymentRequest
  createdAt: number
  verified: boolean
}

const PendingPaymentSchema = z.object({
  request: PaymentRequestSchema,
  createdAt: z.number(),
  verified: z.boolean(),
})

const CACHE_PREFIX = 'x402:payment:'

// Distributed cache for x402 payments
let paymentCache: CacheClient | null = null

function getPaymentCache(): CacheClient {
  if (!paymentCache) {
    paymentCache = getCacheClient('babylon-x402-payments')
  }
  return paymentCache
}

export class X402Manager {
  private provider: ReturnType<typeof createPublicClient>
  private config: Required<X402Config>
  private readonly DEFAULT_MIN_PAYMENT = '1000000000000000' // 0.001 ETH
  private readonly DEFAULT_TIMEOUT = 5 * 60 * 1000 // 5 minutes

  constructor(config: X402Config) {
    this.provider = createPublicClient({ transport: http(config.rpcUrl) })
    this.config = {
      rpcUrl: config.rpcUrl,
      minPaymentAmount: config.minPaymentAmount || this.DEFAULT_MIN_PAYMENT,
      paymentTimeout: config.paymentTimeout || this.DEFAULT_TIMEOUT,
    }
  }

  /**
   * Store payment in distributed cache
   */
  private async storePayment(
    requestId: string,
    payment: PendingPayment,
  ): Promise<void> {
    const cache = getPaymentCache()
    const key = `${CACHE_PREFIX}${requestId}`
    const ttlSeconds = Math.ceil(this.config.paymentTimeout / 1000)
    const serialized = JSON.stringify(payment)

    await cache.set(key, serialized, ttlSeconds)
    logger.debug('[X402Manager] Stored payment', {
      requestId,
      ttl: ttlSeconds,
    })
  }

  /**
   * Retrieve payment from distributed cache
   */
  private async getPayment(requestId: string): Promise<PendingPayment | null> {
    const cache = getPaymentCache()
    const key = `${CACHE_PREFIX}${requestId}`

    const cached = await cache.get(key)

    if (!cached) {
      logger.debug('[X402Manager] Payment not found', { requestId })
      return null
    }

    const paymentData = JSON.parse(cached)
    const validation = PendingPaymentSchema.safeParse(paymentData)

    if (!validation.success) {
      logger.error('[X402Manager] Invalid payment data', {
        requestId,
        error: validation.error,
      })
      await this.deletePayment(requestId)
      return null
    }

    const payment: PendingPayment = {
      ...validation.data,
      request: validation.data.request,
    }

    return payment
  }

  /**
   * Update payment in distributed cache
   */
  private async updatePayment(
    requestId: string,
    payment: PendingPayment,
  ): Promise<void> {
    const cache = getPaymentCache()
    const key = `${CACHE_PREFIX}${requestId}`
    const remainingMs = payment.request.expiresAt - Date.now()
    const ttlSeconds = Math.max(Math.ceil(remainingMs / 1000), 1)
    const serialized = JSON.stringify(payment)

    await cache.set(key, serialized, ttlSeconds)
    logger.debug('[X402Manager] Updated payment', { requestId })
  }

  /**
   * Delete payment from distributed cache
   */
  private async deletePayment(requestId: string): Promise<void> {
    const cache = getPaymentCache()
    const key = `${CACHE_PREFIX}${requestId}`
    await cache.delete(key)
    logger.debug('[X402Manager] Deleted payment', { requestId })
  }

  /**
   * Create a payment request for a service
   */
  async createPaymentRequest(
    from: string,
    to: string,
    amount: string,
    service: string,
    metadata?: PaymentMetadata,
  ): Promise<PaymentRequest> {
    // Validate amount meets minimum
    const amountBn = BigInt(amount)
    const minAmountBn = BigInt(this.config.minPaymentAmount)

    if (amountBn < minAmountBn) {
      throw new Error(
        `Payment amount must be at least ${this.config.minPaymentAmount} wei`,
      )
    }

    const requestId = this.generateRequestId()
    const expiresAt = Date.now() + this.config.paymentTimeout

    const request: PaymentRequest = {
      requestId,
      from,
      to,
      amount,
      service,
      metadata: metadataToJsonRecord(metadata),
      expiresAt,
    }

    // Store pending payment
    await this.storePayment(requestId, {
      request,
      createdAt: Date.now(),
      verified: false,
    })

    return request
  }

  /**
   * Verify a payment receipt against blockchain transaction
   * Supports both EOA and smart wallet transactions
   */
  async verifyPayment(
    verificationData: PaymentVerificationParams,
  ): Promise<PaymentVerificationResult> {
    const pending = await this.getPayment(verificationData.requestId)
    if (!pending) {
      return { verified: false, error: 'Payment request not found or expired' }
    }

    if (pending.verified) {
      return { verified: true }
    }

    if (Date.now() > pending.request.expiresAt) {
      await this.deletePayment(verificationData.requestId)
      return { verified: false, error: 'Payment request expired' }
    }

    // Validate transaction hash format before blockchain query
    const txHash = toTransactionHash(verificationData.txHash)

    const tx = await this.provider.getTransaction({ hash: txHash })
    if (!tx) {
      return { verified: false, error: 'Transaction not found on blockchain' }
    }

    const txReceipt = await this.provider.getTransactionReceipt({
      hash: txHash,
    })
    if (!txReceipt) {
      return { verified: false, error: 'Transaction not yet confirmed' }
    }

    if (txReceipt.status !== 'success') {
      return { verified: false, error: 'Transaction failed on blockchain' }
    }

    const errors: string[] = []

    // For smart wallets (account abstraction), the tx.from might be the paymaster or smart wallet
    // We need to be more lenient with sender validation
    const fromMatch =
      tx.from.toLowerCase() === pending.request.from.toLowerCase()

    // Check if this might be a smart wallet transaction (has different from address)
    const isSmartWallet = !fromMatch

    if (!fromMatch) {
      logger.warn(
        `[X402Manager] Sender mismatch: expected ${pending.request.from}, got ${tx.from}, treating as smart wallet`,
      )
      // For production, you may want to implement more sophisticated verification:
      // - Check transaction trace for internal calls to the sender's smart wallet
      // - Verify the smart wallet contract code/factory
    }

    // Recipient validation - should be strict
    const recipientMatch =
      tx.to?.toLowerCase() === pending.request.to.toLowerCase()

    if (!recipientMatch) {
      // For smart wallets, tx.to could be an entrypoint. A robust solution would involve:
      // 1. Decoding the transaction data to find the ultimate recipient.
      // 2. Tracing the transaction to see internal calls.
      // For now, we will reject if there is a direct mismatch, to be safe.
      errors.push(
        `Recipient mismatch: expected ${pending.request.to}, got ${tx.to}`,
      )
    }

    // Verify amount (with some tolerance for gas and fees)
    const requestedAmount = BigInt(pending.request.amount)
    const paidAmount = tx.value

    // Allow for 1% tolerance for gas fees in smart wallet transactions
    const minAcceptableAmount = (requestedAmount * 99n) / 100n

    if (paidAmount < minAcceptableAmount) {
      errors.push(
        `Insufficient payment: expected at least ${minAcceptableAmount}, got ${paidAmount}`,
      )
    }

    if (errors.length > 0) {
      return { verified: false, error: errors.join('; ') }
    }

    // Mark as verified
    pending.verified = true
    await this.updatePayment(verificationData.requestId, pending)

    logger.info(
      `[X402Manager] Payment verified successfully: ${verificationData.txHash}`,
      {
        requestId: verificationData.requestId,
        isSmartWallet,
      },
    )

    return { verified: true }
  }

  /**
   * Get payment request details
   */
  async getPaymentRequest(requestId: string): Promise<PaymentRequest | null> {
    const pending = await this.getPayment(requestId)
    return pending ? pending.request : null
  }

  /**
   * Check if payment has been verified
   */
  async isPaymentVerified(requestId: string): Promise<boolean> {
    const pending = await this.getPayment(requestId)
    return pending ? pending.verified : false
  }

  /**
   * Cancel a payment request
   */
  async cancelPaymentRequest(requestId: string): Promise<boolean> {
    await this.deletePayment(requestId)
    return true
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `x402-${Date.now()}-${randomBytesHex(16)}`
  }

  /**
   * Get all pending payments (for testing/debugging)
   */
  async getPendingPayments(): Promise<PendingPayment[]> {
    const cache = getPaymentCache()
    const keys = await cache.keys(`${CACHE_PREFIX}*`)
    const payments: PendingPayment[] = []

    for (const key of keys) {
      const cached = await cache.get(key)
      if (cached) {
        const payment: PendingPayment = JSON.parse(cached)
        if (!payment.verified) {
          payments.push(payment)
        }
      }
    }

    return payments
  }

  /**
   * Get statistics about payments (for testing/debugging)
   */
  async getStatistics() {
    const cache = getPaymentCache()
    const keys = await cache.keys(`${CACHE_PREFIX}*`)
    const now = Date.now()
    const stats = { pending: 0, verified: 0, expired: 0 }

    for (const key of keys) {
      const cached = await cache.get(key)
      if (cached) {
        const payment: PendingPayment = JSON.parse(cached)
        if (payment.verified) {
          stats.verified++
        } else if (payment.request.expiresAt < now) {
          stats.expired++
        } else {
          stats.pending++
        }
      }
    }

    return stats
  }

  /**
   * Cleanup method to clear storage
   */
  async cleanup(): Promise<void> {
    const cache = getPaymentCache()
    await cache.clear()
  }
}
