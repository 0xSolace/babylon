/**
 * Pool Types - Type definitions for liquidity pool positions
 *
 * This module defines types for user pool deposits and summaries
 * used in the UserPoolPositions component.
 *
 * @example
 * ```tsx
 * import type { UserPoolDeposit, UserPoolSummary } from '@/types/pools';
 * ```
 */

/**
 * NPC actor information associated with a pool.
 */
interface NpcActor {
  /** Actor name */
  name: string;
  /** Actor tier (e.g., 'BRONZE_TIER', 'SILVER_TIER') */
  tier?: string;
}

/**
 * Individual user deposit in a liquidity pool.
 */
export interface UserPoolDeposit {
  /** Unique deposit ID */
  id: string;
  /** Pool ID this deposit belongs to */
  poolId: string;
  /** Display name of the pool */
  poolName: string;
  /** Amount deposited in USD */
  amount: number;
  /** Number of pool shares owned */
  shares: number;
  /** Current value of the deposit */
  currentValue: number;
  /** Unrealized profit/loss */
  unrealizedPnL: number;
  /** Return percentage */
  returnPercent: number;
  /** NPC actor managing the pool */
  npcActor: NpcActor;
  /** Timestamp when deposit was made */
  createdAt: string;
}

/**
 * Summary of all user pool positions.
 */
export interface UserPoolSummary {
  /** Total amount invested across all pools */
  totalInvested: number;
  /** Total current value of all positions */
  totalCurrentValue: number;
  /** Total unrealized PnL across all positions */
  totalUnrealizedPnL: number;
  /** Overall return percentage */
  totalReturnPercent: number;
  /** Number of active deposits */
  activeDepositsCount: number;
}
