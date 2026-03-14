/**
 * Confidence Field Support
 *
 * WHY CONFIDENCE TRACKING EXISTS:
 * ==============================
 * Not all observations are equally reliable. A single data point shouldn't
 * create strong beliefs. Consider:
 * - "User mentioned they like coffee" (once) → low confidence
 * - "User orders coffee every morning" (5x) → high confidence
 *
 * Without confidence tracking, the agent treats all memories equally,
 * leading to overconfident statements from sparse data.
 *
 * HOW IT WORKS:
 * ============
 * Confidence is a 0-100 score that changes based on:
 * 1. REINFORCEMENT: Repeated observations increase confidence
 * 2. CONTRADICTION: Conflicting observations decrease confidence
 * 3. NEUTRAL: No change (observation neither confirms nor denies)
 *
 * KEY DESIGN DECISION - DIMINISHING RETURNS:
 * =========================================
 * Going from 30→50 confidence is easier than 80→95.
 * Why? High-confidence claims should be hard to make.
 * The formula: boost = baseBoost * (remainingRoom / 100)
 * At 80 confidence: boost = 15 * 0.2 = 3 points
 * At 30 confidence: boost = 15 * 0.7 = 10.5 points
 *
 * This mimics how human beliefs form: early evidence has high impact,
 * later evidence has diminishing returns.
 */

export interface ConfidenceConfig {
  /**
   * Initial confidence for new observations (0-100).
   * WHY 50: Neutral starting point. Not too confident (we just saw this once),
   * not too dismissive (we did observe something real).
   */
  initialConfidence: number;

  /**
   * How much confidence increases on reinforcement (before diminishing returns).
   * WHY 15: Empirically, 3-5 reinforcements should bring confidence to ~70.
   * Math: 50 → 57.5 → 63.9 → 69.3 → 73.8 (4 reinforcements)
   */
  reinforcementBoost: number;

  /**
   * How much confidence decreases on contradiction.
   * WHY 25 (ASYMMETRIC): Contradictions should hurt more than reinforcements help.
   * This makes the system conservative—easier to lose trust than gain it.
   * One contradiction wipes out ~2 reinforcements.
   */
  contradictionPenalty: number;

  /**
   * Minimum confidence before memory is considered stale.
   * WHY 10 (NOT 0): Even contradicted memories have some signal value.
   * "We once thought X but now think Y" is useful context.
   */
  minConfidence: number;
}

export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  initialConfidence: 50,
  reinforcementBoost: 15,
  contradictionPenalty: 25,
  minConfidence: 10,
};

/**
 * Calculate updated confidence based on observation type.
 *
 * WHY NOT SIMPLE ADD/SUBTRACT:
 * Simple math (confidence += 10) doesn't model belief formation well.
 * It allows overconfidence (100% after 5 observations) and doesn't
 * account for the asymmetry between building and losing trust.
 */
export function updateConfidence(
  currentConfidence: number,
  observationType: 'reinforce' | 'contradict' | 'neutral',
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): number {
  let newConfidence = currentConfidence;

  switch (observationType) {
    case 'reinforce':
      // WHY DIMINISHING RETURNS: High confidence should be hard to achieve.
      // Near 100%, additional observations barely move the needle.
      // This prevents overconfidence from small sample sizes.
      const remainingRoom = 100 - currentConfidence;
      const boost = config.reinforcementBoost * (remainingRoom / 100);
      newConfidence = currentConfidence + boost;
      break;

    case 'contradict':
      // WHY FLAT PENALTY (NO DIMINISHING): Contradictions are serious.
      // Even at low confidence, a contradiction should hurt.
      // This makes the system conservative about uncertain beliefs.
      newConfidence = currentConfidence - config.contradictionPenalty;
      break;

    case 'neutral':
      // WHY NEUTRAL OPTION: Sometimes observations are tangential.
      // "User mentioned weather" doesn't confirm or deny "user likes coffee".
      // Explicitly handling this prevents forced categorization.
      break;
  }

  // WHY CLAMPING: Confidence must stay in valid range.
  // - Can't exceed 100 (that's certainty)
  // - Can't go below minConfidence (preserve signal value)
  return Math.max(config.minConfidence, Math.min(100, newConfidence));
}

/**
 * Determine if confidence is high enough to trust the memory.
 *
 * WHY 40 DEFAULT THRESHOLD:
 * - Below 40: "We've seen hints of this" (don't act on it)
 * - 40-70: "Reasonably confident" (can mention, with hedging)
 * - Above 70: "Highly confident" (can state directly)
 *
 * This enables filtering low-confidence memories from provider output.
 */
export function isConfident(
  confidence: number,
  threshold: number = 40
): boolean {
  return confidence >= threshold;
}

/**
 * Get confidence level label for display.
 *
 * WHY LABELS INSTEAD OF NUMBERS:
 * "Trust: 73" is meaningless to most users.
 * "Trust: HIGH" is immediately understandable.
 * Labels also work better in prompts for the LLM.
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'very high';
  if (confidence >= 60) return 'high';
  if (confidence >= 40) return 'moderate';
  if (confidence >= 20) return 'low';
  return 'very low';
}

/**
 * Merge evidence from multiple observations.
 *
 * WHY MERGE INSTEAD OF REPLACE:
 * Evidence accumulates. If we've seen 5 examples of behavior,
 * a 6th observation shouldn't wipe out the first 5.
 *
 * WHY NEW FIRST: Newer evidence is often more relevant.
 * If we hit maxEvidence, we want to keep recent items.
 *
 * WHY maxEvidence LIMIT: Prevents unbounded growth.
 * Also, >10 pieces of evidence rarely adds useful signal.
 */
export function mergeEvidence(
  existingEvidence: string[],
  newEvidence: string[],
  maxEvidence: number = 10
): string[] {
  // WHY DEDUPLICATE: Same evidence repeated isn't new information.
  // Set ensures uniqueness while Array.from preserves order.
  const combined = Array.from(new Set([...newEvidence, ...existingEvidence]));
  return combined.slice(0, maxEvidence);
}
