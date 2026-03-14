/**
 * Neuro Events
 *
 * WHY EVENTS EXIST:
 * ================
 * The cognitive system generates insights that other parts of the agent
 * might want to react to:
 * - Homeostasis plugin: Adjust drives based on trust changes
 * - Logging: Record important cognitive events
 * - UI: Show notifications for significant insights
 * - Analytics: Track agent learning over time
 *
 * Rather than tightly coupling neuro to these consumers, we emit events.
 * Consumers subscribe to what they care about. Loose coupling = flexibility.
 *
 * WHY NOT JUST LOG:
 * ================
 * Logs are unstructured and hard to act on programmatically.
 * Events are typed, have payloads, and can trigger workflows.
 * "console.log('trust changed')" vs "emit(TRUST_CHANGE, { oldScore, newScore })"
 *
 * INTEGRATION PATTERN:
 * ===================
 * Currently, events are created but not globally emitted (runtime.emit
 * doesn't exist yet). When elizaOS adds event support, hook it up here.
 * In the meantime, afterSave hooks can process events locally.
 */

import type { UUID } from '@elizaos/core';

// =============================================================================
// Event Types
// =============================================================================
// WHY CONST OBJECT:
// Enables both autocomplete (NEURO_EVENTS.TRUST_CHANGE) and iteration
// (Object.values(NEURO_EVENTS)). String enums don't support iteration.
// =============================================================================

export const NEURO_EVENTS = {
  /**
   * Emitted when trust score changes significantly.
   * WHY: Trust affects how the agent should interact with an entity.
   * Dropping from HIGH to LOW trust should change behavior.
   */
  TRUST_CHANGE: 'NEURO_TRUST_CHANGE',

  /**
   * Emitted when a task is completed.
   * WHY: Task completion might trigger follow-up actions or notifications.
   */
  TASK_COMPLETED: 'NEURO_TASK_COMPLETED',

  /**
   * Emitted when a hallucination is detected.
   * WHY: Critical for self-correction. Homeostasis might lower confidence,
   * trigger re-verification, or flag the response for review.
   */
  HALLUCINATION_DETECTED: 'NEURO_HALLUCINATION_DETECTED',

  /**
   * Emitted when a hypothesis is confirmed.
   * WHY: Successful predictions increase agent's confidence in its models.
   * Could affect future decision-making.
   */
  HYPOTHESIS_CONFIRMED: 'NEURO_HYPOTHESIS_CONFIRMED',

  /**
   * Emitted when a hypothesis is refuted.
   * WHY: Failed predictions are learning opportunities.
   * Agent should update its models.
   */
  HYPOTHESIS_REFUTED: 'NEURO_HYPOTHESIS_REFUTED',

  /**
   * Emitted when a new behavioral pattern is detected.
   * WHY: New patterns might require attention or response adjustment.
   */
  PATTERN_DETECTED: 'NEURO_PATTERN_DETECTED',

  /**
   * Emitted by metacognition when evaluator quality is assessed.
   * WHY: Self-awareness about reasoning quality enables improvement.
   * Low-quality evaluators could be adjusted or disabled.
   */
  EVALUATOR_QUALITY: 'NEURO_EVALUATOR_QUALITY',
} as const;

export type NeuroEventType = (typeof NEURO_EVENTS)[keyof typeof NEURO_EVENTS];

// =============================================================================
// Event Payloads
// =============================================================================
// WHY TYPED PAYLOADS:
// Events without structure are hard to use. Type definitions ensure:
// - Producers include required data
// - Consumers know what to expect
// - IDE autocomplete works
// =============================================================================

/**
 * Payload for TRUST_CHANGE events.
 * WHY THESE FIELDS:
 * - entityId: Who changed (so consumers can look up context)
 * - oldScore/newScore: Magnitude of change (significant vs minor)
 * - change: Direction (without calculating newScore - oldScore)
 * - reason: Human-readable explanation for debugging
 */
export interface TrustChangePayload {
  entityId: UUID;
  oldScore: number;
  newScore: number;
  change: 'increase' | 'decrease';
  reason: string;
}

/**
 * Payload for TASK_COMPLETED events.
 */
export interface TaskCompletedPayload {
  taskId: UUID;
  title: string;
  /** Duration in ms, if tracked */
  duration?: number;
  /** Outcome/result summary */
  result?: string;
}

/**
 * Payload for HALLUCINATION_DETECTED events.
 * WHY CONFIDENCE AND DISCREPANCIES:
 * - confidence: How sure are we it's a hallucination? (not all detections are certain)
 * - discrepancies: What specifically was wrong? (for learning and review)
 */
export interface HallucinationDetectedPayload {
  responseId: string;
  confidence: number;
  discrepancies: string[];
}

/**
 * Payload for hypothesis resolution events (confirmed or refuted).
 * WHY SAME STRUCTURE:
 * Consumers often want to handle both similarly (update models, log).
 * Separate types would require duplicate handling code.
 */
export interface HypothesisResolvedPayload {
  hypothesisId: UUID;
  title: string;
  status: 'confirmed' | 'refuted';
  /** Evidence that led to resolution */
  evidence: string[];
  /** Confidence in the resolution (not all resolutions are certain) */
  confidence: number;
}

/**
 * Payload for PATTERN_DETECTED events.
 */
export interface PatternDetectedPayload {
  entityId: UUID;
  patternType: string;
  description: string;
  /** 0-100 significance score (how important is this pattern?) */
  significance: number;
}

/**
 * Payload for EVALUATOR_QUALITY events.
 * WHY THESE METRICS:
 * - accuracy: How often is the evaluator right?
 * - signalToNoise: How much useful info vs noise?
 * - sampleSize: Is this assessment based on enough data?
 * These enable data-driven evaluator tuning.
 */
export interface EvaluatorQualityPayload {
  evaluatorName: string;
  accuracy: number;
  signalToNoise: number;
  sampleSize: number;
}

export type NeuroEventPayload =
  | TrustChangePayload
  | TaskCompletedPayload
  | HallucinationDetectedPayload
  | HypothesisResolvedPayload
  | PatternDetectedPayload
  | EvaluatorQualityPayload;

// =============================================================================
// Event Helpers
// =============================================================================

/**
 * Create a structured event object.
 *
 * WHY NOT JUST { type, payload }:
 * - timestamp: Enables event ordering, debugging, and analytics
 * - Structure: Consistent shape makes serialization/deserialization easier
 * - Type safety: Generic ensures payload matches event type
 *
 * FUTURE: When runtime.emit() exists, this could call it automatically.
 */
export function createNeuroEvent<T extends NeuroEventPayload>(
  type: NeuroEventType,
  payload: T
): { type: NeuroEventType; payload: T; timestamp: number } {
  return {
    type,
    payload,
    timestamp: Date.now(),
  };
}
