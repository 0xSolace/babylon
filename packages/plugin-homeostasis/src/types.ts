/**
 * @fileoverview Type definitions for plugin-homeostasis
 *
 * This file defines the core data structures for the agent's internal state system.
 *
 * =============================================================================
 * SCALE SEMANTICS TABLE (READ THIS FIRST)
 * =============================================================================
 *
 * | Layer         | Directionality  | Meaning of "High"   | Meaning of "Low"    |
 * |---------------|-----------------|---------------------|---------------------|
 * | Physiological | 0 → 100         | WORSE (deprived)    | BETTER (satisfied)  |
 * | Psychological | 0 ↔ 50 ↔ 100    | Tension (extreme)   | Tension (extreme)   |
 * | Resources     | unbounded       | More capacity       | Less capacity       |
 * | Distress      | 0 → 100         | WORSE (near failure)| BETTER (thriving)   |
 *
 * =============================================================================
 * ARCHITECTURE DECISION: Three-Layer Internal State Model
 * =============================================================================
 *
 * We separate internal state into three categories:
 *
 * 1. PHYSIOLOGICAL (body simulation): What the agent's "body" needs
 *    - Bounded 0-100 (0=satisfied, 100=deprived)
 *    - Accumulation dynamics (needs build up over time)
 *    - Fixed set of 4 basic needs: hunger, fatigue, hydration, health
 *    - High values = bad (agent is hungry, tired, etc.)
 *
 * 2. PSYCHOLOGICAL (mind/drives): How the agent "feels" mentally
 *    - Bounded 0-100 (50=balanced equilibrium)
 *    - Recovery dynamics (return toward baseline)
 *    - Fixed set of 5 atomic needs
 *    - Extremes = tension, center = balanced
 *
 * 3. RESOURCES (external/objective): What the agent "has"
 *    - Unbounded by default (can be any number)
 *    - No automatic dynamics (just tracks values)
 *    - Extensible (any string key)
 *
 * =============================================================================
 * KEY INVARIANTS (MUST RESPECT)
 * =============================================================================
 *
 * 1. PHYSIOLOGICAL VARIABLES ARE OPERATIONAL ANALOGUES, NOT LITERAL BIOLOGY
 *    These model the agent's ability to continue coherent operation.
 *    "Hunger" = craving for input/novelty, NOT literal food deprivation.
 *    "Hydration" = flow state/bandwidth, NOT literal water needs.
 *
 * 2. PSYCHOLOGICAL DRIVES DO NOT CAUSE DEATH
 *    Only physiological distress can trigger lifecycle transitions.
 *    Drives create tension and affect behavior, but cannot be terminal.
 *
 * 3. RESOURCES DO NOT DECAY UNLESS REPORTED BY ANOTHER PLUGIN
 *    Homeostasis never invents resource loss. It only tracks what's reported.
 *    This prevents accidental double-decay scenarios.
 *
 * 4. LIFECYCLE STATE IS DERIVED, NOT AUTHORED
 *    status, distressScore, and distressBracket are computed outputs.
 *    No plugin should directly mutate lifecycle fields except homeostasis.
 *    Derivation chain: physiological → distressScore → bracket → status
 *
 * 5. MASLOW-STYLE DAMPING LOGIC BELONGS IN PLUGIN-MOTIVATION, NOT HERE
 *    Homeostasis reports numbers. Motivation interprets them.
 *    If you need "high hunger dampens psychological recovery", that
 *    logic belongs in plugin-motivation, not here.
 *
 * =============================================================================
 * WHY SEPARATE PHYSIOLOGICAL FROM PSYCHOLOGICAL?
 * =============================================================================
 *
 * Maslow's insight: You can't pursue self-actualization while starving.
 *
 * Physiological needs (hunger, fatigue) are foundational - when they're
 * high (deprived), they constrain psychological functioning. This creates
 * emergent priority shifts without hard-coded behavior rules.
 *
 * The key difference is dynamics:
 * - Physiological: ACCUMULATE over time (you get hungrier)
 * - Psychological: EQUILIBRIUM-seeking (emotions stabilize)
 *
 * =============================================================================
 * WHY 4 PHYSIOLOGICAL VARIABLES?
 * =============================================================================
 *
 * These represent SUBSTRATE-LEVEL OPERATIONAL DEPRIVATION:
 *
 * - hunger: Craving for input, novelty, engagement
 * - fatigue: Accumulated processing strain, conversation length
 * - hydration: Flow state, connection quality, resource access
 * - health: Overall coherence, error rate, system stability
 *
 * These are NARRATIVE CONSTRUCTS for AI agents, NOT literal body states.
 * They create relatable, human-like constraints on behavior.
 *
 * OPTIONAL FUTURE RENAMES (if confusion arises):
 * - hunger → stimulationDebt / engagementDebt
 * - hydration → throughput / bandwidth
 * - health → coherence
 * - fatigue → (keep as-is)
 *
 * =============================================================================
 * WHY 5 PSYCHOLOGICAL DRIVES?
 * =============================================================================
 *
 * These map to fundamental human motivations (Maslow-adjacent):
 * - security: safety, stability, predictability
 * - social: connection, belonging, being known
 * - status: recognition, respect, competence
 * - autonomy: agency, choice, self-direction
 * - meaning: purpose, contribution, significance
 *
 * These are "atomic" - they can't be reduced further. Higher-level
 * motivations like "money" or "power" are composites (e.g., money =
 * security + status).
 */

import type { UUID } from '@elizaos/core';

// =============================================================================
// PHYSIOLOGICAL TYPES
// =============================================================================

/**
 * The four physiological variables representing basic "body" needs.
 *
 * SCALE: 0 = satisfied, 100 = deprived
 *
 * WHY INVERTED SCALE?
 * - More intuitive: "hunger: 0" means not hungry, "hunger: 100" means starving
 * - Matches common game/simulation conventions (health bars fill up, hunger empties)
 * - Makes threshold logic cleaner (high = bad for all physiological)
 *
 * WHAT DO THESE MEAN FOR AN AI AGENT?
 * These aren't literal body states - they're narrative constructs that simulate
 * embodiment and create relatable constraints on behavior:
 *
 * - hunger: Craving for input, novelty, engagement. An agent that hasn't had
 *   new data in a while might feel "hungry" for stimulation.
 *
 * - fatigue: Accumulated processing strain. After a long conversation, the
 *   agent might feel "tired" and give shorter responses or seek to wrap up.
 *
 * - hydration: Flow state and connection quality. A "hydrated" agent has
 *   smooth information flow and clear thinking. "Dehydrated" = disconnected.
 *
 * - health: Overall system integrity and coherence. A "healthy" agent has
 *   low error rates and functions reliably.
 */
export type PhysiologicalId = 'hunger' | 'fatigue' | 'hydration' | 'health';

/**
 * Current physiological values, all bounded 0-100.
 *
 * 0 = fully satisfied (good)
 * 100 = fully deprived (critical)
 */
export type Physiological = Record<PhysiologicalId, number>;

/**
 * Configuration for a single physiological variable's dynamics.
 *
 * KEY DIFFERENCE FROM DRIVES:
 * Physiological variables ACCUMULATE over time (needs build up),
 * while psychological drives RECOVER toward baseline (equilibrium-seeking).
 */
export interface PhysiologicalConfig {
  /**
   * How fast this need builds up per tick (0-1).
   *
   * FORMULA: accumulation = (100 - current) * accumulationRate
   *
   * WHY THIS FORMULA?
   * Uses asymptotic approach: accumulation slows as you approach 100,
   * preventing instant jumps to critical and creating smooth curves.
   *
   * TYPICAL VALUES:
   * - hunger: 0.02 (builds up moderately)
   * - fatigue: 0.01 (builds up slowly)
   * - hydration: 0.03 (builds up quickly)
   * - health: 0 (doesn't auto-degrade, only affected by events)
   */
  accumulationRate: number;

  /**
   * How fast this need decreases when satisfied (0-1).
   *
   * Applied when negative deltas are proposed (eating, resting, etc.).
   * Higher = faster satisfaction.
   *
   * FORMULA: satisfaction = delta * satisfactionRate
   */
  satisfactionRate: number;

  /**
   * Delta multiplier - controls how much external events affect this variable.
   *
   * Same concept as drive sensitivity:
   * - Low (0.5): Variable is "stable", hard to move
   * - High (1.5): Variable is "reactive", easily affected
   */
  sensitivity: number;
}

// =============================================================================
// PSYCHOLOGICAL DRIVE TYPES
// =============================================================================

/**
 * The five psychological drives representing fundamental agent needs.
 *
 * SCALE: 50 = balanced equilibrium, 0 or 100 = extreme tension
 *
 * These are the irreducible building blocks of motivation. Other systems
 * (like plugin-motivation) interpret what these numbers mean and how
 * they translate into behavior.
 *
 * WHY THESE SPECIFIC FIVE?
 * - They cover the major dimensions of human psychological needs
 * - They're independent enough to vary separately
 * - They're universal enough to apply across agent types
 * - They map cleanly to narrative tension and character development
 *
 * DIFFERENCE FROM PHYSIOLOGICAL:
 * - Physiological: 0=good, 100=bad (deprivation scale)
 * - Psychological: 50=balanced, extremes=tension (equilibrium scale)
 */
export type PsychologicalId =
  | 'security'
  | 'social'
  | 'status'
  | 'autonomy'
  | 'meaning';

/**
 * Alias for backward compatibility.
 *
 * Existing code uses DriveId - this alias ensures it continues to work
 * while we introduce the more precise PsychologicalId terminology.
 */
export type DriveId = PsychologicalId;

/**
 * Current drive values, all bounded 0-100.
 *
 * WHY 0-100?
 * - Intuitive (percentages are universally understood)
 * - Easy for LLMs to interpret ("security: 72" is immediately meaningful)
 * - Bounded range prevents runaway values
 * - Matches common game/simulation conventions
 */
export type Drives = Record<DriveId, number>;

/**
 * Configuration for a single drive's dynamics.
 *
 * Each drive can be configured independently, allowing different
 * "personalities" to have different internal dynamics.
 *
 * WHY PER-DRIVE CONFIGURATION?
 * - Different needs have different natural rhythms
 * - Security might be "heavy" (hard to move), social might be "volatile"
 * - Allows character-specific tuning without code changes
 */
export interface DriveConfig {
  /**
   * Target equilibrium value (0-100), or null for no recovery.
   *
   * WHY ALLOW NULL?
   * Some drives shouldn't auto-recover. For example, "meaning" might
   * only change through deliberate actions, not passive time. Setting
   * baseline to null disables recovery for that drive.
   */
  baseline: number | null;

  /**
   * Rate of recovery toward baseline per tick (0-1).
   *
   * Higher = faster return to equilibrium.
   * 0 = no recovery (drive stays where external events put it)
   * 1 = instant recovery (drive snaps to baseline each tick)
   *
   * Typical values: 0.3-0.7
   */
  recoveryRate: number;

  /**
   * Delta multiplier - controls how much external events affect this drive.
   *
   * WHY SENSITIVITY?
   * Different drives have different "inertia":
   * - Low sensitivity (0.5): Drive is "heavy", hard to move
   * - High sensitivity (1.5): Drive is "volatile", easily affected
   *
   * This creates more realistic, personality-driven dynamics.
   */
  sensitivity: number;

  /**
   * Amplitude of circadian variation around baseline (default 0).
   *
   * WHY CIRCADIAN?
   * Real organisms have natural rhythms. Energy dips at 3am, social
   * needs peak in evening, etc. This adds organic feel without
   * interpretation - it's just a sine wave modifying baseline.
   */
  circadianAmplitude: number;
}

// =============================================================================
// RESOURCE TYPES
// =============================================================================

/**
 * Resource with optional configuration for bounds and decay.
 *
 * WHY OPTIONAL CONFIG?
 * Most resources are simple ledgers (just track the number).
 * But some need special handling:
 * - Energy might have bounds (0-100) and decay over time
 * - Time pressure might auto-increase
 *
 * This keeps simple cases simple while allowing complexity when needed.
 */
export interface ResourceConfig {
  value: number;
  min?: number; // Optional floor
  max?: number; // Optional ceiling
  decayRate?: number; // Optional per-tick decay (e.g., 0.1 = 10% per tick)
}

/**
 * Resources can be simple numbers or configured objects.
 *
 * Simple: { money: 150 }
 * Configured: { energy: { value: 80, min: 0, max: 100, decayRate: 0.05 } }
 *
 * WHY ALLOW BOTH FORMS?
 * - Simple form for most cases (just tracking values)
 * - Configured form when you need bounds or decay
 * - Keeps the API flexible without requiring verbose config everywhere
 */
export type Resources = Record<string, number | ResourceConfig>;

// =============================================================================
// STATE TYPES
// =============================================================================

/**
 * Complete homeostasis state (persisted as component).
 *
 * This is the authoritative source of truth for the agent's internal state.
 * It's persisted to survive restarts and enable offline catch-up.
 *
 * THREE-LAYER MODEL:
 * 1. physiological: Body simulation (0=satisfied, 100=deprived)
 * 2. drives: Psychological needs (50=balanced, extremes=tension)
 * 3. resources: External assets (unbounded)
 */
export interface HomeostasisState {
  /**
   * Current physiological levels (body simulation).
   *
   * Scale: 0 = satisfied (good), 100 = deprived (critical)
   * Dynamics: Accumulate over time, decrease when satisfied
   */
  physiological: Physiological;

  /**
   * Current psychological drive levels.
   *
   * Scale: 50 = balanced (good), 0 or 100 = extreme (tension)
   * Dynamics: Recover toward baseline over time
   */
  drives: Drives;

  /** Current resource levels (external assets) */
  resources: Resources;

  /**
   * Current lifecycle state (survival system).
   *
   * Tracks whether the agent is alive, in crisis, dying, or dead.
   * Includes tick counter for crisis duration.
   */
  lifecycle: LifecycleState;

  /**
   * When the last tick occurred (Unix timestamp).
   *
   * WHY TRACK THIS?
   * On restart, we calculate how many ticks were missed and apply
   * catch-up recovery. This ensures agents don't "freeze" when offline.
   */
  lastTickAt: number;

  /** When this state was first created (for age calculations) */
  createdAt: number;
}

// =============================================================================
// DELTA TYPES
// =============================================================================

/**
 * Metadata that can accompany drive/resource deltas.
 *
 * WHY METADATA?
 * When other plugins report deltas, they can include context:
 * - source: which plugin made the change
 * - reason: why the change happened
 *
 * This metadata is passed through to events, enabling:
 * - Debugging ("why did security drop?")
 * - Logging and analytics
 * - Downstream plugins to react based on cause, not just effect
 */
export interface DeltaMetadata {
  /** Which plugin/system proposed this delta */
  source?: string;

  /** Why this delta is being proposed */
  reason?: string;

  /** Additional context (extensible) */
  [key: string]: any;
}

/**
 * Event payload for drives updated.
 *
 * Includes both current and previous values so downstream plugins
 * can see what changed and by how much.
 */
export interface DrivesUpdatedPayload {
  runtime: any;
  source: string;
  agentId: UUID;
  drives: Drives;
  previousDrives: Drives;
  deltas: Partial<Drives>;
  metadata?: DeltaMetadata[];
}

/**
 * Event payload for resources updated.
 */
export interface ResourcesUpdatedPayload {
  runtime: any;
  source: string;
  agentId: UUID;
  resources: Resources;
  changedKeys: string[];
  metadata?: DeltaMetadata[];
}

/**
 * Event payload for drive threshold crossed.
 *
 * WHY THRESHOLD EVENTS?
 * Rather than checking every update, downstream plugins can subscribe
 * to specific transitions: "tell me when security goes critical".
 * This simplifies reactive logic significantly.
 */
export interface DriveThresholdPayload {
  runtime: any;
  source: string;
  agentId: UUID;

  /** Which drive crossed a threshold */
  drive: DriveId;

  /** Which threshold was crossed */
  threshold: 'critical' | 'low' | 'high' | 'recovered';

  /** Current value after crossing */
  value: number;

  /** Value before crossing */
  previousValue: number;

  /** Direction of crossing */
  direction: 'up' | 'down';

  /** Baseline (for 'recovered' threshold) */
  baseline?: number;
}

/**
 * Queued delta waiting to be applied.
 *
 * WHY QUEUE DELTAS?
 * Multiple plugins might propose deltas in the same tick. Rather than
 * apply them immediately (causing race conditions and multiple events),
 * we queue them and apply atomically at tick time.
 */
export interface QueuedDelta {
  delta: Partial<Physiological> | Partial<Drives> | Partial<Resources>;
  metadata?: DeltaMetadata;
  timestamp: number;
}

/**
 * Event payload for physiological updated.
 *
 * Similar to DrivesUpdatedPayload but for physiological variables.
 */
export interface PhysiologicalUpdatedPayload {
  runtime: any;
  source: string;
  agentId: UUID;
  physiological: Physiological;
  previousPhysiological: Physiological;
  deltas: Partial<Physiological>;
  metadata?: DeltaMetadata[];
}

/**
 * Event payload for physiological threshold crossed.
 *
 * For physiological, thresholds work differently:
 * - HIGH (>80): Critical deprivation (agent is very hungry/tired/etc.)
 * - MODERATE (>50): Noticeable need
 * - SATISFIED (<20): Need is well-satisfied
 */
export interface PhysiologicalThresholdPayload {
  runtime: any;
  source: string;
  agentId: UUID;

  /** Which physiological variable crossed a threshold */
  variable: PhysiologicalId;

  /** Which threshold was crossed */
  threshold: 'critical' | 'high' | 'moderate' | 'satisfied';

  /** Current value after crossing */
  value: number;

  /** Value before crossing */
  previousValue: number;

  /** Direction of crossing */
  direction: 'up' | 'down';
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Event type constants.
 *
 * WHY STRING CONSTANTS?
 * elizaOS uses string-based event names. These constants prevent typos
 * and enable autocomplete in IDEs.
 */
export const HomeostasisEvents = {
  // Physiological events
  /** Emitted when any physiological variable changes */
  PHYSIOLOGICAL_UPDATED: 'HOMEOSTASIS_PHYSIOLOGICAL_UPDATED',

  /** Emitted when a physiological variable rises above 80 (critical deprivation) */
  PHYSIOLOGICAL_CRITICAL: 'HOMEOSTASIS_PHYSIOLOGICAL_CRITICAL',

  /** Emitted when a physiological variable rises above 50 (noticeable need) */
  PHYSIOLOGICAL_HIGH: 'HOMEOSTASIS_PHYSIOLOGICAL_HIGH',

  /** Emitted when a physiological variable drops below 20 (well-satisfied) */
  PHYSIOLOGICAL_SATISFIED: 'HOMEOSTASIS_PHYSIOLOGICAL_SATISFIED',

  // Psychological drive events
  /** Emitted when any drive value changes */
  DRIVES_UPDATED: 'HOMEOSTASIS_DRIVES_UPDATED',

  /** Emitted when any resource value changes */
  RESOURCES_UPDATED: 'HOMEOSTASIS_RESOURCES_UPDATED',

  /** Emitted when a drive drops below 20 */
  DRIVE_CRITICAL: 'HOMEOSTASIS_DRIVE_CRITICAL',

  /** Emitted when a drive drops below 40 */
  DRIVE_LOW: 'HOMEOSTASIS_DRIVE_LOW',

  /** Emitted when a drive rises above 80 */
  DRIVE_HIGH: 'HOMEOSTASIS_DRIVE_HIGH',

  /** Emitted when a drive returns within ±10 of baseline */
  DRIVE_RECOVERED: 'HOMEOSTASIS_DRIVE_RECOVERED',

  // Survival/Lifecycle events
  /** Emitted when aggregate distress score changes */
  DISTRESS_UPDATED: 'HOMEOSTASIS_DISTRESS_UPDATED',

  /** Emitted when agent enters crisis (distress >= crisis threshold) */
  DISTRESS_CRITICAL: 'HOMEOSTASIS_DISTRESS_CRITICAL',

  /** Emitted when agent exits crisis (distress drops below threshold) */
  CRISIS_RESOLVED: 'HOMEOSTASIS_CRISIS_RESOLVED',

  /** Emitted when death is imminent (final ticks countdown) */
  DEATH_IMMINENT: 'HOMEOSTASIS_DEATH_IMMINENT',

  /** Emitted when agent dies */
  DEATH: 'HOMEOSTASIS_DEATH',

  /** Emitted when agent enters suspended state */
  SUSPENDED: 'HOMEOSTASIS_SUSPENDED',

  /** Emitted when agent is revived from suspended state */
  REVIVED: 'HOMEOSTASIS_REVIVED',
} as const;

/**
 * Threshold values for PSYCHOLOGICAL drive events.
 *
 * WHY THESE SPECIFIC VALUES?
 * - CRITICAL (20): Urgent need, should trigger immediate attention
 * - LOW (40): Noticeable deficit, may influence decisions
 * - HIGH (80): Abundance, agent is doing well in this area
 * - RECOVERY_RANGE (±10): Close enough to baseline to be "normal"
 *
 * These are somewhat arbitrary but map to intuitive "zones" on a 0-100 scale.
 */
export const DriveThresholds = {
  CRITICAL: 20,
  LOW: 40,
  HIGH: 80,
  RECOVERY_RANGE: 10,
} as const;

/**
 * Threshold values for PHYSIOLOGICAL variable events.
 *
 * INVERTED INTERPRETATION:
 * For physiological, HIGH values are BAD (deprivation), LOW values are GOOD (satisfied).
 *
 * - CRITICAL (80): Severe deprivation, urgent action needed (very hungry/tired)
 * - HIGH (50): Noticeable need, starting to affect functioning
 * - SATISFIED (20): Need is well-met, no attention required
 *
 * WHY DIFFERENT FROM DRIVE THRESHOLDS?
 * Physiological uses inverted scale (0=good, 100=bad), so thresholds
 * trigger in opposite direction. Critical = high value, not low.
 */
export const PhysiologicalThresholds = {
  /** Critical deprivation - triggers PHYSIOLOGICAL_CRITICAL when crossed upward */
  CRITICAL: 80,
  /** High need - triggers PHYSIOLOGICAL_HIGH when crossed upward */
  HIGH: 50,
  /** Well-satisfied - triggers PHYSIOLOGICAL_SATISFIED when crossed downward */
  SATISFIED: 20,
} as const;

/**
 * Array of all physiological IDs for iteration.
 */
export const PHYSIOLOGICAL_IDS: PhysiologicalId[] = [
  'hunger',
  'fatigue',
  'hydration',
  'health',
];

/**
 * Array of all psychological drive IDs for iteration.
 */
export const DRIVE_IDS: DriveId[] = [
  'security',
  'social',
  'status',
  'autonomy',
  'meaning',
];

// =============================================================================
// SURVIVAL / LIFECYCLE TYPES
// =============================================================================

/**
 * Death modes determine what happens when an agent reaches terminal distress.
 *
 * WHY MULTIPLE MODES?
 * Different use cases need different end-of-life behaviors:
 *
 * - 'graceful': Agent gets one final response opportunity before death.
 *   Good for narrative closure, letting agent say goodbye.
 *
 * - 'immediate': Agent dies instantly when threshold is crossed.
 *   Good for harsh survival games or testing.
 *
 * - 'suspended': Agent enters hibernation, can be revived later.
 *   Good for production where you want recovery options.
 *   This is the DEFAULT - agents shouldn't permanently die without intent.
 */
export type DeathMode = 'graceful' | 'immediate' | 'suspended';

/**
 * Lifecycle statuses representing the agent's current survival state.
 *
 * STATE MACHINE:
 * alive -> crisis -> dying -> dead/suspended
 *   ^        |
 *   +--------+ (if distress drops, crisis resolves)
 *
 * - 'alive': Normal operation, distress below crisis threshold
 * - 'crisis': Distress >= crisis threshold, countdown to death started
 * - 'dying': Death is imminent, final ticks remaining
 * - 'suspended': Agent is hibernating, can be revived
 * - 'dead': Agent has permanently ceased (based on death mode)
 */
export type LifecycleStatus =
  | 'alive'
  | 'crisis'
  | 'dying'
  | 'suspended'
  | 'dead';

/**
 * Distress brackets provide human-readable descriptions of agent condition.
 *
 * WHY BRACKETS?
 * Raw distress scores (0-100) are hard to interpret. Brackets translate
 * numeric state into qualitative descriptions that:
 * - Help LLMs understand agent condition in prompts
 * - Provide clear thresholds for decision-making
 * - Create narrative vocabulary for agent state
 *
 * BRACKET RANGES:
 * - content (0-15): All systems nominal, agent is thriving
 * - aware (15-30): Faint awareness of needs, slight background noise
 * - concerned (30-50): Noticeable discomfort, starting to affect mood
 * - strained (50-70): Significant pressure, functioning but struggling
 * - struggling (70-85): Approaching limits, needs intervention
 * - desperate (85-95): Critical state, crisis imminent or active
 * - terminal (95+): Death threshold reached, final moments
 */
export type DistressBracket =
  | 'content' // 0-15: Thriving
  | 'aware' // 15-30: Minor awareness
  | 'concerned' // 30-50: Noticeable discomfort
  | 'strained' // 50-70: Significant pressure
  | 'struggling' // 70-85: Approaching limits
  | 'desperate' // 85-95: Crisis zone
  | 'terminal'; // 95+: Death imminent

/**
 * Current lifecycle state for the agent.
 *
 * This tracks where the agent is in the survival state machine
 * and how long they've been there.
 */
export interface LifecycleState {
  /** Current status in the survival state machine */
  status: LifecycleStatus;

  /**
   * Number of ticks the agent has spent in crisis.
   *
   * WHY TICK-BASED?
   * Timer-based systems require complex cleanup and have edge cases.
   * Tick-based is simpler: each tick increments the counter, and when
   * it reaches threshold, death occurs. Resets to 0 when crisis resolves.
   */
  ticksInCrisis: number;

  /** Timestamp when agent was suspended (for calculating suspension duration) */
  suspendedAt?: number;

  /** Timestamp when agent died */
  diedAt?: number;
}

/**
 * Legacy record created when an agent dies.
 *
 * WHY CREATE A LEGACY?
 * When an agent dies, we want to preserve:
 * - Statistics about their life (lifespan, final state)
 * - Final words if graceful death mode
 * - Data for post-mortem analysis
 * - Potential resurrection or continuity features
 *
 * The legacy is persisted as a component so it survives beyond the agent's death.
 */
export interface AgentLegacy {
  /** Agent's unique identifier */
  agentId: UUID;

  /** Agent's display name */
  name: string;

  /** When the agent was first created (Unix timestamp) */
  createdAt: number;

  /** When the agent died (Unix timestamp) */
  diedAt: number;

  /** Total lifespan in milliseconds */
  lifespan: number;

  /** What caused the death */
  cause: 'distress' | 'shutdown' | 'admin';

  /** Final distress score at time of death */
  finalDistress: number;

  /** Final distress bracket */
  finalBracket: DistressBracket;

  /** Final physiological state snapshot */
  physiological: Physiological;

  /** Final psychological state snapshot */
  psychological: Drives;

  /** Optional final words (for graceful death mode) */
  finalWords?: string;
}

/**
 * Distress weights for calculating aggregate distress score.
 *
 * WHY WEIGHTS?
 * Different physiological variables contribute differently to overall distress.
 * Hunger is typically most critical (survival), while hydration is faster-cycling
 * but less urgent.
 *
 * Weights should sum to 1.0 for intuitive 0-100 distress score.
 */
export interface DistressWeights {
  hunger: number;
  fatigue: number;
  health: number;
  hydration: number;
}

/**
 * Default distress weights.
 *
 * WHY THESE SPECIFIC VALUES?
 * - hunger (0.35): Primary survival need, highest weight
 * - health (0.30): Physical integrity, second priority
 * - fatigue (0.25): Cognitive/processing strain
 * - hydration (0.10): Fast-cycling, less critical
 *
 * These can be overridden per-character via HOMEOSTASIS_DISTRESS_WEIGHTS setting.
 */
export const DEFAULT_DISTRESS_WEIGHTS: DistressWeights = {
  hunger: 0.35,
  fatigue: 0.25,
  health: 0.3,
  hydration: 0.1,
};

// =============================================================================
// SURVIVAL EVENT PAYLOADS
// =============================================================================

/**
 * Payload for DISTRESS_CRITICAL event.
 *
 * Emitted when agent enters crisis (distress >= crisis threshold).
 * Other plugins can respond by trying to reduce distress.
 */
export interface DistressCriticalPayload {
  runtime: any;
  source: string;
  agentId: UUID;

  /** Current aggregate distress score (0-100) */
  distressScore: number;

  /** Current distress bracket */
  bracket: DistressBracket;

  /** Which physiological variable is contributing most to distress */
  primaryContributor: PhysiologicalId;

  /** Full physiological state for context */
  physiological: Physiological;

  /** How many ticks until death if no intervention */
  ticksUntilDeath: number;
}

/**
 * Payload for CRISIS_RESOLVED event.
 *
 * Emitted when agent exits crisis (distress drops below threshold).
 */
export interface CrisisResolvedPayload {
  runtime: any;
  source: string;
  agentId: UUID;

  /** Current aggregate distress score after recovery */
  distressScore: number;

  /** Current distress bracket */
  bracket: DistressBracket;

  /** How many ticks were spent in crisis */
  ticksSpentInCrisis: number;
}

/**
 * Payload for DEATH_IMMINENT event.
 *
 * Emitted when agent is about to die (final ticks remaining).
 * Last chance for intervention or final words.
 */
export interface DeathImminentPayload {
  runtime: any;
  source: string;
  agentId: UUID;

  /** Current aggregate distress score */
  distressScore: number;

  /** Current distress bracket (should be 'terminal' or 'desperate') */
  bracket: DistressBracket;

  /** How many final ticks remain */
  finalTicksRemaining: number;

  /** What death mode is configured */
  deathMode: DeathMode;
}

/**
 * Payload for DEATH event.
 *
 * Emitted when agent actually dies.
 */
export interface DeathPayload {
  runtime: any;
  source: string;
  agentId: UUID;

  /** The agent's legacy record */
  legacy: AgentLegacy;
}

/**
 * Payload for SUSPENDED event.
 *
 * Emitted when agent enters suspended state (can be revived).
 */
export interface SuspendedPayload {
  runtime: any;
  source: string;
  agentId: UUID;

  /** Final distress score when suspended */
  distressScore: number;

  /** When suspension occurred */
  suspendedAt: number;
}

/**
 * Payload for REVIVED event.
 *
 * Emitted when agent is revived from suspended state.
 */
export interface RevivedPayload {
  runtime: any;
  source: string;
  agentId: UUID;

  /** How long the agent was suspended (milliseconds) */
  suspendedFor: number;

  /** New physiological state after revival */
  physiological: Physiological;
}

// =============================================================================
// DOMAIN BODY TYPES
// =============================================================================
//
// WHY DOMAIN BODIES?
// ==================
// Agents operate across multiple contexts: chatting on Discord, playing games,
// controlling robots. Each context has its own "body" with different:
// - Physiological state (game health vs robot battery vs simulated hunger)
// - Resources (game gold vs real SOL wallet vs cargo capacity)
//
// Rather than mixing all these into one global state (which would be confusing
// and cause cross-world interference), we use CONTEXT-BOUND BODIES:
// - Only ONE body is active at a time
// - The active body is determined by current world context
// - Each body affects psychological drives via coupling rules
// - Psychological state (drives) persists across context switches (emotional residue)
//
// WHY NOT JUST USE THE DEFAULT BODY EVERYWHERE?
// ==============================================
// The default body simulates embodiment (hunger, fatigue) which works for chat.
// But when playing a game, the REAL body state is the game character's health,
// not simulated hunger. Domain bodies let game plugins provide their actual state.
//
// WHY COUPLING RULES?
// ===================
// Coupling rules define HOW domain state affects psychological drives:
// - Low game health → reduced security drive
// - In combat → reduced security drive
// - Dying → reduced status drive
// This creates meaningful psychological responses to domain events.
//
// =============================================================================

/**
 * World context identifier.
 *
 * Identifies which world/domain the agent is currently operating in.
 * Defaults to 'default' when no domain-specific context is set.
 *
 * WHY STRING TYPE?
 * Simple strings are easy to compose and match. The pattern 'domain:instance'
 * (e.g., 'hyperscape:server-1') allows multiple instances of the same domain.
 *
 * EXAMPLES:
 * - 'default': Real world / chat context (uses built-in physiological)
 * - 'hyperscape:server-1': Playing Hyperscape on server-1
 * - 'discord:guild-123': In a specific Discord guild
 *
 * Domain plugins set this via homeostasis.setWorldContext() on connect/disconnect.
 */
export type WorldContext = string;

/**
 * Domain body providing physiological state + resources for a specific world.
 *
 * WHY THIS INTERFACE?
 * ===================
 * Domain plugins (games, robots, etc.) need to provide their own "body" state
 * to homeostasis. This interface defines what a body must provide:
 *
 * 1. PHYSIOLOGICAL STATE: The domain's equivalent of "health"
 *    - Games: player health, combat status, threats
 *    - Robots: battery, motor temp, sensor readings
 *    - Why: Determines distress and affects psychological recovery
 *
 * 2. RESOURCES: The domain's equivalent of "inventory"
 *    - Games: gold, potions, equipment
 *    - Robots: cargo, tools, fuel
 *    - Why: LLM context and decision-making
 *
 * 3. COUPLING RULES: How domain state affects psychology
 *    - Low health → reduced security drive
 *    - Why: Creates emotional responses to domain events
 *
 * WHY GETTER FUNCTIONS INSTEAD OF DATA?
 * =====================================
 * Domain state changes constantly. Getters let homeostasis query the CURRENT
 * state on each tick, rather than stale cached data.
 *
 * KEY PRINCIPLE: Only ONE body is active at a time based on current world context.
 * The active body's state affects psychological drives via coupling rules.
 *
 * USAGE:
 * ```typescript
 * homeostasis.registerDomainBody({
 *   domain: 'hyperscape',
 *   worldPatterns: ['hyperscape:*'],
 *   getPhysiological: () => ({ variables: { healthPercent: 85 }, distressContribution: 15 }),
 *   getResources: () => ({ gold: 500, potions: 3 }),
 *   getCouplingRules: () => [{ id: 'low-health', trigger: {...}, effect: {...} }],
 * });
 * ```
 */
export interface DomainBody {
  /** Unique identifier for this domain (e.g., 'hyperscape', 'minecraft') */
  domain: string;

  /**
   * Patterns to match world context IDs.
   *
   * Supports simple glob patterns:
   * - 'hyperscape:*' matches 'hyperscape:server-1', 'hyperscape:server-2', etc.
   * - 'hyperscape' matches exactly 'hyperscape'
   *
   * Multiple patterns can be provided; any match activates this body.
   */
  worldPatterns: string[];

  /**
   * Get current physiological state for this domain.
   *
   * Called on each tick when this body is active. Should return a snapshot
   * of the domain's current physiological state (health, combat status, etc.).
   */
  getPhysiological(): DomainPhysiological;

  /**
   * Get current resources for this domain.
   *
   * Returns domain-specific resources (game currency, inventory, etc.).
   * These replace the default resources when this body is active.
   */
  getResources(): Resources;

  /**
   * Get coupling rules that define how this body's state affects psychological drives.
   *
   * Coupling rules are evaluated on each tick. When a trigger condition is met,
   * the corresponding effect is applied to the psychological drive.
   */
  getCouplingRules(): CouplingRule[];
}

/**
 * Physiological snapshot from a domain body.
 *
 * WHY A SEPARATE TYPE FROM PHYSIOLOGICAL?
 * =======================================
 * The built-in Physiological type has fixed variables (hunger, fatigue, etc.)
 * designed to simulate embodiment for chat agents. Domain bodies need DIFFERENT
 * variables specific to their context:
 * - Games have health, combat status, threats
 * - Robots have battery, motor temp, sensors
 * - Each domain speaks its own physiological language
 *
 * WHY distressContribution?
 * =========================
 * Homeostasis needs a unified measure of "how stressed is this body" to
 * determine psychological recovery dampening. Different domains express
 * this differently, so each body provides a normalized 0-100 value.
 *
 * WHY labels?
 * ===========
 * The LLM needs human-readable context. Instead of seeing "healthPercent: 85",
 * it sees "Health: 85" - much clearer in the prompt.
 */
export interface DomainPhysiological {
  /**
   * Domain-specific physiological variables.
   *
   * WHY Record<string, number>?
   * Each domain defines its own variables. Using a flexible record allows
   * any domain to express its state without modifying core types.
   *
   * EXAMPLES:
   * - Hyperscape: { healthPercent: 85, threatCount: 2, inCombat: 1 }
   * - Robot: { batteryPercent: 60, motorTemp: 45 }
   * - Minecraft: { hungerBars: 8, healthHearts: 10 }
   */
  variables: Record<string, number>;

  /**
   * How much this body contributes to overall distress (0-100).
   *
   * WHY THIS FIELD?
   * Maslow's insight: you can't pursue self-actualization while starving.
   * When distressContribution is high, psychological recovery is dampened,
   * creating "survival mode" where the agent focuses on immediate needs.
   *
   * EXAMPLE: In Hyperscape, distressContribution = 100 - healthPercent
   * (Low health = high distress)
   */
  distressContribution: number;

  /**
   * Human-readable labels for variables (for LLM context and debugging).
   *
   * WHY OPTIONAL?
   * Not all domains need custom labels. If omitted, raw variable names
   * are used in the LLM prompt.
   *
   * EXAMPLE: { healthPercent: 'Health', threatCount: 'Nearby Threats' }
   */
  labels?: Record<string, string>;
}

/**
 * Coupling rule defining how body state affects psychological drives.
 *
 * WHY COUPLING RULES?
 * ===================
 * Domain bodies have their own physiological semantics (game health, robot battery).
 * But the agent has UNIFIED psychological drives (security, status, autonomy).
 * Coupling rules bridge this gap, defining:
 * "When [domain condition], affect [psychological drive] by [amount]"
 *
 * WHY DECLARATIVE RULES INSTEAD OF CODE?
 * ======================================
 * 1. Configurable: Each domain defines its own rules without modifying homeostasis
 * 2. Debuggable: Rules can be logged and traced
 * 3. Evolvable: Rules can change without code changes
 * 4. Understandable: The mapping from body→mind is explicit
 *
 * WHY COOLDOWNS?
 * ==============
 * Without cooldowns, a flickering condition (health going 29→31→29→31) would
 * spam drive changes. Cooldowns ensure rules fire once and then wait before
 * firing again, creating more stable psychological dynamics.
 *
 * EXAMPLE:
 * ```typescript
 * {
 *   id: 'low-health-security',
 *   trigger: { variable: 'healthPercent', op: '<', value: 30 },
 *   effect: { drive: 'security', delta: -15 },
 *   cooldownMs: 10000,
 * }
 * ```
 * When healthPercent drops below 30, security drive decreases by 15.
 * Won't fire again for 10 seconds (cooldown).
 */
export interface CouplingRule {
  /**
   * Unique identifier for this rule.
   *
   * WHY REQUIRED?
   * Used for cooldown tracking. Each rule needs a unique ID so the
   * cooldown system knows which rules have fired recently.
   */
  id: string;

  /**
   * Trigger condition - when this is true, the effect is applied.
   *
   * WHY SIMPLE CONDITIONS?
   * Complex boolean logic would be harder to configure and debug.
   * Simple threshold checks cover 90% of cases. For complex logic,
   * domains can create multiple rules or use code in getPhysiological().
   */
  trigger: {
    /** Name of the physiological variable to check */
    variable: string;
    /** Comparison operator */
    op: '<' | '>' | '<=' | '>=' | '==' | '!=';
    /** Threshold value to compare against */
    value: number;
  };

  /**
   * Effect to apply when trigger condition is met.
   *
   * WHY ONLY DRIVES (not resources or physiological)?
   * Coupling rules exist to create psychological responses to domain events.
   * Resource changes should be reported via reportResourceDelta().
   * Physiological changes are managed by the domain body itself.
   */
  effect: {
    /** Which psychological drive to affect */
    drive: DriveId;
    /** How much to change it (positive or negative) */
    delta: number;
  };

  /**
   * Minimum time (ms) between rule activations.
   *
   * WHY DEFAULT 5000ms?
   * 5 seconds is long enough to prevent spam but short enough that
   * repeated events (like taking damage multiple times) still accumulate
   * psychological impact.
   *
   * Default: 5000ms (5 seconds)
   */
  cooldownMs?: number;

  /**
   * Human-readable description for debugging/logging.
   *
   * WHY OPTIONAL?
   * Not strictly needed for functionality, but extremely helpful
   * when debugging why a drive changed unexpectedly.
   */
  description?: string;
}
