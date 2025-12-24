/**
 * Waitlist-related validation schemas
 *
 * Schemas for waitlist marking, bonuses, position, and leaderboard.
 */

import { z } from 'zod'
import { UserIdSchema, WalletAddressSchema } from './common'

// ============================================================================
// Waitlist Mark Schemas
// ============================================================================

/**
 * Schema for marking a user as waitlisted
 */
export const WaitlistMarkSchema = z.object({
  referralCode: z
    .string()
    .min(1)
    .max(50)
    .optional()
    .describe('Optional referral code from another user'),
})

export type WaitlistMarkInput = z.infer<typeof WaitlistMarkSchema>

/**
 * Response schema for marking a user as waitlisted
 */
export const WaitlistMarkResponseSchema = z.object({
  waitlistPosition: z.number().int().positive(),
  inviteCode: z.string(),
  points: z.number(),
  referrerRewarded: z.boolean(),
})

export type WaitlistMarkResponse = z.infer<typeof WaitlistMarkResponseSchema>

// ============================================================================
// Waitlist Bonus Schemas
// ============================================================================

/**
 * Schema for awarding wallet bonus points
 */
export const WalletBonusSchema = z.object({
  walletAddress: WalletAddressSchema.describe(
    'Wallet address to award bonus for',
  ),
})

export type WalletBonusInput = z.infer<typeof WalletBonusSchema>

/**
 * Response schema for wallet bonus
 */
export const WalletBonusResponseSchema = z.object({
  awarded: z.boolean(),
  bonusAmount: z.number().int().nonnegative(),
  message: z.string(),
})

export type WalletBonusResponse = z.infer<typeof WalletBonusResponseSchema>

// ============================================================================
// Waitlist Position Schemas
// ============================================================================

/**
 * Points breakdown schema
 */
export const PointsBreakdownSchema = z.object({
  total: z.number(),
  invite: z.number(),
  earned: z.number(),
  bonus: z.number(),
  base: z.number(),
})

export type PointsBreakdown = z.infer<typeof PointsBreakdownSchema>

/**
 * Schema for a pending (invited but not qualified) referral user
 */
export const InvitedUserSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  email: z.string().nullable(),
  farcasterUsername: z.string().nullable(),
  twitterUsername: z.string().nullable(),
  createdAt: z.string().datetime(),
  status: z.literal('pending'),
})

export type InvitedUser = z.infer<typeof InvitedUserSchema>

/**
 * Schema for a qualified (completed) referral user
 */
export const QualifiedUserSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  status: z.literal('qualified'),
})

export type QualifiedUser = z.infer<typeof QualifiedUserSchema>

/**
 * Response schema for waitlist position
 */
export const WaitlistPositionResponseSchema = z.object({
  position: z.number().int().positive().nullable(),
  leaderboardRank: z.number().int().positive().nullable().optional(),
  waitlistPosition: z.number().int().positive().nullable().optional(),
  totalAhead: z.number().int().nonnegative().optional(),
  totalCount: z.number().int().nonnegative().optional(),
  percentile: z.number().min(0).max(100).optional(),
  inviteCode: z.string().nullable().optional(),
  points: z.number().optional(),
  basePoints: z.number().optional(),
  pointsBreakdown: PointsBreakdownSchema.optional(),
  referralCount: z.number().int().nonnegative().optional(),
  weeklyReferralCount: z.number().int().nonnegative().optional(),
  weeklyLimit: z.number().int().positive().optional(),
  invitedUsers: z.array(InvitedUserSchema).optional(),
  qualifiedUsers: z.array(QualifiedUserSchema).optional(),
  invitedCount: z.number().int().nonnegative().optional(),
  qualifiedCount: z.number().int().nonnegative().optional(),
  totalReferralPoints: z.number().int().nonnegative().optional(),
})

export type WaitlistPositionResponse = z.infer<
  typeof WaitlistPositionResponseSchema
>

// ============================================================================
// Waitlist Leaderboard Schemas
// ============================================================================

/**
 * Points type for sorting leaderboard
 */
export const WaitlistPointsTypeSchema = z.enum(['total', 'invite'])

export type WaitlistPointsType = z.infer<typeof WaitlistPointsTypeSchema>

/**
 * Query schema for waitlist leaderboard
 */
export const WaitlistLeaderboardQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  pointsType: WaitlistPointsTypeSchema.default('invite'),
})

export type WaitlistLeaderboardQuery = z.infer<
  typeof WaitlistLeaderboardQuerySchema
>

/**
 * Schema for a leaderboard entry
 */
export const WaitlistLeaderboardEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  profileImageUrl: z.string().nullable().optional(),
  invitePoints: z.number().int().nonnegative(),
  reputationPoints: z.number().int().nonnegative(),
  points: z.number().int().nonnegative(),
  referralCount: z.number().int().nonnegative(),
  rank: z.number().int().positive(),
})

export type WaitlistLeaderboardEntry = z.infer<
  typeof WaitlistLeaderboardEntrySchema
>

/**
 * Response schema for waitlist leaderboard
 */
export const WaitlistLeaderboardResponseSchema = z.object({
  leaderboard: z.array(WaitlistLeaderboardEntrySchema),
  totalShown: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  pointsType: WaitlistPointsTypeSchema,
})

export type WaitlistLeaderboardResponse = z.infer<
  typeof WaitlistLeaderboardResponseSchema
>

// ============================================================================
// Waitlist Referral Schemas
// ============================================================================

/**
 * Status of a waitlist referral
 */
export const WaitlistReferralStatusSchema = z.enum([
  'pending',
  'completed',
  'expired',
])

export type WaitlistReferralStatus = z.infer<
  typeof WaitlistReferralStatusSchema
>

/**
 * Schema for a waitlist referral record
 */
export const WaitlistReferralRecordSchema = z.object({
  id: z.string(),
  referrerId: UserIdSchema,
  referredUserId: UserIdSchema,
  status: WaitlistReferralStatusSchema,
  pointsAwarded: z.number().int().nonnegative().optional(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
})

export type WaitlistReferralRecord = z.infer<
  typeof WaitlistReferralRecordSchema
>

/**
 * Schema for validating a waitlist referral code
 */
export const ValidateWaitlistReferralCodeSchema = z.object({
  referralCode: z.string().min(1, 'Referral code is required'),
})

export type ValidateWaitlistReferralCodeInput = z.infer<
  typeof ValidateWaitlistReferralCodeSchema
>
