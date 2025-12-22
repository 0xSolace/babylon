/**
 * Profile Type Definitions
 *
 * Types for user and actor profiles, profile widgets, and related data.
 * Consolidated from profile.ts and profiles.ts.
 */

import type { Actor } from '../game-types';

// ============================================================================
// User/Actor Profile Entity Types
// ============================================================================

/**
 * User profile information
 */
export interface UserProfile {
  id: string;
  username?: string;
  bio?: string;
  avatar?: string;
  walletAddress?: string;
  email?: string;
  nftTokenId?: number;
  onChainRegistered?: boolean;
  virtualBalance?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * Actor profile information (extended from Actor)
 */
export interface ActorProfile extends Actor {
  postCount?: number;
  followerCount?: number;
  followingCount?: number;
  recentPosts?: Array<{
    id: string;
    content: string;
    timestamp: string;
  }>;
}

/**
 * Combined profile type (user or actor)
 * Includes all properties that may be present in profile pages
 */
export type ProfileInfo = (UserProfile | ActorProfile) & {
  type?: 'user' | 'actor' | 'organization';
  role?: string;
  name?: string;
  username?: string;
  description?: string;
  profileDescription?: string;
  tier?: string;
  domain?: string[];
  personality?: string;
  affiliations?: string[];
  game?: { id: string };
  isUser?: boolean;
  profileImageUrl?: string;
  coverImageUrl?: string;
  onChainRegistered?: boolean;
  nftTokenId?: number | null;
  stats?: {
    posts?: number;
    followers?: number;
    following?: number;
  };
};

/**
 * Type guard to check if profile is a user profile
 */
export function isUserProfile(profile: ProfileInfo): profile is UserProfile {
  return (
    'username' in profile || 'email' in profile || 'walletAddress' in profile
  );
}

/**
 * Type guard to check if profile is an actor profile
 */
export function isActorProfile(profile: ProfileInfo): profile is ActorProfile {
  return 'description' in profile && 'domain' in profile;
}

// ============================================================================
// Profile Widget & Data Display Types
// ============================================================================

/**
 * User balance data from /api/users/[userId]/balance
 */
export interface UserBalanceData {
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  lifetimePnL: number;
}

/**
 * User profile statistics
 */
export interface UserProfileStats {
  following: number;
  followers: number;
  totalActivity: number;
  positions?: number;
  comments?: number;
  reactions?: number;
}

// ============================================================================
// Market Position Types (for Profile Views)
// ============================================================================

/**
 * Base prediction market position from /api/markets/positions/[userId]
 */
export interface PredictionPosition {
  id: string;
  marketId: string;
  question: string;
  side: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  resolved: boolean;
  resolution?: boolean | null;
}

/**
 * Extended prediction position with PnL calculations for user portfolio views.
 * Extends PredictionPosition with computed fields for display.
 */
export interface UserPredictionPosition extends PredictionPosition {
  /** Current market value of the position (shares × currentPrice) */
  currentValue: number;
  /** Original cost of the position (shares × avgPrice) */
  costBasis: number;
  /** Unrealized profit/loss (currentValue - costBasis) */
  unrealizedPnL: number;
}

/**
 * Perp position from API response (/api/markets/positions/[userId])
 * This matches the actual API response structure
 */
export interface PerpPositionFromAPI {
  id: string;
  ticker: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  liquidationPrice: number;
  fundingPaid: number;
  openedAt: string;
}
