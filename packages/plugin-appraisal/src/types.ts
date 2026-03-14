/**
 * @fileoverview Type definitions for plugin-appraisal
 *
 * =============================================================================
 * WHY THIS FILE EXISTS
 * =============================================================================
 *
 * This file defines the core data contracts for the appraisal system.
 * By centralizing types here, we ensure:
 *
 * 1. TYPE SAFETY ACROSS PLUGIN BOUNDARIES
 *    Evaluator plugins (money, power, notoriety) and consumer plugins
 *    (motivation) need to agree on data shapes. This file is the contract.
 *
 * 2. DOCUMENTATION AS CODE
 *    The interfaces serve as living documentation. Developers reading this
 *    file understand what data flows through the system.
 *
 * 3. DECOUPLING
 *    By depending on interfaces (IAppraisalService) rather than concrete
 *    implementations, plugins can be tested in isolation with mocks.
 *
 * =============================================================================
 * WHAT IS AN APPRAISAL?
 * =============================================================================
 *
 * An appraisal is a domain evaluator's assessment of a situational factor.
 *
 * This is NOT internal state (that's homeostasis - hunger, fatigue, drives).
 * This is the agent's evaluation of EXTERNAL circumstances:
 *
 * - Money situation → financial position, runway, risk tolerance
 * - Power dynamics → influence, control, leverage
 * - Notoriety → reputation, visibility, social capital
 * - Other domains → whatever evaluators you build
 *
 * WHY SEPARATE FROM HOMEOSTASIS?
 * Homeostasis tracks internal state that changes continuously (drives decay,
 * hunger grows). Appraisals track external assessments that change when
 * evaluators re-analyze the situation. Different cadences, different concerns.
 *
 * =============================================================================
 * KEY DESIGN DECISIONS
 * =============================================================================
 *
 * 1. ONE APPRAISAL PER DOMAIN (id)
 *    WHY: Simplicity. Each domain has one current assessment. No history,
 *    no accumulation, no merging. Latest wins.
 *
 * 2. LATEST WINS (newer ts replaces older)
 *    WHY: No conflicts. If two evaluators disagree, the most recent one wins.
 *    This is simple, predictable, and debuggable.
 *
 * 3. NO TTL (time-based expiry)
 *    WHY: Event-driven architecture. If an appraisal should expire, the
 *    producer schedules a task (via plugin-pim) to publish an update.
 *    This keeps plugin-appraisal stateless regarding time.
 *
 * 4. PROVIDER-BASED CONSUMPTION
 *    WHY: Fits elizaOS patterns. Motivation reads appraisals via provider
 *    during composeState(), not by subscribing to events. Events exist
 *    for debugging/logging, not data flow.
 *
 * 5. CONFIDENCE FIELD (0-1)
 *    WHY: Evaluators vary in certainty. A money evaluator might be 90%
 *    confident after checking balances, but only 30% confident when
 *    guessing from context. Consumers can weight decisions accordingly.
 *
 * 6. SOURCE FIELD
 *    WHY: Provenance matters for debugging. When motivation makes a weird
 *    decision, you can trace back which evaluator published which appraisal.
 */

import type { UUID } from '@elizaos/core';

/**
 * A domain evaluator's assessment of a situational factor.
 *
 * WHY THIS STRUCTURE?
 * ===================
 *
 * The Appraisal interface captures the minimal information needed to:
 * 1. Identify what domain this is about (id)
 * 2. Order appraisals temporally (ts)
 * 3. Express uncertainty (confidence)
 * 4. Track origin (source)
 * 5. Carry domain-specific data (payload)
 *
 * WHY GENERIC PAYLOAD?
 * ====================
 * Each domain has different data. Money might have { reserves, runway, risk }.
 * Power might have { influence, leverage, allies }. The generic allows
 * type-safe payloads while keeping the registry domain-agnostic.
 *
 * @template T - Type of domain-specific payload
 *
 * @example
 * ```typescript
 * // Money domain appraisal
 * interface MoneyPayload {
 *   status: 'secure' | 'cautious' | 'critical';
 *   reserves: 'high' | 'moderate' | 'low';
 *   runway: string;
 * }
 *
 * const moneyAppraisal: Appraisal<MoneyPayload> = {
 *   id: 'money',
 *   ts: Date.now(),
 *   confidence: 0.85,
 *   source: 'plugin-money',
 *   payload: {
 *     status: 'cautious',
 *     reserves: 'low',
 *     runway: '2 weeks'
 *   }
 * };
 * ```
 */
export interface Appraisal<T = Record<string, unknown>> {
  /**
   * Unique domain identifier.
   *
   * WHY A STRING?
   * Domains are named by convention, not by a central registry. This allows
   * new evaluator plugins to define their own domains without coordination.
   *
   * NAMING CONVENTION:
   * Use lowercase, single-word identifiers: 'money', 'power', 'notoriety'.
   * Avoid: 'money-status', 'POWER', 'My Custom Domain'.
   *
   * @example 'money', 'power', 'notoriety', 'relationships'
   */
  id: string;

  /**
   * Timestamp when this appraisal was computed (milliseconds since epoch).
   *
   * WHY TIMESTAMP?
   * Used for ordering - newer replaces older. This ensures:
   * 1. No race conditions when multiple evaluators publish
   * 2. Clear conflict resolution (latest wins)
   * 3. Staleness detection by consumers if needed
   *
   * WHY NOT FOR EXPIRY?
   * We explicitly chose NOT to use ts for TTL-based expiry. If you need
   * an appraisal to expire, schedule a task to publish an update with
   * confidence: 0. This keeps the registry stateless regarding time.
   *
   * @example Date.now()
   */
  ts: number;

  /**
   * Confidence in this assessment (0.0 to 1.0).
   *
   * WHY CONFIDENCE?
   * Evaluators have varying certainty. A money evaluator might be:
   * - 0.95 confident after checking actual bank balances
   * - 0.60 confident when inferring from conversation context
   * - 0.20 confident when making assumptions without data
   *
   * Consumers (like motivation) can use confidence to:
   * - Weight decisions (high confidence appraisals matter more)
   * - Request re-evaluation (low confidence means uncertain)
   * - Display uncertainty to users
   *
   * SPECIAL VALUE: 0.0
   * Confidence of 0 means "this appraisal is invalid/unknown". Use this
   * to effectively "clear" an appraisal without removing it from registry.
   *
   * @minimum 0
   * @maximum 1
   */
  confidence: number;

  /**
   * Which plugin published this appraisal.
   *
   * WHY SOURCE?
   * Debugging and provenance. When motivation makes a weird decision,
   * you need to trace back: "Which evaluator said money was critical?"
   *
   * Also enables:
   * - Filtering by source in UI/debugging tools
   * - Detecting if a domain has multiple publishers (potential conflict)
   * - Audit trails for agent behavior analysis
   *
   * NAMING CONVENTION:
   * Use the plugin package name: 'plugin-money', 'plugin-power'.
   *
   * @example 'plugin-money', 'plugin-power', 'plugin-notoriety'
   */
  source: string;

  /**
   * Domain-specific data.
   *
   * WHY GENERIC?
   * Each domain evaluator defines its own data structure. The appraisal
   * registry doesn't interpret this - it just stores and retrieves.
   *
   * DESIGN PRINCIPLE: Evaluators own meaning
   * The payload carries whatever the evaluator thinks is relevant.
   * Motivation interprets it. The registry is just plumbing.
   *
   * @example { status: 'cautious', reserves: 'low', trend: 'declining' }
   */
  payload: T;
}

/**
 * Service interface for AppraisalService.
 *
 * WHY AN INTERFACE?
 * =================
 *
 * 1. DEPENDENCY INVERSION
 *    Plugins depend on this interface, not the concrete AppraisalService.
 *    This allows testing with mocks and future implementation changes.
 *
 * 2. TYPE SAFETY
 *    TypeScript can verify that callers use the service correctly.
 *
 * 3. DOCUMENTATION
 *    The interface is a contract. Reading it tells you what the service
 *    can and cannot do.
 *
 * @example
 * ```typescript
 * // In another plugin
 * const service = runtime.getService('appraisal') as IAppraisalService;
 * service.publish({ id: 'money', ts: Date.now(), ... });
 * ```
 */
export interface IAppraisalService {
  /**
   * Publish an appraisal.
   *
   * WHY RETURN BOOLEAN?
   * Callers need to know if their appraisal was accepted. Returns:
   * - true: Appraisal stored (newer than existing or first for this id)
   * - false: Appraisal rejected (older timestamp than existing)
   *
   * WHY THROW ON INVALID?
   * Missing required fields (id, ts, source, confidence) are programming
   * errors. We throw to fail fast and loudly, not silently ignore.
   *
   * @param appraisal - The appraisal to publish
   * @returns true if accepted, false if rejected (older timestamp)
   * @throws Error if required fields are missing or invalid
   */
  publish<T>(appraisal: Appraisal<T>): boolean;

  /**
   * Get a specific appraisal by id.
   *
   * WHY RETURN NULL?
   * The domain might not have any appraisal yet (evaluator hasn't run).
   * Returning null is clearer than throwing or returning undefined.
   *
   * @param id - Domain identifier (e.g., 'money')
   * @returns The appraisal or null if not found
   */
  get<T>(id: string): Appraisal<T> | null;

  /**
   * Get all current appraisals as a record.
   *
   * WHY RECORD NOT MAP?
   * Records are JSON-serializable and easier to work with in providers.
   * The provider needs to format this for LLM context, so plain objects
   * are more convenient than Maps.
   *
   * @returns Record of id → appraisal (empty object if none)
   */
  getAll(): Record<string, Appraisal>;

  /**
   * Get all registered appraisal ids.
   *
   * WHY SEPARATE FROM getAll()?
   * Sometimes you just need the list of domains, not the full data.
   * Useful for UI, debugging, and enumeration without payload overhead.
   *
   * @returns Array of domain ids (empty array if none)
   */
  getIds(): string[];

  /**
   * Clear (remove) an appraisal by id.
   *
   * WHY EXPLICIT CLEAR?
   * Two ways to invalidate an appraisal:
   * 1. Publish with confidence: 0 (keeps entry, marks invalid)
   * 2. Clear (removes entry entirely)
   *
   * Clear is useful when a domain is no longer relevant (e.g., evaluator
   * plugin unloaded, or domain temporarily disabled).
   *
   * @param id - Domain identifier to clear
   * @returns true if removed, false if not found
   */
  clear(id: string): boolean;
}

/**
 * Event payload for APPRAISAL_UPDATED event.
 *
 * WHY THIS EVENT?
 * ===============
 *
 * Events are for NOTIFICATION, not DATA FLOW. Consumers should read
 * appraisals via the provider during composeState(), not by subscribing
 * to this event.
 *
 * Use cases for this event:
 * - Debugging: Log when appraisals change
 * - Monitoring: Track appraisal update frequency
 * - Analytics: Record appraisal history for analysis
 *
 * WHY INCLUDE previousAppraisal?
 * Enables diff-based logging and change detection. You can see what
 * changed, not just what the new value is.
 */
export interface AppraisalUpdatedPayload {
  /**
   * Runtime instance.
   * WHY: Handlers may need runtime for logging, settings, etc.
   */
  runtime: unknown;

  /**
   * Event source identifier.
   * WHY: Standard elizaOS event pattern. Always 'appraisal' for this plugin.
   */
  source: string;

  /**
   * Agent ID.
   * WHY: Multi-agent systems need to filter events by agent.
   */
  agentId: UUID;

  /**
   * Which appraisal was updated.
   * WHY: Quick filtering without parsing the full appraisal object.
   */
  appraisalId: string;

  /**
   * The new appraisal.
   * WHY: The complete new state for this domain.
   */
  appraisal: Appraisal;

  /**
   * The previous appraisal (if any).
   * WHY: Enables change detection and diff logging.
   */
  previousAppraisal?: Appraisal;
}

/**
 * Event payload for APPRAISAL_CLEARED event.
 *
 * WHY THIS EVENT?
 * ===============
 *
 * Like UPDATED, this is for notification/debugging, not data flow.
 *
 * Use cases:
 * - Debugging: Know when appraisals are removed
 * - Cleanup: Trigger dependent cleanup when a domain is cleared
 * - Analytics: Track domain lifecycle
 *
 * WHY INCLUDE clearedAppraisal?
 * The cleared appraisal is gone from the registry after this event.
 * Including it in the payload preserves the information for logging.
 */
export interface AppraisalClearedPayload {
  /**
   * Runtime instance.
   * WHY: Handlers may need runtime for logging, settings, etc.
   */
  runtime: unknown;

  /**
   * Event source identifier.
   * WHY: Standard elizaOS event pattern.
   */
  source: string;

  /**
   * Agent ID.
   * WHY: Multi-agent systems need to filter events by agent.
   */
  agentId: UUID;

  /**
   * Which appraisal was cleared.
   * WHY: Quick identification without parsing the appraisal object.
   */
  appraisalId: string;

  /**
   * The appraisal that was removed.
   * WHY: Preserves information for logging since it's gone from registry.
   */
  clearedAppraisal: Appraisal;
}
