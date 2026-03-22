/**
 * Shared types for waitlist dashboard components (aligned with GET /api/waitlist/position
 * and GET /api/waitlist/leaderboard payloads).
 */

import type { UserDisplayFields } from '@/lib/user-display';

export type LeaderboardTab = 'leaderboard' | 'inviters';

export type ReferralTab = 'qualified' | 'pending';

/** Row in invited / qualified referral lists */
export interface ReferralUser {
  id: string;
  username?: string | null;
  displayName?: string | null;
  profileImageUrl?: string | null;
  email?: string | null;
  farcasterUsername?: string | null;
  twitterUsername?: string | null;
  createdAt: string;
  completedAt?: string;
  status?: 'pending' | 'qualified';
}

/** Dashboard payload (subset of waitlist position + leaderboard context) */
export interface WaitlistData {
  position: number;
  percentile: number;
  waitlistPosition: number;
  totalAhead: number;
  totalCount: number;
  points: number;
  leaderboardRank?: number | null;
  referralCount?: number;
  pointsBreakdown?: {
    total: number;
    invite: number;
    earned?: number;
    bonus?: number;
    base?: number;
  };
  invitedUsers?: ReferralUser[];
  qualifiedUsers?: ReferralUser[];
  invitedCount?: number;
  qualifiedCount?: number;
  totalReferralPoints?: number;
}

/** Leaderboard row from WaitlistService.getTopWaitlistUsers */
export interface TopUser extends UserDisplayFields {
  id: string;
  rank: number;
  referralCount: number;
  reputationPoints: number;
  invitePoints: number;
}

export interface ProfileFormState {
  displayName: string;
  username: string;
  bio: string;
  coverImageUrl?: string | null;
  profileImageUrl?: string | null;
}

export type UsernameStatus = 'available' | 'taken' | 'idle';
