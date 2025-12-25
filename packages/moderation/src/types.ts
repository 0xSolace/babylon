/**
 * @fileoverview Moderation types for Babylon-Jeju integration
 * @module @babylon/moderation/types
 *
 * This file contains only Babylon-specific extensions.
 */

import type { Address, Hex } from 'viem'

export { BanStatus, MarketOutcome, VotePosition } from '@babylon/shared'

// Types previously from @jejunetwork/sdk - defined locally to avoid dependency
export enum BanType {
  TEMPORARY = 'temporary',
  PERMANENT = 'permanent',
}

export enum CaseOutcome {
  PENDING = 'pending',
  UPHELD = 'upheld',
  OVERTURNED = 'overturned',
  DISMISSED = 'dismissed',
}

export enum CaseStatus {
  OPEN = 'open',
  VOTING = 'voting',
  RESOLVED = 'resolved',
  APPEALED = 'appealed',
}

export enum EvidencePosition {
  FOR = 'for',
  AGAINST = 'against',
}

export enum EvidenceStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export interface BanRecord {
  id: string
  userId: string
  type: BanType
  reason: string
  expiresAt?: Date
  createdAt: Date
}

export interface Evidence {
  id: string
  caseId: string
  submittedBy: string
  content: string
  position: EvidencePosition
  status: EvidenceStatus
  createdAt: Date
}

export interface ModerationCase {
  id: string
  reporterId: string
  targetId: string
  targetType: 'post' | 'user' | 'comment'
  category: string
  description: string
  status: CaseStatus
  outcome?: CaseOutcome
  evidence: Evidence[]
  createdAt: Date
  resolvedAt?: Date
}

export interface ReputationLabel {
  label: string
  score: number
  confidence: number
}

// ============================================================================
// Babylon-specific enums
// ============================================================================

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
// Babylon-specific types (not in SDK)
// ============================================================================

/** Babylon-specific ban case with Date fields for API responses */
export interface BanCase {
  caseId: Hex
  reporter: Address
  target: Address
  reporterStake: bigint
  targetStake: bigint
  reason: string
  evidenceHash: Hex
  status: number
  createdAt: number
  marketOpenUntil: number
  yesVotes: bigint
  noVotes: bigint
  totalPot: bigint
  resolved: boolean
  outcome: number
  appealCount: number
}

/** Stake information for moderation participants */
export interface StakeInfo {
  amount: bigint
  stakedAt: number
  stakedBlock: number
  lastActivityBlock: number
  isStaked: boolean
}

/** Vote record for a moderation case */
export interface Vote {
  position: number
  weight: bigint
  stakedAt: number
  hasVoted: boolean
  hasClaimed: boolean
}

/** Off-chain moderation report (pre-escalation) */
export interface ModerationReport {
  id: string
  reportType: 'user' | 'post' | 'agent'
  reporterId: string
  reportedId: string
  category: ReportCategory
  reason: string
  evidence?: string
  createdAt: Date
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed' | 'escalated'
  resolution?: string
  caseId?: Hex
}

// ============================================================================
// Integration Config Types
// ============================================================================

export interface JejuModerationConfig {
  moderationMarketplace: Address
  banManager: Address
  identityRegistry: Address
  chainId: number
  rpcUrl: string
}

export interface BabylonModerationConfig {
  banManager: Address
  identityRegistry: Address
  chainId: number
  rpcUrl: string
}

export interface CrossChainBanSync {
  sourceChainId: number
  targetChainId: number
  caseId: Hex
  targetAddress: Address
  status: number
  syncedAt: number
}

// ============================================================================
// A2A Protocol Extensions
// ============================================================================

export interface ModerationA2AMethods {
  'moderation.proposeBan': {
    params: {
      targetAddress: string
      reason: string
      category: ReportCategory
      evidence?: string
    }
    result: {
      caseId: string
      status: number
      marketOpenUntil: number
    }
  }
  'moderation.challengeBan': {
    params: {
      caseId: string
      stakeAmount: string
    }
    result: {
      success: boolean
      newStatus: number
    }
  }
  'moderation.vote': {
    params: {
      caseId: string
      position: 'yes' | 'no'
    }
    result: {
      success: boolean
      weight: string
    }
  }
  'moderation.getBanStatus': {
    params: {
      address: string
      appId?: string
    }
    result: {
      status: number
      reason?: string
      caseId?: string
    }
  }
  'moderation.getActiveCases': {
    params: {
      limit?: number
      offset?: number
    }
    result: {
      cases: BanCase[]
      total: number
    }
  }
}

// ============================================================================
// Event Types (for watchers)
// ============================================================================

export interface CaseOpenedEvent {
  caseId: Hex
  reporter: Address
  target: Address
  reporterStake: bigint
  reason: string
  evidenceHash: Hex
  timestamp: number
}

export interface CaseChallengedEvent {
  caseId: Hex
  target: Address
  targetStake: bigint
  totalPot: bigint
  timestamp: number
}

export interface VoteCastEvent {
  caseId: Hex
  voter: Address
  position: number
  weight: bigint
  timestamp: number
}

export interface CaseResolvedEvent {
  caseId: Hex
  outcome: number
  yesVotes: bigint
  noVotes: bigint
  timestamp: number
}

export interface BanAppliedEvent {
  target: Address
  caseId: Hex
  reason: string
  timestamp: number
}

export interface BanRemovedEvent {
  target: Address
  caseId: Hex
  timestamp: number
}
