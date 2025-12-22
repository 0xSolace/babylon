/**
 * Points-related validation schemas
 *
 * Schemas for point purchases, transactions, and rewards.
 * Note: TransferPointsSchema is defined in './transfer.ts'
 */

import { z } from 'zod';
import {
  NumericStringSchema,
  SnowflakeIdSchema,
  TransactionHashSchema,
  UserIdSchema,
  WalletAddressSchema,
} from './common';

// ============================================================================
// Point Transfer Request Schema
// ============================================================================

/**
 * Request schema for point transfers between users
 */
export const TransferPointsSchema = z.object({
  recipientId: UserIdSchema.describe('User ID of the recipient'),
  amount: z
    .number()
    .int()
    .positive('Amount must be a positive integer')
    .describe('Number of points to transfer'),
  message: z
    .string()
    .max(280, 'Message must be 280 characters or less')
    .optional()
    .describe('Optional message to include with the transfer'),
});

export type TransferPointsInput = z.infer<typeof TransferPointsSchema>;

// ============================================================================
// Point Transfer Response Schemas
// ============================================================================

/**
 * Response schema for point transfer
 */
export const TransferPointsResponseSchema = z.object({
  success: z.literal(true),
  transfer: z.object({
    amount: z.number().int().positive(),
    sender: z.object({
      id: z.string(),
      name: z.string().nullable(),
      newBalance: z.number(),
    }),
    recipient: z.object({
      id: z.string(),
      name: z.string().nullable(),
      newBalance: z.number(),
    }),
    message: z.string().optional(),
  }),
});

export type TransferPointsResponse = z.infer<
  typeof TransferPointsResponseSchema
>;

// ============================================================================
// Points Purchase Schemas
// ============================================================================

/**
 * Schema for creating a points purchase payment request
 */
export const CreatePointsPaymentSchema = z.object({
  amountUSD: z
    .number()
    .positive('Amount must be positive')
    .describe('Amount in USD'),
  fromAddress: WalletAddressSchema.describe("User's wallet address"),
});

export type CreatePointsPaymentInput = z.infer<
  typeof CreatePointsPaymentSchema
>;

/**
 * Response schema for creating a points payment request
 */
export const CreatePointsPaymentResponseSchema = z.object({
  success: z.literal(true),
  paymentRequest: z.object({
    requestId: z.string(),
    amount: z.string(),
    from: WalletAddressSchema,
    to: WalletAddressSchema,
    expiresAt: z.number(),
    pointsAmount: z.number().int().positive(),
    amountUSD: z.number().positive(),
  }),
});

export type CreatePointsPaymentResponse = z.infer<
  typeof CreatePointsPaymentResponseSchema
>;

/**
 * Schema for verifying a points purchase payment
 */
export const VerifyPointsPaymentSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  txHash: TransactionHashSchema.describe('On-chain transaction hash'),
  fromAddress: WalletAddressSchema,
  toAddress: WalletAddressSchema,
  amount: NumericStringSchema.describe('Payment amount in wei'),
});

export type VerifyPointsPaymentInput = z.infer<
  typeof VerifyPointsPaymentSchema
>;

/**
 * Response schema for verifying points payment
 */
export const VerifyPointsPaymentResponseSchema = z.object({
  success: z.literal(true),
  pointsAwarded: z.number().int().positive(),
  newTotal: z.number().int().nonnegative(),
  txHash: TransactionHashSchema,
});

export type VerifyPointsPaymentResponse = z.infer<
  typeof VerifyPointsPaymentResponseSchema
>;

// ============================================================================
// Points Transaction Schemas
// ============================================================================

/**
 * Reason codes for point transactions
 */
export const PointsTransactionReasonSchema = z.enum([
  'transfer_sent',
  'transfer_received',
  'purchase',
  'reward',
  'referral',
  'bonus',
  'bet_placed',
  'bet_won',
  'bet_lost',
  'position_opened',
  'position_closed',
  'daily_bonus',
  'achievement',
  'penalty',
  'adjustment',
]);

export type PointsTransactionReason = z.infer<
  typeof PointsTransactionReasonSchema
>;

/**
 * Schema for a points transaction record
 */
export const PointsTransactionSchema = z.object({
  id: SnowflakeIdSchema,
  userId: UserIdSchema,
  amount: z.number().int(), // Can be negative for deductions
  pointsBefore: z.number().int().nonnegative(),
  pointsAfter: z.number().int().nonnegative(),
  reason: PointsTransactionReasonSchema,
  metadata: z.string().optional(), // JSON string with additional context
  createdAt: z.date(),
});

export type PointsTransaction = z.infer<typeof PointsTransactionSchema>;

/**
 * Query schema for fetching points transaction history
 */
export const PointsHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  reason: PointsTransactionReasonSchema.optional(),
});

export type PointsHistoryQuery = z.infer<typeof PointsHistoryQuerySchema>;
