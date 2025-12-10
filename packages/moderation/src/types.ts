/**
 * @fileoverview Moderation types for Babylon-Jeju integration
 * @module @babylon/moderation/types
 */

import type { Address } from 'viem';

// ============================================================================
// Enums
// ============================================================================

export enum BanStatus {
  NONE = 0,
  ON_NOTICE = 1,
  CHALLENGED = 2,
  BANNED = 3,
  CLEARED = 4,
  APPEALING = 5,
}

export enum VotePosition {
  YES = 0,
  NO = 1,
}

export enum MarketOutcome {
  PENDING = 0,
  BAN_UPHELD = 1,
  BAN_REJECTED = 2,
}

export enum ReportCategory {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  HATE_SPEECH = 'hate_speech',
  VIOLENCE = 'violence',
  MISINFORMATION = 'misinformation',
  INAPPROPRIATE = 'inappropriate',
  IMPERSONATION = 'impersonation',
  SELF_HARM = 'self_harm',
  CSAM = 'csam',
  ILLEGAL = 'illegal',
  OTHER = 'other',
}

// ============================================================================
// Core Types
// ============================================================================

export interface BanCase {
  caseId: `0x${string}`;
  reporter: Address;
  target: Address;
  reporterStake: bigint;
  targetStake: bigint;
  reason: string;
  evidenceHash: `0x${string}`;
  status: BanStatus;
  createdAt: number;
  marketOpenUntil: number;
  yesVotes: bigint;
  noVotes: bigint;
  totalPot: bigint;
  resolved: boolean;
  outcome: MarketOutcome;
  appealCount: number;
}

export interface StakeInfo {
  amount: bigint;
  stakedAt: number;
  stakedBlock: number;
  lastActivityBlock: number;
  isStaked: boolean;
}

export interface Vote {
  position: VotePosition;
  weight: bigint;
  stakedAt: number;
  hasVoted: boolean;
  hasClaimed: boolean;
}

export interface ModerationReport {
  id: string;
  reportType: 'user' | 'post' | 'agent';
  reporterId: string;
  reportedId: string;
  category: ReportCategory;
  reason: string;
  evidence?: string;
  createdAt: Date;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed' | 'escalated';
  resolution?: string;
  caseId?: `0x${string}`; // Link to on-chain case if escalated
}

// ============================================================================
// Integration Types
// ============================================================================

export interface JejuModerationConfig {
  moderationMarketplace: Address;
  banManager: Address;
  identityRegistry: Address;
  chainId: number;
  rpcUrl: string;
}

export interface BabylonModerationConfig {
  banManager: Address;
  identityRegistry: Address;
  chainId: number;
  rpcUrl: string;
}

export interface CrossChainBanSync {
  sourceChainId: number;
  targetChainId: number;
  caseId: `0x${string}`;
  targetAddress: Address;
  status: BanStatus;
  syncedAt: number;
}

// ============================================================================
// A2A Protocol Extensions
// ============================================================================

export interface ModerationA2AMethods {
  'moderation.proposeBan': {
    params: {
      targetAddress: string;
      reason: string;
      category: ReportCategory;
      evidence?: string;
    };
    result: {
      caseId: string;
      status: BanStatus;
      marketOpenUntil: number;
    };
  };
  'moderation.challengeBan': {
    params: {
      caseId: string;
      stakeAmount: string; // In wei
    };
    result: {
      success: boolean;
      newStatus: BanStatus;
    };
  };
  'moderation.vote': {
    params: {
      caseId: string;
      position: 'yes' | 'no';
    };
    result: {
      success: boolean;
      weight: string; // In wei
    };
  };
  'moderation.getBanStatus': {
    params: {
      address: string;
      appId?: string;
    };
    result: {
      status: BanStatus;
      reason?: string;
      caseId?: string;
    };
  };
  'moderation.getActiveCases': {
    params: {
      limit?: number;
      offset?: number;
    };
    result: {
      cases: BanCase[];
      total: number;
    };
  };
}

// ============================================================================
// Event Types
// ============================================================================

export interface CaseOpenedEvent {
  caseId: `0x${string}`;
  reporter: Address;
  target: Address;
  reporterStake: bigint;
  reason: string;
  evidenceHash: `0x${string}`;
  timestamp: number;
}

export interface CaseChallengedEvent {
  caseId: `0x${string}`;
  target: Address;
  targetStake: bigint;
  totalPot: bigint;
  timestamp: number;
}

export interface VoteCastEvent {
  caseId: `0x${string}`;
  voter: Address;
  position: VotePosition;
  weight: bigint;
  timestamp: number;
}

export interface CaseResolvedEvent {
  caseId: `0x${string}`;
  outcome: MarketOutcome;
  yesVotes: bigint;
  noVotes: bigint;
  timestamp: number;
}

export interface BanAppliedEvent {
  target: Address;
  caseId: `0x${string}`;
  reason: string;
  timestamp: number;
}

export interface BanRemovedEvent {
  target: Address;
  caseId: `0x${string}`;
  timestamp: number;
}
