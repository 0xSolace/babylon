/**
 * Group Chat Configuration
 *
 * Centralizes all configurable parameters for the group chat invite system.
 * Values can be overridden via environment variables for testing and tuning.
 *
 * ## Environment Variables
 *
 * ### Invite Orchestrator
 * - `GROUP_CHAT_BASE_INVITE_PROBABILITY` (default: 0.15) - Base probability of sending invite
 * - `GROUP_CHAT_CANDIDATE_EXPIRY_HOURS` (default: 48) - Hours before queued candidate expires
 * - `GROUP_CHAT_MAX_CANDIDATES_PER_TICK` (default: 20) - Max candidates processed per tick
 * - `GROUP_CHAT_MIN_ENGAGEMENT_SCORE` (default: 25) - Min score to queue as candidate (0-100)
 * - `GROUP_CHAT_MAX_ACTIVE_USER_GROUPS` (default: 5) - Max groups a user can be in
 * - `GROUP_CHAT_INVITE_COOLDOWN_HOURS` (default: 4) - Hours after joining before next invite
 *
 * ### Tier Multipliers (affect NPC selectivity)
 * - `GROUP_CHAT_TIER_S_MULTIPLIER` (default: 0.3) - S_TIER NPCs are very selective
 * - `GROUP_CHAT_TIER_A_MULTIPLIER` (default: 0.5)
 * - `GROUP_CHAT_TIER_B_MULTIPLIER` (default: 0.7)
 * - `GROUP_CHAT_TIER_C_MULTIPLIER` (default: 0.9)
 * - `GROUP_CHAT_TIER_NONE_MULTIPLIER` (default: 1.0)
 *
 * ### NPC Group Dynamics
 * - `GROUP_CHAT_FORM_NEW_GROUP_CHANCE` (default: 0.05) - 5% chance per NPC to form group
 * - `GROUP_CHAT_JOIN_GROUP_CHANCE` (default: 0.1) - 10% chance to join if eligible
 * - `GROUP_CHAT_LEAVE_GROUP_CHANCE` (default: 0.02) - 2% chance per membership to leave
 * - `GROUP_CHAT_POST_MESSAGE_CHANCE` (default: 0.25) - 25% chance per group to post
 * - `GROUP_CHAT_INVITE_USER_CHANCE` (default: 0.08) - 8% chance per group to check invites
 * - `GROUP_CHAT_KICK_CHECK_CHANCE` (default: 0.15) - 15% chance to check for kicks
 * - `GROUP_CHAT_MIN_GROUP_SIZE` (default: 3)
 * - `GROUP_CHAT_MAX_GROUP_SIZE` (default: 12)
 * - `GROUP_CHAT_IDEAL_GROUP_SIZE` (default: 7)
 *
 * ## Usage Examples
 *
 * Testing with high invite rates:
 * ```bash
 * GROUP_CHAT_BASE_INVITE_PROBABILITY=0.9 bun run dev:web
 * ```
 *
 * Disable all invites:
 * ```bash
 * GROUP_CHAT_BASE_INVITE_PROBABILITY=0 bun run dev:web
 * ```
 *
 * Fast group formation for testing:
 * ```bash
 * GROUP_CHAT_FORM_NEW_GROUP_CHANCE=0.5 GROUP_CHAT_POST_MESSAGE_CHANCE=0.8 bun run dev:web
 * ```
 */

const env = (key: string, fallback: number): number => {
  const val = process.env[key];
  if (!val) return fallback;
  const n = Number(val);
  return Number.isNaN(n) ? fallback : n;
};

/** Group Invite Orchestrator Configuration */
export const GroupInviteConfig = {
  baseInviteProbability: env('GROUP_CHAT_BASE_INVITE_PROBABILITY', 0.15),
  candidateExpiryHours: env('GROUP_CHAT_CANDIDATE_EXPIRY_HOURS', 48),
  maxCandidatesPerTick: env('GROUP_CHAT_MAX_CANDIDATES_PER_TICK', 20),
  minEngagementScore: env('GROUP_CHAT_MIN_ENGAGEMENT_SCORE', 25),
  maxActiveUserGroups: env('GROUP_CHAT_MAX_ACTIVE_USER_GROUPS', 5),
  inviteCooldownHours: env('GROUP_CHAT_INVITE_COOLDOWN_HOURS', 4),
  cleanupDays: env('GROUP_CHAT_CLEANUP_DAYS', 7),
  inviteExpiryDays: env('GROUP_CHAT_INVITE_EXPIRY_DAYS', 3),
  tierMultipliers: {
    S_TIER: env('GROUP_CHAT_TIER_S_MULTIPLIER', 0.3),
    A_TIER: env('GROUP_CHAT_TIER_A_MULTIPLIER', 0.5),
    B_TIER: env('GROUP_CHAT_TIER_B_MULTIPLIER', 0.7),
    C_TIER: env('GROUP_CHAT_TIER_C_MULTIPLIER', 0.9),
    NONE: env('GROUP_CHAT_TIER_NONE_MULTIPLIER', 1.0),
  } as Record<string, number>,
};

/** NPC Group Dynamics Configuration */
export const NPCGroupDynamicsConfig = {
  formNewGroupChance: env('GROUP_CHAT_FORM_NEW_GROUP_CHANCE', 0.05),
  joinGroupChance: env('GROUP_CHAT_JOIN_GROUP_CHANCE', 0.1),
  leaveGroupChance: env('GROUP_CHAT_LEAVE_GROUP_CHANCE', 0.02),
  postMessageChance: env('GROUP_CHAT_POST_MESSAGE_CHANCE', 0.25),
  inviteUserChance: env('GROUP_CHAT_INVITE_USER_CHANCE', 0.08),
  kickCheckChance: env('GROUP_CHAT_KICK_CHECK_CHANCE', 0.15),
  minGroupSize: env('GROUP_CHAT_MIN_GROUP_SIZE', 3),
  maxGroupSize: env('GROUP_CHAT_MAX_GROUP_SIZE', 12),
  idealGroupSize: env('GROUP_CHAT_IDEAL_GROUP_SIZE', 7),
};

/** Group Chat Service Configuration (Sweep/Kick mechanics) */
export const GroupChatServiceConfig = {
  baseKickProbability: env('GROUP_CHAT_BASE_KICK_PROBABILITY', 0.00007),
  inactivityGracePeriodTicks: env('GROUP_CHAT_INACTIVITY_GRACE_TICKS', 1440),
  inactivityMaxTicks: env('GROUP_CHAT_INACTIVITY_MAX_TICKS', 7200),
  activitySweetSpotMin: env('GROUP_CHAT_ACTIVITY_SWEET_SPOT_MIN', 1),
  activitySweetSpotMax: env('GROUP_CHAT_ACTIVITY_SWEET_SPOT_MAX', 3),
  activityHardCap: env('GROUP_CHAT_ACTIVITY_HARD_CAP', 10),
};

/** Get all current configuration as a flat object (for logging/debugging) */
export function getGroupChatConfigSummary(): Record<string, number> {
  return {
    'invite.baseInviteProbability': GroupInviteConfig.baseInviteProbability,
    'invite.candidateExpiryHours': GroupInviteConfig.candidateExpiryHours,
    'invite.maxCandidatesPerTick': GroupInviteConfig.maxCandidatesPerTick,
    'invite.minEngagementScore': GroupInviteConfig.minEngagementScore,
    'invite.maxActiveUserGroups': GroupInviteConfig.maxActiveUserGroups,
    'invite.inviteCooldownHours': GroupInviteConfig.inviteCooldownHours,
    'invite.cleanupDays': GroupInviteConfig.cleanupDays,
    'invite.inviteExpiryDays': GroupInviteConfig.inviteExpiryDays,
    'dynamics.formNewGroupChance': NPCGroupDynamicsConfig.formNewGroupChance,
    'dynamics.joinGroupChance': NPCGroupDynamicsConfig.joinGroupChance,
    'dynamics.leaveGroupChance': NPCGroupDynamicsConfig.leaveGroupChance,
    'dynamics.postMessageChance': NPCGroupDynamicsConfig.postMessageChance,
    'dynamics.inviteUserChance': NPCGroupDynamicsConfig.inviteUserChance,
    'dynamics.kickCheckChance': NPCGroupDynamicsConfig.kickCheckChance,
    'dynamics.minGroupSize': NPCGroupDynamicsConfig.minGroupSize,
    'dynamics.maxGroupSize': NPCGroupDynamicsConfig.maxGroupSize,
    'service.baseKickProbability': GroupChatServiceConfig.baseKickProbability,
    'service.inactivityGracePeriodTicks':
      GroupChatServiceConfig.inactivityGracePeriodTicks,
  };
}

/** Validate configuration and return warnings for unusual values */
export function validateGroupChatConfig(): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  const probabilities: [string, number][] = [
    ['baseInviteProbability', GroupInviteConfig.baseInviteProbability],
    ['formNewGroupChance', NPCGroupDynamicsConfig.formNewGroupChance],
    ['joinGroupChance', NPCGroupDynamicsConfig.joinGroupChance],
    ['leaveGroupChance', NPCGroupDynamicsConfig.leaveGroupChance],
    ['postMessageChance', NPCGroupDynamicsConfig.postMessageChance],
    ['kickCheckChance', NPCGroupDynamicsConfig.kickCheckChance],
  ];

  for (const [name, value] of probabilities) {
    if (value < 0 || value > 1) warnings.push(`${name} (${value}) must be 0-1`);
    if (value > 0.5) warnings.push(`${name} (${value}) unusually high`);
  }

  for (const [tier, mult] of Object.entries(
    GroupInviteConfig.tierMultipliers
  )) {
    if (mult < 0 || mult > 2)
      warnings.push(`Tier ${tier} (${mult}) must be 0-2`);
  }

  if (
    NPCGroupDynamicsConfig.minGroupSize >= NPCGroupDynamicsConfig.maxGroupSize
  ) {
    warnings.push('minGroupSize must be < maxGroupSize');
  }

  return { valid: warnings.length === 0, warnings };
}
