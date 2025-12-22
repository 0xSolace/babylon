/**
 * Moderation Types
 *
 * Canonical enums and types for the Babylon-Jeju moderation system.
 * These types are used across the moderation package and A2A protocol.
 */

/**
 * Ban status enum matching the on-chain BanStatus
 */
export enum BanStatus {
  NONE = 0,
  ON_NOTICE = 1,
  CHALLENGED = 2,
  BANNED = 3,
  CLEARED = 4,
  APPEALING = 5,
}

/**
 * Vote position enum for moderation case voting
 */
export enum VotePosition {
  YES = 0,
  NO = 1,
}

/**
 * Outcome of a moderation case
 */
export enum MarketOutcome {
  PENDING = 0,
  BAN_UPHELD = 1,
  BAN_REJECTED = 2,
}
