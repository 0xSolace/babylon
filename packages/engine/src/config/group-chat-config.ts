/**
 * Group Chat Configuration
 *
 * Centralizes all configurable parameters for the group chat invite system.
 * Values can be overridden via environment variables for testing and tuning.
 *
 * Environment Variable Format: GROUP_CHAT_{CONSTANT_NAME}
 *
 * @example Testing with high invite rates:
 * GROUP_CHAT_BASE_INVITE_PROBABILITY=0.9 bun run dev:web
 */

function parseFloat(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function parseInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Group Invite Orchestrator Configuration
 */
export const GroupInviteConfig = {
  /** Base probability of sending invite when processing a candidate (0-1) */
  baseInviteProbability: parseFloat(
    process.env.GROUP_CHAT_BASE_INVITE_PROBABILITY,
    0.15
  ),

  /** Hours before a queued candidate expires if not processed */
  candidateExpiryHours: parseInt(
    process.env.GROUP_CHAT_CANDIDATE_EXPIRY_HOURS,
    48
  ),

  /** Maximum candidates to process per game tick */
  maxCandidatesPerTick: parseInt(
    process.env.GROUP_CHAT_MAX_CANDIDATES_PER_TICK,
    20
  ),

  /** Minimum engagement score required to be queued as candidate (0-100) */
  minEngagementScore: parseInt(
    process.env.GROUP_CHAT_MIN_ENGAGEMENT_SCORE,
    25
  ),

  /** Maximum active groups a user can be in simultaneously */
  maxActiveUserGroups: parseInt(
    process.env.GROUP_CHAT_MAX_ACTIVE_USER_GROUPS,
    5
  ),

  /** Hours after joining a group before eligible for next invite */
  inviteCooldownHours: parseInt(
    process.env.GROUP_CHAT_INVITE_COOLDOWN_HOURS,
    4
  ),

  /** Tier multipliers affecting invite selectivity (lower = more selective) */
  tierMultipliers: {
    S_TIER: parseFloat(process.env.GROUP_CHAT_TIER_S_MULTIPLIER, 0.3),
    A_TIER: parseFloat(process.env.GROUP_CHAT_TIER_A_MULTIPLIER, 0.5),
    B_TIER: parseFloat(process.env.GROUP_CHAT_TIER_B_MULTIPLIER, 0.7),
    C_TIER: parseFloat(process.env.GROUP_CHAT_TIER_C_MULTIPLIER, 0.9),
    NONE: parseFloat(process.env.GROUP_CHAT_TIER_NONE_MULTIPLIER, 1.0),
  } as Record<string, number>,
};

/**
 * NPC Group Dynamics Configuration
 */
export const NPCGroupDynamicsConfig = {
  /** Probability per NPC per tick to form a new group (0-1) */
  formNewGroupChance: parseFloat(
    process.env.GROUP_CHAT_FORM_NEW_GROUP_CHANCE,
    0.05
  ),

  /** Probability for NPC to join an existing group if eligible (0-1) */
  joinGroupChance: parseFloat(
    process.env.GROUP_CHAT_JOIN_GROUP_CHANCE,
    0.1
  ),

  /** Probability per membership per tick for NPC to leave a group (0-1) */
  leaveGroupChance: parseFloat(
    process.env.GROUP_CHAT_LEAVE_GROUP_CHANCE,
    0.02
  ),

  /** Probability per active group per tick for NPC to post a message (0-1) */
  postMessageChance: parseFloat(
    process.env.GROUP_CHAT_POST_MESSAGE_CHANCE,
    0.25
  ),

  /** Probability per group with space per tick to check for user invites (0-1) */
  inviteUserChance: parseFloat(
    process.env.GROUP_CHAT_INVITE_USER_CHANCE,
    0.08
  ),

  /** Probability per tick to check for kicks (0-1) */
  kickCheckChance: parseFloat(
    process.env.GROUP_CHAT_KICK_CHECK_CHANCE,
    0.15
  ),

  /** Minimum group size */
  minGroupSize: parseInt(process.env.GROUP_CHAT_MIN_GROUP_SIZE, 3),

  /** Maximum group size */
  maxGroupSize: parseInt(process.env.GROUP_CHAT_MAX_GROUP_SIZE, 12),

  /** Ideal group size for dynamics calculations */
  idealGroupSize: parseInt(process.env.GROUP_CHAT_IDEAL_GROUP_SIZE, 7),
};

/**
 * Group Chat Service Configuration (Sweep/Kick mechanics)
 */
export const GroupChatServiceConfig = {
  /** Base kick probability per tick */
  baseKickProbability: parseFloat(
    process.env.GROUP_CHAT_BASE_KICK_PROBABILITY,
    0.00007
  ),

  /** Ticks of inactivity before kick consideration starts (1 day = 1440 ticks) */
  inactivityGracePeriodTicks: parseInt(
    process.env.GROUP_CHAT_INACTIVITY_GRACE_TICKS,
    1440
  ),

  /** Ticks of inactivity that triggers max kick probability (5 days = 7200 ticks) */
  inactivityMaxTicks: parseInt(
    process.env.GROUP_CHAT_INACTIVITY_MAX_TICKS,
    7200
  ),

  /** Minimum messages per window for "sweet spot" participation */
  activitySweetSpotMin: parseInt(
    process.env.GROUP_CHAT_ACTIVITY_SWEET_SPOT_MIN,
    1
  ),

  /** Maximum messages per window for "sweet spot" participation */
  activitySweetSpotMax: parseInt(
    process.env.GROUP_CHAT_ACTIVITY_SWEET_SPOT_MAX,
    3
  ),

  /** Messages per window that triggers spam consideration */
  activityHardCap: parseInt(process.env.GROUP_CHAT_ACTIVITY_HARD_CAP, 10),
};

/**
 * Get all current configuration as a flat object (for logging/debugging)
 */
export function getGroupChatConfigSummary(): Record<string, number> {
  return {
    'invite.baseInviteProbability': GroupInviteConfig.baseInviteProbability,
    'invite.candidateExpiryHours': GroupInviteConfig.candidateExpiryHours,
    'invite.maxCandidatesPerTick': GroupInviteConfig.maxCandidatesPerTick,
    'invite.minEngagementScore': GroupInviteConfig.minEngagementScore,
    'invite.maxActiveUserGroups': GroupInviteConfig.maxActiveUserGroups,
    'invite.inviteCooldownHours': GroupInviteConfig.inviteCooldownHours,
    'dynamics.formNewGroupChance': NPCGroupDynamicsConfig.formNewGroupChance,
    'dynamics.joinGroupChance': NPCGroupDynamicsConfig.joinGroupChance,
    'dynamics.leaveGroupChance': NPCGroupDynamicsConfig.leaveGroupChance,
    'dynamics.postMessageChance': NPCGroupDynamicsConfig.postMessageChance,
    'dynamics.inviteUserChance': NPCGroupDynamicsConfig.inviteUserChance,
    'dynamics.kickCheckChance': NPCGroupDynamicsConfig.kickCheckChance,
    'dynamics.minGroupSize': NPCGroupDynamicsConfig.minGroupSize,
    'dynamics.maxGroupSize': NPCGroupDynamicsConfig.maxGroupSize,
    'service.baseKickProbability': GroupChatServiceConfig.baseKickProbability,
    'service.inactivityGracePeriodTicks': GroupChatServiceConfig.inactivityGracePeriodTicks,
  };
}

/**
 * Validate configuration and log warnings for unusual values
 */
export function validateGroupChatConfig(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check probabilities are in valid range
  const probabilities = [
    ['baseInviteProbability', GroupInviteConfig.baseInviteProbability],
    ['formNewGroupChance', NPCGroupDynamicsConfig.formNewGroupChance],
    ['joinGroupChance', NPCGroupDynamicsConfig.joinGroupChance],
    ['leaveGroupChance', NPCGroupDynamicsConfig.leaveGroupChance],
    ['postMessageChance', NPCGroupDynamicsConfig.postMessageChance],
    ['inviteUserChance', NPCGroupDynamicsConfig.inviteUserChance],
    ['kickCheckChance', NPCGroupDynamicsConfig.kickCheckChance],
  ] as const;

  for (const [name, value] of probabilities) {
    if (value < 0 || value > 1) {
      warnings.push(`${name} (${value}) should be between 0 and 1`);
    }
    if (value > 0.5) {
      warnings.push(`${name} (${value}) is unusually high - may cause spam`);
    }
  }

  // Check tier multipliers
  for (const [tier, mult] of Object.entries(GroupInviteConfig.tierMultipliers)) {
    if (mult < 0 || mult > 2) {
      warnings.push(`Tier multiplier ${tier} (${mult}) should be between 0 and 2`);
    }
  }

  // Check group sizes make sense
  if (NPCGroupDynamicsConfig.minGroupSize >= NPCGroupDynamicsConfig.maxGroupSize) {
    warnings.push('minGroupSize should be less than maxGroupSize');
  }

  return { valid: warnings.length === 0, warnings };
}

