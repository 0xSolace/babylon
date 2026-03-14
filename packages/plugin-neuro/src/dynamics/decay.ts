/**
 * Memory Decay Engine
 *
 * WHY DECAY EXISTS:
 * ================
 * Human memory fades. Without decay:
 * - Old observations pollute context (things change!)
 * - Memory grows unbounded (performance degrades)
 * - Agent can't "forget" irrelevant information
 *
 * EXAMPLE PROBLEM WITHOUT DECAY:
 * Agent remembers "User was upset about bug" from 6 months ago.
 * Bug was fixed 5 months ago. User is now happy.
 * Without decay, agent still treats user as upset.
 *
 * THE HALF-LIFE MODEL:
 * ===================
 * We use radioactive decay math: value = initial * 0.5^(age / halfLife)
 *
 * Why half-life? It's intuitive and well-understood:
 * - After 1 half-life: 50% strength
 * - After 2 half-lives: 25% strength
 * - After 3 half-lives: 12.5% strength
 *
 * This is smoother than sudden expiration ("delete after 7 days").
 * Old memories fade gradually, not cliff-edge.
 *
 * PRESETS:
 * =======
 * Different memories should decay at different rates:
 * - Ephemeral (1 day): Observations, moods, transient states
 * - Standard (7 days): Typical conversations, preferences
 * - Persistent (30 days): Important patterns, relationships
 * - Core (1 year): Fundamental beliefs, identity
 * - Permanent: Never decays (system-critical data)
 */

export interface DecayConfig {
  /**
   * Time in milliseconds for value to decay to 50%.
   * WHY MS: JavaScript timestamps are in ms. Avoids conversion errors.
   */
  halfLifeMs: number;

  /**
   * Minimum effective value before memory is considered expired.
   * WHY 0.1 DEFAULT: At 10% strength, memory is essentially noise.
   * But keeping it at 0.1 (not 0) preserves some historical signal.
   */
  minValue: number;

  /**
   * Whether decay affects confidence.
   * WHY CONFIGURABLE: Some memories (core beliefs) should maintain
   * high confidence even as they age. Old doesn't mean uncertain.
   */
  decayConfidence: boolean;
}

// WHY SEPARATE CONFIG: Different memory types need different decay rates.
// A mood observation should fade fast; a trust assessment should persist.
export const DEFAULT_DECAY_CONFIG: DecayConfig = {
  halfLifeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  minValue: 0.1,
  decayConfidence: true,
};

/**
 * Preset decay rates for different memory types.
 *
 * WHY PRESETS:
 * Choosing decay rates is hard. Presets encode domain knowledge:
 * - "This is transient" → use ephemeral
 * - "This matters long-term" → use persistent
 * Reduces cognitive load on schema authors.
 */
export const DECAY_PRESETS = {
  /**
   * Fast decay for ephemeral observations.
   * USE FOR: Current mood, temporary states, transient context.
   * "User seems frustrated right now" (irrelevant by tomorrow)
   */
  ephemeral: {
    halfLifeMs: 24 * 60 * 60 * 1000,
    minValue: 0.1,
    decayConfidence: true,
  },

  /**
   * Medium decay for typical memories.
   * USE FOR: Conversations, preferences, recent patterns.
   * "User prefers dark mode" (might change, but probably stable)
   */
  standard: {
    halfLifeMs: 7 * 24 * 60 * 60 * 1000,
    minValue: 0.1,
    decayConfidence: true,
  },

  /**
   * Slow decay for important memories.
   * USE FOR: Relationship status, major events, established patterns.
   * "User is a paying customer" (important to remember long-term)
   */
  persistent: {
    halfLifeMs: 30 * 24 * 60 * 60 * 1000,
    minValue: 0.1,
    decayConfidence: true,
  },

  /**
   * Very slow decay for core memories.
   * USE FOR: Identity, core beliefs, fundamental relationships.
   * "User is team lead" (role changes rarely, high importance)
   * WHY NO CONFIDENCE DECAY: Core beliefs don't become uncertain with time.
   */
  core: {
    halfLifeMs: 365 * 24 * 60 * 60 * 1000,
    minValue: 0.2,
    decayConfidence: false,
  },

  /**
   * No decay - permanent storage.
   * USE FOR: System data, reference information, facts.
   * "Agent name is Alice" (never changes, always relevant)
   */
  permanent: { halfLifeMs: Infinity, minValue: 0, decayConfidence: false },
} as const;

/**
 * Calculate decay multiplier based on age.
 *
 * WHY RETURN MULTIPLIER (NOT DECAYED VALUE):
 * Caller might want to apply decay to different things:
 * - Confidence scores
 * - Priority weights
 * - Relevance rankings
 * Returning 0-1 multiplier is more flexible.
 */
export function calculateDecayMultiplier(
  ageMs: number,
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): number {
  // WHY CHECK INFINITY: Permanent memories never decay.
  // Math.pow(0.5, anything/Infinity) = Math.pow(0.5, 0) = 1
  // But explicit check is clearer and avoids float weirdness.
  if (config.halfLifeMs === Infinity) return 1;

  // WHY CHECK <= 0: Future timestamps (clock skew) or brand new memories.
  // Return 1 (full strength) rather than weird negative decay.
  if (ageMs <= 0) return 1;

  // THE MATH: 0.5^(age/halfLife)
  // At age = halfLife: 0.5^1 = 0.5
  // At age = 2*halfLife: 0.5^2 = 0.25
  const multiplier = Math.pow(0.5, ageMs / config.halfLifeMs);

  // WHY CLAMP TO minValue: Below minimum, memory is noise.
  // But we keep it at minValue (not 0) for historical signal.
  return Math.max(config.minValue, multiplier);
}

/**
 * Calculate effective value after decay.
 *
 * WHY now PARAMETER:
 * Testing needs deterministic time. Production uses Date.now().
 * Injecting time enables: "What will this memory be worth in 3 days?"
 */
export function getEffectiveValue(
  baseValue: number,
  createdAt: number,
  config: DecayConfig = DEFAULT_DECAY_CONFIG,
  now: number = Date.now()
): number {
  const ageMs = now - createdAt;
  const multiplier = calculateDecayMultiplier(ageMs, config);
  return baseValue * multiplier;
}

/**
 * Check if a memory has decayed below the minimum threshold.
 *
 * WHY SEPARATE FROM calculateDecayMultiplier:
 * Different use cases:
 * - "How strong is this memory?" → getEffectiveValue
 * - "Should I delete this memory?" → isExpired
 * Clear naming prevents misuse.
 */
export function isExpired(
  createdAt: number,
  config: DecayConfig = DEFAULT_DECAY_CONFIG,
  now: number = Date.now()
): boolean {
  const multiplier = calculateDecayMultiplier(now - createdAt, config);
  // WHY <= NOT <: At exactly minValue, memory is effectively expired.
  return multiplier <= config.minValue;
}

/**
 * Get decay status label for display.
 *
 * WHY LABELS:
 * "Decayed to 0.73" is meaningless.
 * "Recent memory" is actionable context.
 * Labels help both users and LLMs understand memory freshness.
 */
export function getDecayLabel(
  createdAt: number,
  config: DecayConfig = DEFAULT_DECAY_CONFIG,
  now: number = Date.now()
): string {
  const multiplier = calculateDecayMultiplier(now - createdAt, config);

  // WHY THESE THRESHOLDS: Rough correspondence to human intuition.
  // 90%+ = "I just saw this"
  // 70-90% = "That was recent"
  // 50-70% = "Getting older"
  // 30-50% = "That was a while ago"
  // <30% = "Ancient history"
  if (multiplier >= 0.9) return 'fresh';
  if (multiplier >= 0.7) return 'recent';
  if (multiplier >= 0.5) return 'aging';
  if (multiplier >= 0.3) return 'old';
  return 'stale';
}

/**
 * Refresh a memory's timestamp (called on reinforcement).
 *
 * WHY THIS FUNCTION EXISTS:
 * When a memory is reinforced (observed again), it becomes "fresh".
 * This is semantic—calling Date.now() in the schema is obvious,
 * but having refreshTimestamp() makes the intent clear.
 */
export function refreshTimestamp(): number {
  return Date.now();
}

/**
 * Calculate when a memory will expire based on current config.
 *
 * WHY THIS IS USEFUL:
 * - UI can show "Expires in 3 days"
 * - Cleanup jobs can schedule deletions
 * - Testing can verify decay timing
 */
export function getExpirationTime(
  createdAt: number,
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): number | null {
  // WHY NULL FOR PERMANENT: Permanent memories never expire.
  // Returning Infinity would be weird for display.
  if (config.halfLifeMs === Infinity) return null;

  // THE MATH: Solve for t when multiplier = minValue
  // minValue = 0.5^(t/halfLife)
  // log(minValue) = (t/halfLife) * log(0.5)
  // t = halfLife * log(minValue) / log(0.5)
  const t = (config.halfLifeMs * Math.log(config.minValue)) / Math.log(0.5);
  return createdAt + t;
}
