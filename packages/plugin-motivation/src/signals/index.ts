/**
 * @fileoverview State → Signals conversion
 *
 * WHY SIGNALS?
 * ------------
 * Homeostasis gives us continuous values: security = 37, hunger = 62.
 * These numbers are precise but not meaningful. What does 37 mean?
 *
 * Signals convert numbers to categories: security = 'low', hunger = 'high'.
 * This transformation has several benefits:
 *
 * 1. INTERPRETABILITY
 *    "low" is meaningful; 37 is not.
 *    Humans and LLMs think in categories, not decimals.
 *
 * 2. THRESHOLD HONESTY
 *    Is 37 meaningfully different from 38? Probably not.
 *    Buckets acknowledge that precision beyond categories is false precision.
 *
 * 3. PATTERN MATCHING
 *    Patterns can match on categories: "if security is low AND social is balanced"
 *    This is clearer than: "if security < 40 && social >= 40 && social < 55"
 *
 * 4. LLM COMPATIBILITY
 *    LLMs work with language. "low security" is better context than "security: 37".
 *
 * SIGNAL TYPES
 * ------------
 * - DRIVE SIGNALS: critical | low | balanced | satisfied | abundant
 *   Drives use 0-100 scale with 50 = balanced
 *
 * - PHYSIOLOGICAL SIGNALS: satisfied | moderate | high | critical
 *   Physiological uses 0-100 scale with 0 = satisfied (inverted from drives)
 *
 * - RESOURCE SIGNALS: low | adequate | abundant
 *   Resources are positive values with configurable thresholds
 */

import type { Appraisal } from '../appraisal-types.ts';
import {
  AppraisalDefaults,
  Defaults,
  DriveThresholds,
  IndicatorMap,
  PhysiologicalThresholds,
} from '../constants.ts';
import type { Drives, Physiological, Resources } from '../homeostasis-types.ts';
import type {
  DriveSignal,
  PhysiologicalSignal,
  ResourceSignal,
  SignalState,
  SituationalSignal,
} from '../types.ts';

/**
 * Convert a drive value (0-100, 50=balanced) to a signal.
 *
 * THRESHOLDS:
 * - critical:  < 25  — Severe deficiency, urgent need
 * - low:       25-40 — Noticeable deficiency
 * - balanced:  40-55 — Normal operating range
 * - satisfied: 55-75 — Drive is well-met
 * - abundant:  > 75  — Excess (may be leveraged)
 *
 * WHY ASYMMETRIC?
 * Deficiency is more motivationally significant than excess.
 * Being at 30 (low) matters more than being at 70 (satisfied).
 */
export function driveToSignal(value: number): DriveSignal {
  if (value < DriveThresholds.CRITICAL) return 'critical';
  if (value < DriveThresholds.LOW) return 'low';
  if (value < DriveThresholds.BALANCED_HIGH) return 'balanced';
  if (value < DriveThresholds.SATISFIED) return 'satisfied';
  return 'abundant';
}

/**
 * Convert a physiological value (0-100, 0=satisfied, 100=deprived) to a signal.
 *
 * NOTE: INVERTED SCALE from drives!
 * - 0 = body is satisfied (no hunger, no fatigue)
 * - 100 = complete deprivation (starving, exhausted)
 *
 * THRESHOLDS:
 * - satisfied: < 20  — Body is fine
 * - moderate:  20-50 — Noticeable but manageable
 * - high:      50-75 — Significant stress
 * - critical:  > 75  — Survival mode territory
 *
 * WHY INVERTED?
 * This matches intuition: "hunger: 80" means very hungry.
 * It's how homeostasis models physiological values.
 */
export function physiologicalToSignal(value: number): PhysiologicalSignal {
  if (value < PhysiologicalThresholds.SATISFIED) return 'satisfied';
  if (value < PhysiologicalThresholds.MODERATE) return 'moderate';
  if (value < PhysiologicalThresholds.HIGH) return 'high';
  return 'critical';
}

/**
 * Convert a resource value to a signal.
 *
 * WHY CONFIGURABLE THRESHOLDS?
 * Different resources have different scales. Money might be measured
 * in thousands while energy is measured in units. Future work should
 * make thresholds per-resource.
 */
export function resourceToSignal(
  value: number,
  lowThreshold: number = Defaults.RESOURCE_LOW_THRESHOLD,
  abundantThreshold: number = Defaults.RESOURCE_ABUNDANT_THRESHOLD
): ResourceSignal {
  if (value < lowThreshold) return 'low';
  if (value >= abundantThreshold) return 'abundant';
  return 'adequate';
}

/**
 * Calculate overall physiological stress signal.
 *
 * WHY MAX, NOT AVERAGE?
 * If one physiological variable is critical, the body is in trouble
 * regardless of the others. You can't average away starvation with
 * good hydration.
 */
export function calculatePhysiologicalStress(
  physiological: Physiological
): PhysiologicalSignal {
  const signals = [
    physiologicalToSignal(physiological.hunger),
    physiologicalToSignal(physiological.fatigue),
    physiologicalToSignal(physiological.hydration),
    physiologicalToSignal(physiological.health),
  ];

  // Return the most severe signal
  if (signals.includes('critical')) return 'critical';
  if (signals.includes('high')) return 'high';
  if (signals.includes('moderate')) return 'moderate';
  return 'satisfied';
}

/**
 * Convert complete homeostasis state to signal state.
 *
 * This is the main entry point for the signals module.
 * It transforms raw numeric state into categorical signals.
 *
 * @param drives - Psychological drives from homeostasis
 * @param physiological - Physiological state from homeostasis
 * @param resources - Resources from homeostasis
 * @param appraisals - Optional appraisals from plugin-appraisal
 */
export function stateToSignals(
  drives: Drives,
  physiological: Physiological,
  resources: Resources,
  appraisals: Record<string, Appraisal> = {}
): SignalState {
  return {
    // Convert each drive to its signal
    drives: {
      security: driveToSignal(drives.security),
      social: driveToSignal(drives.social),
      status: driveToSignal(drives.status),
      autonomy: driveToSignal(drives.autonomy),
      meaning: driveToSignal(drives.meaning),
    },

    // Convert each physiological variable to its signal
    physiological: {
      hunger: physiologicalToSignal(physiological.hunger),
      fatigue: physiologicalToSignal(physiological.fatigue),
      hydration: physiologicalToSignal(physiological.hydration),
      health: physiologicalToSignal(physiological.health),
    },

    // Calculate overall physiological stress
    physiologicalStress: calculatePhysiologicalStress(physiological),

    // Convert resources
    resources: convertResources(resources),

    // Convert appraisals to situational signals
    situational: convertAppraisals(appraisals),
  };
}

/**
 * Convert resources to signals.
 *
 * Resources can be stored as numbers or as objects with a value property.
 * We handle both formats for compatibility with different homeostasis
 * configurations.
 */
function convertResources(
  resources: Resources
): Record<string, ResourceSignal> {
  const result: Record<string, ResourceSignal> = {};

  for (const [key, value] of Object.entries(resources)) {
    if (typeof value === 'number') {
      result[key] = resourceToSignal(value);
    } else if (
      value !== null &&
      typeof value === 'object' &&
      'value' in value
    ) {
      const innerValue = (value as { value: number }).value;
      result[key] = resourceToSignal(innerValue);
    }
  }

  return result;
}

// =============================================================================
// HELPER PREDICATES
//
// These make pattern conditions more readable.
// =============================================================================

/**
 * Check if a drive signal indicates deficiency (critical or low).
 *
 * WHY THIS HELPER?
 * Patterns often check "is this drive deficient?" This encapsulates
 * the definition of deficiency in one place.
 */
export function isDeficientDriveSignal(signal: DriveSignal): boolean {
  return signal === 'critical' || signal === 'low';
}

/**
 * Check if a drive signal indicates satisfaction (satisfied or abundant).
 */
export function isSatisfiedDriveSignal(signal: DriveSignal): boolean {
  return signal === 'satisfied' || signal === 'abundant';
}

/**
 * Check if a physiological signal indicates stress (high or critical).
 */
export function isStressedPhysiological(signal: PhysiologicalSignal): boolean {
  return signal === 'high' || signal === 'critical';
}

// =============================================================================
// APPRAISAL SIGNAL CONVERSION
// =============================================================================
//
// This section converts external appraisals (from plugin-appraisal) to
// situational signals that can be used in pattern detection.
//
// KEY DESIGN DECISIONS:
// ---------------------
// 1. DOMAIN-AGNOSTIC: We don't hardcode knowledge about specific domains
//    (money, power, etc.). Any evaluator plugin can publish appraisals and
//    we'll convert them using common payload patterns.
//
// 2. KEYWORD-BASED: We map common keywords (cautious, strong, declining) to
//    signal levels. This is fuzzy but robust — it handles vocabulary we
//    haven't seen before reasonably well.
//
// 3. FAIL-SAFE: Unknown payloads default to 'stable' (neutral). This ensures
//    we never generate spurious constraints or opportunities from malformed
//    or unexpected data.
//
// 4. CONFIDENCE-GATED: Low-confidence appraisals are treated as neutral.
//    Uncertain information shouldn't drive behavior.
//
// =============================================================================

/**
 * Convert a single appraisal to a situational signal.
 *
 * WHY DOMAIN-AGNOSTIC?
 * --------------------
 * Different evaluator plugins (money, power, notoriety, relationships, etc.)
 * use different payload structures. By checking common fields and keywords,
 * we support any domain without domain-specific code:
 *
 * - plugin-money: { status: 'cautious' } → 'strained'
 * - plugin-power: { level: 'high' } → 'strong'
 * - plugin-relationships: { state: 'declining' } → 'strained'
 * - plugin-unknown: { status: 'thriving' } → 'strong' (just works!)
 *
 * This means motivation automatically works with evaluator plugins that
 * don't exist yet, as long as they use standard terminology.
 *
 * CONVERSION ALGORITHM:
 * ---------------------
 * 1. If confidence < threshold → 'stable' (too uncertain)
 * 2. Check payload for common fields: status, level, state, condition
 * 3. Extract first non-empty string value
 * 4. Match against IndicatorMap keyword lists (most severe first)
 * 5. Default to 'stable' if no match
 *
 * WHY "STABLE" AS DEFAULT?
 * ------------------------
 * Neutral is the safest assumption for unknown data:
 * - Defaulting to 'critical' would cause false alarms
 * - Defaulting to 'strong' would create false opportunities
 * - 'stable' = "I don't know, so I'll assume normal"
 *
 * @param appraisal - The appraisal to convert
 * @returns The situational signal (critical/strained/stable/favorable/strong)
 *
 * @example
 * ```typescript
 * // Money evaluator says things are tight
 * appraisalToSignal({
 *   id: 'money',
 *   confidence: 0.8,
 *   payload: { status: 'cautious' }
 * }); // Returns 'strained'
 *
 * // Power evaluator says we're in a strong position
 * appraisalToSignal({
 *   id: 'power',
 *   confidence: 0.9,
 *   payload: { level: 'high' }
 * }); // Returns 'strong'
 *
 * // Unknown payload structure
 * appraisalToSignal({
 *   id: 'unknown',
 *   confidence: 0.7,
 *   payload: { foo: 'bar' }
 * }); // Returns 'stable' (safe default)
 * ```
 */
export function appraisalToSignal(appraisal: Appraisal): SituationalSignal {
  // -------------------------------------------------------------------------
  // STEP 1: Confidence gate
  // WHY? Uncertain information is worse than no information. An evaluator
  // that's "20% confident money is critical" is essentially guessing.
  // Acting on that guess could cause erratic behavior.
  // -------------------------------------------------------------------------
  if (appraisal.confidence < AppraisalDefaults.CONFIDENCE_THRESHOLD) {
    return 'stable';
  }

  // -------------------------------------------------------------------------
  // STEP 2: Extract indicator from common payload fields
  // WHY MULTIPLE FIELDS? Different evaluators use different conventions.
  // We check the most common patterns in order of likelihood:
  //
  // - plugin-money: { status: 'cautious' }
  // - plugin-power: { influence: 'strong', control: 'stable' }
  // - plugin-notoriety: { visibility: 'high', sentiment: 'positive' }
  // - generic: { level, state, condition }
  //
  // We take the FIRST non-empty value in priority order. Primary field
  // (status/influence/visibility) is preferred over secondary fields.
  // -------------------------------------------------------------------------
  const payload = appraisal.payload as Record<string, unknown>;

  // -------------------------------------------------------------------------
  // WHY THIS APPROACH? The nullish coalescing (??) treats empty strings ('')
  // as valid values, which can block later non-empty values. Instead, we
  // evaluate each candidate field, filter out empty strings, and pick the
  // first non-empty value.
  //
  // Priority order matters: primary fields (status/influence/visibility)
  // should be preferred over secondary fields.
  // -------------------------------------------------------------------------
  const candidateFields = [
    // Primary assessment fields (most important)
    payload?.status, // Money: 'secure' | 'cautious' | 'critical'
    payload?.influence, // Power: 'dominant' | 'strong' | 'moderate' | 'weak' | 'none'
    payload?.visibility, // Notoriety: 'high' | 'moderate' | 'low' | 'minimal'
    // Secondary fields
    payload?.control, // Power: 'secure' | 'stable' | 'contested' | 'vulnerable'
    payload?.sentiment, // Notoriety: 'positive' | 'negative' | 'mixed' | 'neutral'
    payload?.leverage, // Power: 'high' | 'moderate' | 'low' | 'none'
    payload?.reach, // Notoriety: 'broad' | 'moderate' | 'narrow' | 'minimal'
    // Generic fields for unknown evaluators
    payload?.level, // Generic: { level: 'low' }
    payload?.state, // Generic: { state: 'declining' }
    payload?.condition, // Generic: { condition: 'poor' }
  ];

  // Find first non-empty candidate: convert to string, trim, filter empties
  const indicator =
    candidateFields
      .map((field) => String(field ?? '').trim())
      .find((val) => val.length > 0)
      ?.toLowerCase()
      .trim() ?? '';

  // -------------------------------------------------------------------------
  // STEP 3: Handle empty indicator
  // WHY? If none of our expected fields exist, we don't know what the
  // payload means. Safe to assume neutral.
  // -------------------------------------------------------------------------
  if (!indicator) {
    return 'stable';
  }

  // -------------------------------------------------------------------------
  // STEP 4: Match against indicator maps
  // WHY THIS ORDER? Most severe → least severe ensures we don't miss
  // critical signals. If something is both "critical" and "stable"
  // (unlikely but possible in compound words), critical wins.
  // -------------------------------------------------------------------------
  if (IndicatorMap.critical.some((k) => indicator.includes(k))) {
    return 'critical';
  }
  if (IndicatorMap.strained.some((k) => indicator.includes(k))) {
    return 'strained';
  }
  if (IndicatorMap.strong.some((k) => indicator.includes(k))) {
    return 'strong';
  }
  if (IndicatorMap.favorable.some((k) => indicator.includes(k))) {
    return 'favorable';
  }
  if (IndicatorMap.stable.some((k) => indicator.includes(k))) {
    return 'stable';
  }

  // -------------------------------------------------------------------------
  // STEP 5: Default to neutral
  // WHY? Unknown terminology shouldn't trigger constraints or opportunities.
  // If plugin-foo uses { status: 'xyz' } and we don't know what 'xyz' means,
  // the safest assumption is neutral.
  // -------------------------------------------------------------------------
  return 'stable';
}

/**
 * Convert all appraisals to situational signals.
 *
 * @param appraisals - Record of domain id → appraisal
 * @returns Record of domain id → situational signal
 */
function convertAppraisals(
  appraisals: Record<string, Appraisal>
): Record<string, SituationalSignal> {
  const result: Record<string, SituationalSignal> = {};

  for (const [domain, appraisal] of Object.entries(appraisals)) {
    result[domain] = appraisalToSignal(appraisal);
  }

  return result;
}

/**
 * Check if a situational signal indicates constraint (critical or strained).
 *
 * WHY THIS HELPER?
 * ----------------
 * Patterns need to check "is this external domain constraining options?"
 * This encapsulates the definition of constraint in one place:
 *
 * - 'critical' = definitely constraining (crisis level)
 * - 'strained' = somewhat constraining (concerning)
 * - 'stable' = NOT constraining (neutral)
 * - 'favorable' = NOT constraining (positive)
 * - 'strong' = NOT constraining (very positive)
 *
 * Used in patterns like:
 * - external_pressure: checks if ANY domain is constrained
 * - financial_constraint: checks if money specifically is constrained
 *
 * @param signal - The situational signal to check
 * @returns true if the signal indicates constraint
 *
 * @example
 * ```typescript
 * isConstrainedSituational('strained'); // true
 * isConstrainedSituational('critical'); // true
 * isConstrainedSituational('stable');   // false
 * isConstrainedSituational('strong');   // false
 * ```
 */
export function isConstrainedSituational(signal: SituationalSignal): boolean {
  return signal === 'critical' || signal === 'strained';
}

/**
 * Check if a situational signal indicates opportunity (favorable or strong).
 *
 * WHY THIS HELPER?
 * ----------------
 * Patterns need to check "is this external domain enabling opportunities?"
 * This encapsulates the definition of favorable in one place:
 *
 * - 'critical' = NOT favorable (crisis)
 * - 'strained' = NOT favorable (concerning)
 * - 'stable' = NOT favorable (just neutral)
 * - 'favorable' = favorable (positive conditions)
 * - 'strong' = very favorable (excellent conditions)
 *
 * Used in patterns like:
 * - external_tailwind: checks if ANY domain is favorable
 * - influence_position: checks if power specifically is favorable
 *
 * @param signal - The situational signal to check
 * @returns true if the signal indicates favorable conditions
 *
 * @example
 * ```typescript
 * isFavorableSituational('strong');    // true
 * isFavorableSituational('favorable'); // true
 * isFavorableSituational('stable');    // false
 * isFavorableSituational('strained');  // false
 * ```
 */
export function isFavorableSituational(signal: SituationalSignal): boolean {
  return signal === 'favorable' || signal === 'strong';
}
