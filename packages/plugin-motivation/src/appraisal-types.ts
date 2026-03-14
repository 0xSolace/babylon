/**
 * @fileoverview Local type definitions for plugin-appraisal
 *
 * WHY LOCAL TYPES?
 * ----------------
 * These types mirror the types from @elizaos/plugin-appraisal.
 * We define them locally to:
 * 1. Avoid TypeScript resolution issues when the appraisal package
 *    doesn't have built type declarations
 * 2. Maintain a soft dependency - motivation works without appraisal
 * 3. Document exactly what we depend on from the appraisal service
 *
 * WHAT IS AN APPRAISAL?
 * ---------------------
 * An appraisal is a domain evaluator's assessment of an external situation.
 * Unlike homeostasis (internal state: hunger, drives), appraisals track
 * external circumstances:
 *
 * - Money situation: financial position, reserves, risk tolerance
 * - Power dynamics: influence, control, leverage
 * - Notoriety: reputation, visibility, social standing
 * - Other domains: whatever evaluators plugins create
 *
 * HOW MOTIVATION USES APPRAISALS
 * ------------------------------
 * Motivation READS appraisals to understand external context.
 * Combined with internal state (homeostasis), this creates contextual motivation:
 *
 *   internal (how I feel) + external (what's happening) = priorities
 *
 * Motivation never WRITES appraisals - that's the evaluator plugins' job.
 */

// =============================================================================
// APPRAISAL
// =============================================================================

/**
 * A domain evaluator's assessment of a situational factor.
 *
 * @template T - Type of domain-specific payload (defaults to generic object)
 *
 * @example
 * ```typescript
 * const moneyAppraisal: Appraisal<{ status: string; reserves: string }> = {
 *   id: 'money',
 *   ts: Date.now(),
 *   confidence: 0.85,
 *   source: 'plugin-money',
 *   payload: { status: 'cautious', reserves: 'low' }
 * };
 * ```
 */
export interface Appraisal<T = Record<string, unknown>> {
  /**
   * Unique domain identifier.
   * Convention: lowercase, single-word (e.g., 'money', 'power', 'notoriety')
   */
  id: string;

  /**
   * Timestamp when this appraisal was computed (ms since epoch).
   * Used for ordering: newer appraisals replace older ones.
   */
  ts: number;

  /**
   * Confidence in this assessment (0.0 to 1.0).
   *
   * WHY CONFIDENCE MATTERS:
   * - High confidence (>0.7): Act on this information
   * - Medium confidence (0.3-0.7): Consider with caution
   * - Low confidence (<0.3): Ignore (too uncertain)
   *
   * Motivation filters out low-confidence appraisals to avoid noise.
   */
  confidence: number;

  /**
   * Which plugin published this appraisal.
   * Convention: plugin package name (e.g., 'plugin-money')
   * Used for debugging and provenance tracking.
   */
  source: string;

  /**
   * Domain-specific data.
   *
   * Common payload patterns:
   * - { status: 'critical' | 'cautious' | 'stable' | 'secure' }
   * - { level: 'low' | 'moderate' | 'high' }
   * - { state: 'declining' | 'stable' | 'improving' }
   *
   * Motivation checks for these common fields when converting to signals.
   */
  payload: T;
}

// =============================================================================
// APPRAISAL SERVICE INTERFACE
// =============================================================================

/**
 * Minimal interface for AppraisalService that we depend on.
 *
 * We only need read methods - motivation never writes appraisals.
 */
export interface IAppraisalService {
  /**
   * Get a specific appraisal by domain id.
   * @param id - Domain identifier (e.g., 'money')
   * @returns The appraisal or null if not found
   */
  get<T>(id: string): Appraisal<T> | null;

  /**
   * Get all current appraisals as a record.
   * @returns Record of domain id → appraisal (empty object if none)
   */
  getAll(): Record<string, Appraisal>;

  /**
   * Get all registered appraisal domain ids.
   * @returns Array of domain ids (empty array if none)
   */
  getIds(): string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Service type identifier for AppraisalService.
 * Used with runtime.getService() to retrieve the appraisal service.
 *
 * @example
 * ```typescript
 * const service = runtime.getService(APPRAISAL_SERVICE_TYPE) as IAppraisalService | null;
 * if (service) {
 *   const all = service.getAll();
 * }
 * ```
 */
export const APPRAISAL_SERVICE_TYPE = 'appraisal';
