/**
 * Paymaster Types
 *
 * Types for gas sponsorship.
 */

import type { Address, Hex } from 'viem';
import type { DID } from '../types/index';

/**
 * Paymaster data for sponsored operations
 */
export interface PaymasterData {
  paymaster: Address;
  paymasterData: Hex;
  validUntil: number;
  validAfter: number;
}

/**
 * Sponsorship policy configuration
 */
export interface SponsorshipPolicy {
  /** Maximum gas per transaction */
  maxGasPerTx: bigint;
  /** Maximum gas per day per user */
  maxGasPerUserPerDay: bigint;
  /** Whitelisted contract addresses (empty = all allowed) */
  whitelistedContracts: Address[];
  /** Blacklisted contract addresses */
  blacklistedContracts: Address[];
  /** Whether to sponsor for new users only */
  newUsersOnly: boolean;
  /** Minimum user reputation to sponsor */
  minReputation: number;
}

/**
 * User sponsorship state
 */
export interface UserSponsorshipState {
  userId: DID;
  gasUsedToday: bigint;
  lastReset: number;
  totalGasSponsored: bigint;
  transactionCount: number;
}

/**
 * Sponsorship result
 */
export interface SponsorshipResult {
  sponsored: boolean;
  paymasterData?: PaymasterData;
  gasLimit?: bigint;
  error?: string;
}
