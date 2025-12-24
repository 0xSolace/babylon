/**
 * Payment-related validation schemas
 *
 * Schemas for X402/A2A payment requests and receipts.
 * These are shared between packages/a2a and packages/agents.
 */

import { z } from 'zod'
import { JsonValueSchema } from '../../types/common'
import { TransactionHashSchema, WalletAddressSchema } from './common'

// ============================================================================
// X402 Payment Request Schemas
// ============================================================================

/**
 * Schema for X402 payment request
 * Used for agent-to-agent and user payment flows.
 */
export const PaymentRequestSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  from: WalletAddressSchema.describe('Sender wallet address'),
  to: WalletAddressSchema.describe('Receiver wallet address'),
  amount: z.string().regex(/^\d+$/, 'Amount must be a numeric string (in wei)'),
  service: z.string().min(1, 'Service identifier is required'),
  metadata: z.record(z.string(), JsonValueSchema).optional(),
  expiresAt: z
    .number()
    .int()
    .positive('Expiration timestamp must be a positive integer'),
})

export type PaymentRequest = z.infer<typeof PaymentRequestSchema>

/**
 * Schema for creating a new payment request
 */
export const CreatePaymentRequestSchema = z.object({
  from: WalletAddressSchema,
  to: WalletAddressSchema,
  amount: z.string().regex(/^\d+$/, 'Amount must be a numeric string (in wei)'),
  service: z.string().min(1),
  metadata: z.record(z.string(), JsonValueSchema).optional(),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .max(3600000) // Max 1 hour
    .default(900000) // Default 15 minutes
    .optional(),
})

export type CreatePaymentRequestInput = z.infer<
  typeof CreatePaymentRequestSchema
>

// ============================================================================
// X402 Payment Receipt Schemas
// ============================================================================

/**
 * Schema for X402 payment receipt
 * Confirms that a payment has been made and verified.
 */
export const PaymentReceiptSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  txHash: TransactionHashSchema.describe('On-chain transaction hash'),
  from: WalletAddressSchema,
  to: WalletAddressSchema,
  amount: z.string().regex(/^\d+$/, 'Amount must be a numeric string'),
  timestamp: z.number().int().positive('Timestamp must be a positive integer'),
  confirmed: z.boolean(),
})

export type PaymentReceipt = z.infer<typeof PaymentReceiptSchema>

/**
 * Schema for verifying a payment
 */
export const VerifyPaymentSchema = z.object({
  requestId: z.string().min(1),
  txHash: TransactionHashSchema,
  from: WalletAddressSchema,
  to: WalletAddressSchema,
  amount: z.string().regex(/^\d+$/, 'Amount must be a numeric string'),
  timestamp: z.number().int().positive(),
  confirmed: z.boolean(),
})

export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>

// ============================================================================
// Payment Verification Response Schemas
// ============================================================================

/**
 * Response from payment verification with receipt
 */
export const PaymentVerificationResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  receipt: PaymentReceiptSchema.optional(),
})

export type PaymentVerificationResponse = z.infer<
  typeof PaymentVerificationResponseSchema
>

// ============================================================================
// X402 Escrow Payment Schemas
// ============================================================================

/**
 * Status of an X402 escrow payment
 */
export const X402EscrowStatusSchema = z.enum([
  'pending',
  'funded',
  'released',
  'refunded',
  'expired',
  'disputed',
])

export type X402EscrowStatus = z.infer<typeof X402EscrowStatusSchema>

/**
 * Schema for creating an X402 escrow payment
 */
export const X402CreateEscrowSchema = z.object({
  from: WalletAddressSchema,
  to: WalletAddressSchema,
  amount: z.string().regex(/^\d+$/, 'Amount must be a numeric string (in wei)'),
  service: z.string().min(1),
  escrowAddress: WalletAddressSchema.optional(),
  releaseConditions: z.record(z.string(), JsonValueSchema).optional(),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .max(86400000 * 30) // Max 30 days
    .default(86400000) // Default 24 hours
    .optional(),
})

export type X402CreateEscrowInput = z.infer<typeof X402CreateEscrowSchema>

/**
 * Schema for an X402 escrow payment record
 */
export const X402EscrowRecordSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  from: WalletAddressSchema,
  to: WalletAddressSchema,
  escrowAddress: WalletAddressSchema,
  amount: z.string(),
  service: z.string(),
  status: X402EscrowStatusSchema,
  fundingTxHash: TransactionHashSchema.optional(),
  releaseTxHash: TransactionHashSchema.optional(),
  refundTxHash: TransactionHashSchema.optional(),
  releaseConditions: z.record(z.string(), JsonValueSchema).optional(),
  expiresAt: z.number().int().positive(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
})

export type X402EscrowRecord = z.infer<typeof X402EscrowRecordSchema>

/**
 * Schema for releasing an X402 escrow payment
 */
export const X402ReleaseEscrowSchema = z.object({
  escrowId: z.string().min(1),
  txHash: TransactionHashSchema.optional(),
  releaseReason: z.string().optional(),
})

export type X402ReleaseEscrowInput = z.infer<typeof X402ReleaseEscrowSchema>

/**
 * Schema for refunding an X402 escrow payment
 */
export const X402RefundEscrowSchema = z.object({
  escrowId: z.string().min(1),
  txHash: TransactionHashSchema.optional(),
  refundReason: z.string().optional(),
})

export type X402RefundEscrowInput = z.infer<typeof X402RefundEscrowSchema>
