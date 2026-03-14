/**
 * @fileoverview Constants for plugin-motivation
 *
 * WHY SEPARATE CONSTANTS?
 * -----------------------
 * Constants are extracted here because:
 * 1. They may need tuning based on testing with real agents
 * 2. They document the "magic numbers" with explanatory names
 * 3. They can be overridden by configuration without code changes
 *
 * THRESHOLD PHILOSOPHY
 * --------------------
 * Thresholds are set conservatively:
 * - "critical" triggers early (< 25 for drives) to give agents time to respond
 * - "balanced" is a wide band (40-55) because most of the time, drives are "fine"
 * - Asymmetric bands reflect that deficiency matters more than excess
 */

// =============================================================================
// EVENT NAMES
// =============================================================================

/**
 * Event names emitted by plugin-motivation.
 *
 * WHY EVENTS?
 * Events decouple us from consumers. Plugins that care about motivation
 * changes subscribe to events rather than polling or being called directly.
 * This allows:
 * - Multiple consumers without us knowing about them
 * - Consumers to filter for what they care about
 * - Async handling without blocking our update loop
 */
export const MotivationEvents = {
  /**
   * Emitted when motivation state changes.
   * This is the "catch-all" event — consumers can check what changed.
   */
  UPDATED: 'MOTIVATION_UPDATED',

  /**
   * Emitted when the priority list changes (different needs or different order).
   * WHY SEPARATE? Some consumers only care when priorities shift, not every update.
   */
  PRIORITIES_CHANGED: 'MOTIVATION_PRIORITIES_CHANGED',

  /**
   * Emitted when a new constraint activates.
   * WHY SEPARATE? Constraints are "stop conditions" that may need immediate attention.
   */
  CONSTRAINT_ACTIVATED: 'MOTIVATION_CONSTRAINT_ACTIVATED',

  /**
   * Emitted when the dominant frame shifts.
   * WHY SEPARATE? Frame shifts are significant events (e.g., entering survival mode)
   * that may trigger special handling in other plugins.
   */
  FRAME_SHIFTED: 'MOTIVATION_FRAME_SHIFTED',

  /**
   * Emitted when a goal candidate is identified (V3).
   * Prepared for future goal integration.
   */
  GOAL_CANDIDATE: 'MOTIVATION_GOAL_CANDIDATE',
} as const;

// =============================================================================
// SIGNAL THRESHOLDS
// =============================================================================

/**
 * Thresholds for converting drive values (0-100, 50=balanced) to signals.
 *
 * WHY THESE VALUES?
 * - CRITICAL (< 25): Low enough that the agent is in real trouble
 * - LOW (25-40): Noticeable deficiency that should be addressed
 * - BALANCED (40-55): Normal operating range, no action needed
 * - SATISFIED (55-75): Drive is well-met
 * - ABUNDANT (> 75): Excess that might be leveraged
 *
 * The bands are asymmetric because deficiency is more motivationally
 * significant than excess. A security of 30 (low) matters more than
 * a security of 70 (satisfied) — the former drives behavior, the latter doesn't.
 */
export const DriveThresholds = {
  CRITICAL: 25, // < 25 = critical deficiency
  LOW: 40, // 25-40 = noticeable deficiency
  BALANCED_LOW: 40, // Lower bound of "fine"
  BALANCED_HIGH: 55, // 40-55 = balanced, no action needed
  SATISFIED: 75, // 55-75 = well-met
  // > 75 = abundant (excess that might be leveraged)
} as const;

/**
 * Thresholds for converting physiological values (0-100, 0=satisfied) to signals.
 *
 * NOTE: Physiological uses INVERTED scale from drives!
 * - 0 = fully satisfied (no hunger, no fatigue)
 * - 100 = complete deprivation (starving, exhausted)
 *
 * WHY INVERTED?
 * This matches intuition: "hunger: 80" means very hungry, not 80% satisfied.
 * It's how homeostasis models these values.
 */
export const PhysiologicalThresholds = {
  SATISFIED: 20, // < 20 = body is fine
  MODERATE: 50, // 20-50 = noticeable but manageable
  HIGH: 75, // 50-75 = significant stress
  // > 75 = critical (survival mode territory)
} as const;

// =============================================================================
// INTENSITY VALUES
// =============================================================================

/**
 * Intensity values mapped from signal levels.
 *
 * WHY FIXED VALUES INSTEAD OF FORMULAS?
 * 1. Interpretability: "critical = 0.9" is clear; "intensity = 1 - (x/100)^1.5" is not
 * 2. Tunability: We can adjust these directly based on observed behavior
 * 3. Predictability: Same signal always gives same intensity
 *
 * WHY THESE SPECIFIC VALUES?
 * - 0.9 for critical: High but not 1.0 (leaves room for multiple critical items)
 * - 0.6 for low/high: Noticeable priority bump
 * - 0.3 for moderate: Slight bump, mostly informational
 * - 0.0 for balanced/satisfied: No action needed, no priority
 */
export const SignalIntensity = {
  // Drive signals → intensity
  drive: {
    critical: 0.9, // Urgent, must address
    low: 0.6, // Important, should address
    balanced: 0.0, // Fine, no action needed
    satisfied: 0.0, // Well-met, no action needed
    abundant: 0.0, // Excess is not a priority (might be an opportunity)
  },

  // Physiological signals → intensity
  physiological: {
    satisfied: 0.0, // Body is fine
    moderate: 0.3, // Noticeable, but manageable
    high: 0.6, // Should address soon
    critical: 0.9, // Must address now (survival mode)
  },
} as const;

// =============================================================================
// CONFIGURATION DEFAULTS
// =============================================================================

/**
 * Default configuration values.
 *
 * These can be overridden via environment variables or runtime settings.
 * We provide sensible defaults so the plugin works out-of-box.
 */
export const Defaults = {
  /**
   * Default interpretation frame.
   * WHY MASLOW? It's the most general-purpose frame. It doesn't assume
   * anything about the agent's personality — just that lower needs
   * should be addressed before higher ones.
   */
  DEFAULT_FRAME: 'maslow' as const,

  /**
   * Physiological level that forces survival frame (0-100).
   * WHY 75? This aligns with PhysiologicalThresholds.HIGH. When any
   * physiological variable exceeds this, the agent is in trouble and
   * should focus on immediate survival, not growth or social needs.
   */
  SURVIVAL_THRESHOLD: 75,

  /**
   * Minimum milliseconds between recalculations.
   * WHY 1000ms? Motivation doesn't change that fast. Recalculating more
   * often wastes CPU without providing meaningful updates. This throttle
   * also prevents event storms when multiple homeostasis updates arrive
   * in quick succession.
   */
  UPDATE_THROTTLE_MS: 1000,

  /**
   * Resource level considered "low".
   * WHY 100? This is a placeholder. Resource thresholds should really
   * be per-resource (money vs. energy have different scales). Future
   * work should make this configurable per resource type.
   */
  RESOURCE_LOW_THRESHOLD: 100,

  /**
   * Resource level considered "abundant".
   */
  RESOURCE_ABUNDANT_THRESHOLD: 1000,
} as const;

// =============================================================================
// PATTERN IDS
// =============================================================================

/**
 * Pattern IDs for reference.
 *
 * WHY NAMED CONSTANTS?
 * Type safety and autocomplete. Using 'survival_mode' as a string is
 * error-prone; using PatternIds.SURVIVAL_MODE catches typos at compile time.
 */
export const PatternIds = {
  // Internal patterns (from homeostasis)
  SURVIVAL_MODE: 'survival_mode',
  FOUNDATION_SHAKY: 'foundation_shaky',
  SEEKING_CONNECTION: 'seeking_connection',
  RECOGNITION_HUNGRY: 'recognition_hungry',
  FREEDOM_CONSTRAINED: 'freedom_constrained',
  PURPOSE_SEEKING: 'purpose_seeking',
  STABLE_FOUNDATION: 'stable_foundation',
  SOCIALLY_RESOURCED: 'socially_resourced',
  // Situational patterns (from appraisals) - Universal
  EXTERNAL_PRESSURE: 'external_pressure',
  EXTERNAL_TAILWIND: 'external_tailwind',
  // Situational patterns (from appraisals) - Domain-specific
  FINANCIAL_CONSTRAINT: 'financial_constraint',
  INFLUENCE_POSITION: 'influence_position',
  VISIBILITY_EXPOSURE: 'visibility_exposure',
} as const;

// =============================================================================
// APPRAISAL CONSTANTS
// =============================================================================

/**
 * Configuration for appraisal signal conversion.
 *
 * WHY APPRAISAL INTEGRATION?
 * --------------------------
 * Motivation was originally based only on internal state (homeostasis).
 * But real motivation combines:
 *
 *   internal (how I feel) + external (what's happening) = priorities
 *
 * Appraisals provide the external context. They come from domain evaluator
 * plugins (plugin-money, plugin-power, etc.) that assess external situations.
 *
 * WHY THESE DEFAULTS?
 * -------------------
 * - CONFIDENCE_THRESHOLD (0.3): Below this, the appraisal is too uncertain.
 *   Acting on uncertain information can cause erratic behavior. Better to
 *   treat low-confidence appraisals as "stable" (neutral) than noise.
 *
 * - Indicator maps allow domain-agnostic conversion: any evaluator plugin can
 *   use common payload patterns and get consistent signal conversion. This
 *   means motivation works with evaluator plugins it's never seen before.
 */
export const AppraisalDefaults = {
  /**
   * Minimum confidence to consider an appraisal meaningful.
   *
   * WHY 0.3?
   * --------
   * This threshold means "at least somewhat confident":
   * - Below 0.3: The evaluator is essentially guessing
   * - 0.3-0.7: Evaluator has some basis for assessment
   * - Above 0.7: Evaluator is quite confident
   *
   * We filter at 0.3 because uncertain appraisals add noise without signal.
   * If an evaluator says "I'm 20% confident money is critical", we shouldn't
   * act on that — it's more likely to mislead than inform.
   *
   * This threshold can be raised (e.g., to 0.5) if agents are too reactive
   * to uncertain situational factors.
   */
  CONFIDENCE_THRESHOLD: 0.3,
} as const;

/**
 * Maps payload indicator values to situational signals.
 *
 * WHY INDICATOR MAPS?
 * -------------------
 * Different evaluator plugins use different vocabulary to describe their domain:
 *
 * - plugin-money might use { status: 'cautious' }
 * - plugin-power might use { level: 'low' }
 * - plugin-relationships might use { state: 'declining' }
 * - A hypothetical plugin-health might use { condition: 'poor' }
 *
 * By mapping common keywords to signals, we achieve domain-agnostic conversion:
 *
 * 1. EXTENSIBILITY: New evaluator plugins "just work" if they use standard terms
 * 2. RESILIENCE: If a term isn't recognized, we default to 'stable' (neutral)
 * 3. CONSISTENCY: All domains use the same signal scale
 *
 * HOW CONVERSION WORKS:
 * ---------------------
 * 1. Extract indicator from payload (status || level || state || condition)
 * 2. Lowercase and check against each keyword list in order
 * 3. Return first matching signal level
 * 4. If no match, return 'stable' (safe default)
 *
 * ORDER MATTERS: We check from most severe to least severe. If an indicator
 * contains both "critical" and "stable" (unlikely but possible), critical wins.
 *
 * ADDING NEW KEYWORDS:
 * --------------------
 * If a new evaluator plugin uses vocabulary not covered here, add keywords to
 * the appropriate array. For example, if plugin-trust uses { status: 'betrayed' },
 * add 'betrayed' to the critical array.
 */
export const IndicatorMap = {
  /**
   * Critical indicators - external situation demands immediate attention.
   * These suggest the domain is in crisis and limiting all options.
   *
   * WHY THESE VALUES?
   * - 'none': Power plugin uses for zero influence/leverage
   * - 'isolated': Relationship plugin uses for no social connections
   */
  critical: [
    'critical',
    'emergency',
    'failing',
    'depleted',
    'crisis',
    'severe',
    'none',
    'isolated',
  ],

  /**
   * Strained indicators - external situation is concerning, limits options.
   * These suggest caution but not crisis.
   *
   * WHY THESE VALUES?
   * - 'contested', 'vulnerable': Power plugin control levels
   * - 'minimal': Notoriety plugin visibility/reach, Relationship interaction
   * - 'negative': Notoriety plugin sentiment level
   * - 'narrow': Notoriety/Relationship diversity
   * - 'sparse': Relationship plugin connection level
   */
  strained: [
    'cautious',
    'low',
    'strained',
    'declining',
    'at_risk',
    'weak',
    'poor',
    'unstable',
    'contested',
    'vulnerable',
    'minimal',
    'negative',
    'narrow',
    'sparse',
  ],

  /**
   * Stable indicators - external situation is neutral.
   * These suggest no particular concern or opportunity.
   *
   * WHY "mixed"? Notoriety plugin uses 'mixed' for ambiguous sentiment.
   */
  stable: [
    'stable',
    'moderate',
    'adequate',
    'neutral',
    'balanced',
    'okay',
    'normal',
    'mixed',
  ],

  /**
   * Favorable indicators - external situation is positive.
   * These suggest opportunity for action.
   *
   * WHY THESE VALUES?
   * - 'broad': Notoriety/Relationship diversity
   * - 'connected': Relationship plugin status
   * - 'active': Relationship plugin interaction level
   */
  favorable: [
    'good',
    'healthy',
    'improving',
    'growing',
    'positive',
    'solid',
    'broad',
    'connected',
    'active',
  ],

  /**
   * Strong indicators - external situation is very favorable.
   * These suggest bold action is enabled.
   *
   * WHY "dominant"? Power plugin uses 'dominant' for maximum influence.
   * WHY "thriving"? Relationship plugin uses for best connection status.
   */
  strong: [
    'secure',
    'strong',
    'high',
    'abundant',
    'excellent',
    'thriving',
    'robust',
    'dominant',
  ],
} as const;
