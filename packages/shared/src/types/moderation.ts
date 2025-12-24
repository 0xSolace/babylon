/**
 * Moderation Types
 *
 * Types for the moderation system.
 * These enums use numeric values to match contract/SDK expectations.
 */

/**
 * Ban status enum (numeric values for contract compatibility)
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
 * Vote position enum (numeric values for contract compatibility)
 */
export enum VotePosition {
  NONE = 0,
  YES = 1,
  NO = 2,
}

/**
 * Market outcome enum
 */
export enum MarketOutcome {
  PENDING = 0,
  YES = 1,
  NO = 2,
  INVALID = 3,
}
