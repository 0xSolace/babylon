/**
 * @fileoverview AppraisalService - Situational appraisal registry
 *
 * =============================================================================
 * WHY THIS SERVICE EXISTS
 * =============================================================================
 *
 * elizaOS agents need to track their external situation across multiple
 * domains (money, power, notoriety, etc.). This service provides:
 *
 * 1. A CENTRAL REGISTRY
 *    One place to store and retrieve domain appraisals. No scattered state.
 *
 * 2. ORDERING GUARANTEES
 *    "Latest wins" - newer timestamps always replace older ones.
 *    No race conditions, no conflicts, no merge logic needed.
 *
 * 3. DECOUPLING
 *    Evaluator plugins don't know about each other. They publish to the
 *    registry. Consumers (motivation) don't know about evaluators. They
 *    read from the registry. Clean separation of concerns.
 *
 * =============================================================================
 * ARCHITECTURAL POSITION
 * =============================================================================
 *
 * This service sits in the middle of the agent's information flow:
 *
 * ```
 *                    ┌─────────────────┐
 *                    │   EVALUATORS    │
 *                    │ (plugin-money,  │
 *                    │  plugin-power,  │
 *                    │  etc.)          │
 *                    └────────┬────────┘
 *                             │ publish()
 *                             ▼
 *                    ┌─────────────────┐
 *                    │ AppraisalService│ ← THIS SERVICE
 *                    │   (registry)    │
 *                    └────────┬────────┘
 *                             │ provider / getAll()
 *                             ▼
 *                    ┌─────────────────┐
 *                    │   MOTIVATION    │
 *                    │ (interprets     │
 *                    │  into priorities│
 *                    └─────────────────┘
 * ```
 *
 * Combined with homeostasis, this forms the agent's complete state awareness:
 *
 *   homeostasis (internal state) + appraisal (external situation) → motivation (priorities)
 *
 * =============================================================================
 * WHAT THIS SERVICE DOES
 * =============================================================================
 *
 * ✅ Store latest appraisal per domain id
 * ✅ Enforce timestamp ordering (reject stale appraisals)
 * ✅ Validate appraisal structure (id, ts, source, confidence required)
 * ✅ Emit events for debugging/notification
 * ✅ Provide read access (get, getAll, getIds)
 * ✅ Support explicit clearing
 *
 * =============================================================================
 * WHAT THIS SERVICE DOES NOT DO
 * =============================================================================
 *
 * ❌ Compute domain logic
 *    That's the evaluator plugins' job. They analyze situations and publish
 *    appraisals. This service just stores them.
 *
 * ❌ Interpret appraisals
 *    That's motivation's job. It reads appraisals and determines priorities.
 *    This service doesn't know what "money: cautious" means.
 *
 * ❌ Execute actions
 *    That's the autonomous plugin's job. This service has no side effects
 *    beyond storage and events.
 *
 * ❌ Schedule expiry
 *    That's plugin-pim's job. If an appraisal should expire, the producer
 *    schedules a task to publish an update. No timers here.
 *
 * ❌ Call LLMs
 *    Pure data plumbing. No intelligence, no generation, no inference.
 *
 * =============================================================================
 * KEY DESIGN PRINCIPLE: LATEST WINS
 * =============================================================================
 *
 * When a new appraisal arrives for an existing id:
 *
 *   if (new.ts > existing.ts)  → ACCEPT: replace existing
 *   if (new.ts <= existing.ts) → REJECT: keep existing
 *
 * WHY THIS DESIGN?
 *
 * 1. SIMPLICITY
 *    No complex conflict resolution, no merge strategies, no voting.
 *    The most recent assessment wins. Period.
 *
 * 2. PREDICTABILITY
 *    Developers can reason about behavior. "Will my appraisal be accepted?"
 *    Yes, if it's newer. No, if it's older.
 *
 * 3. DEBUGGABILITY
 *    When something goes wrong, you can trace timestamps. "Why did motivation
 *    use this appraisal?" Because it had the newest timestamp.
 *
 * 4. NO TTL COMPLEXITY
 *    We explicitly chose not to have time-based expiry. If evaluators want
 *    appraisals to expire, they schedule tasks to publish updates. This
 *    keeps the registry stateless regarding time.
 *
 * =============================================================================
 * USAGE EXAMPLES
 * =============================================================================
 *
 * Publishing (from an evaluator plugin):
 * ```typescript
 * const service = runtime.getService('appraisal') as AppraisalService;
 *
 * // After analyzing financial position...
 * service.publish({
 *   id: 'money',
 *   ts: Date.now(),
 *   confidence: 0.85,
 *   source: 'plugin-money',
 *   payload: { status: 'cautious', reserves: 'low' }
 * });
 * ```
 *
 * Reading (from motivation or other consumer):
 * ```typescript
 * const service = runtime.getService('appraisal') as AppraisalService;
 *
 * // Get specific domain
 * const money = service.get('money');
 * if (money && money.confidence > 0.5) {
 *   // Act on high-confidence assessment
 * }
 *
 * // Get all domains
 * const snapshot = service.getAll();
 * for (const [domain, appraisal] of Object.entries(snapshot)) {
 *   console.log(`${domain}: confidence ${appraisal.confidence}`);
 * }
 * ```
 *
 * Invalidating (from evaluator or lifecycle):
 * ```typescript
 * // Option 1: Publish with confidence 0 (keeps entry, marks invalid)
 * service.publish({
 *   id: 'money',
 *   ts: Date.now(),
 *   confidence: 0,  // "I don't know anymore"
 *   source: 'plugin-money',
 *   payload: { status: 'unknown' }
 * });
 *
 * // Option 2: Clear entirely (removes entry)
 * service.clear('money');
 * ```
 */

import { type EventPayload, type IAgentRuntime, Service } from '@elizaos/core';
import { APPRAISAL_SERVICE_TYPE, AppraisalEvents } from '../constants.ts';
import type { Appraisal, IAppraisalService } from '../types.ts';

/**
 * AppraisalService
 *
 * Registry for domain evaluator outputs. Stores one appraisal per domain id,
 * always keeping the most recent (by timestamp).
 *
 * WHY EXTEND Service?
 * elizaOS services follow a factory pattern. By extending Service:
 * 1. The runtime can discover and start us during plugin initialization
 * 2. We get access to runtime for logging, events, settings
 * 3. We integrate with the service lifecycle (start/stop)
 *
 * WHY IMPLEMENT IAppraisalService?
 * Enables type-safe access from other plugins and facilitates testing
 * with mock implementations.
 */
export class AppraisalService extends Service implements IAppraisalService {
  /**
   * Service type identifier for runtime registry.
   *
   * WHY STATIC?
   * The runtime reads this before instantiating the service. It needs to
   * know the service type to register it in the service map.
   *
   * WHY OVERRIDE?
   * The base Service class has a default serviceType. We override to
   * use our constant, ensuring consistency.
   */
  static override serviceType = APPRAISAL_SERVICE_TYPE;

  /**
   * Human-readable description of this service's capabilities.
   *
   * WHY THIS FIELD?
   * Used by debugging tools and potentially by LLMs when reasoning about
   * available capabilities. A clear description helps both humans and AI.
   */
  public readonly capabilityDescription =
    'Situational appraisal registry for domain evaluator outputs';

  /**
   * Storage for appraisals: one appraisal per domain id.
   *
   * WHY MAP?
   * - O(1) lookup by id
   * - O(1) insertion and deletion
   * - Natural key-value semantics (domain → appraisal)
   *
   * WHY PRIVATE?
   * Direct access to the Map bypasses validation and event emission.
   * All access should go through the public methods.
   *
   * WHY NOT PERSISTENT?
   * Appraisals are transient assessments. They're recomputed when evaluators
   * run. Persistence would mean loading potentially stale data on restart.
   * For now, a clean slate on restart is the right choice.
   */
  private appraisals: Map<string, Appraisal> = new Map();

  /**
   * Create AppraisalService instance.
   *
   * WHY PRIVATE-ISH (called by start())?
   * The service factory pattern in elizaOS uses static start() to create
   * instances. Direct construction is discouraged but allowed for testing.
   *
   * @param runtime - The agent runtime (provides logging, events, settings)
   */
  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  private emitCustomEvent(
    event: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    return this.runtime.emitEvent(event, {
      runtime: this.runtime,
      source: 'appraisal',
      ...payload,
    } as EventPayload);
  }

  /**
   * Start the service.
   *
   * WHY STATIC FACTORY?
   * elizaOS services use a factory pattern:
   * 1. Runtime calls ServiceClass.start(runtime)
   * 2. Factory creates and initializes the instance
   * 3. Factory returns the ready-to-use service
   *
   * This allows async initialization (database connections, etc.) before
   * the service is available. Our service is simple so start() is trivial,
   * but the pattern allows for future complexity.
   *
   * @param runtime - The agent runtime
   * @returns Initialized AppraisalService instance
   */
  static async start(runtime: IAgentRuntime): Promise<AppraisalService> {
    // Log startup for debugging/monitoring
    // WHY LOG? Visibility into service lifecycle. When debugging "why isn't
    // my appraisal showing up?", first check: "did the service start?"
    runtime.logger.info(
      { src: 'plugin:appraisal', agentId: runtime.agentId },
      'Starting Appraisal service'
    );

    const service = new AppraisalService(runtime);

    // WHY SUCCESS LOG? Confirms initialization completed without errors.
    // Distinguishes "service started" from "service is starting".
    runtime.logger.success(
      { src: 'plugin:appraisal', agentId: runtime.agentId },
      'Appraisal service started'
    );

    return service;
  }

  /**
   * Stop the service.
   *
   * WHY CLEAR ON STOP?
   * Clean shutdown. Appraisals are transient - they'll be recomputed when
   * evaluators run again. Clearing prevents stale references and ensures
   * clean state if the service is restarted.
   *
   * WHY ASYNC?
   * elizaOS service lifecycle is async to support services that need to
   * close connections, flush buffers, etc. Our stop is synchronous but
   * we follow the async pattern for consistency.
   */
  async stop(): Promise<void> {
    this.runtime.logger.info(
      { src: 'plugin:appraisal', agentId: this.runtime.agentId },
      'Stopping Appraisal service'
    );

    // Clear all appraisals
    // WHY? Prevent stale references after shutdown. The Map would be
    // garbage collected anyway, but explicit clearing is cleaner.
    this.appraisals.clear();
  }

  // ===========================================================================
  // PUBLISH
  // ===========================================================================

  /**
   * Publish an appraisal.
   *
   * This is the primary write method. Evaluator plugins call this to register
   * their assessments of domains.
   *
   * VALIDATION:
   * - id: Required, non-empty string
   * - ts: Required, must be a number
   * - source: Required, non-empty string
   * - confidence: Required, number between 0 and 1
   *
   * ORDERING:
   * - Rejects if ts <= existing appraisal's ts for same id
   * - Accepts if ts > existing ts, or no existing appraisal
   *
   * SIDE EFFECTS:
   * - Emits APPRAISAL_UPDATED event on success
   * - Logs at debug level
   *
   * @param appraisal - The appraisal to publish
   * @returns true if accepted, false if rejected (stale timestamp)
   * @throws Error if required fields are missing or invalid
   *
   * @example
   * ```typescript
   * const accepted = service.publish({
   *   id: 'money',
   *   ts: Date.now(),
   *   confidence: 0.85,
   *   source: 'plugin-money',
   *   payload: { status: 'cautious' }
   * });
   *
   * if (!accepted) {
   *   console.log('Appraisal rejected - a newer one already exists');
   * }
   * ```
   */
  publish<T>(appraisal: Appraisal<T>): boolean {
    // =========================================================================
    // VALIDATION
    // =========================================================================
    // WHY VALIDATE?
    // Missing required fields are programming errors. Fail fast and loud
    // so developers catch issues immediately, not hours later in production.
    //
    // WHY THROW (not return false)?
    // Distinguishes "rejected because stale" (return false) from
    // "rejected because invalid" (throw). Invalid input is a bug that
    // needs fixing; stale input is normal operation.

    if (!appraisal.id) {
      throw new Error('Appraisal must include id');
    }

    // WHY CHECK typeof?
    // Distinguishes "ts is missing" from "ts is 0" (which is valid, if weird)
    if (typeof appraisal.ts !== 'number') {
      throw new Error('Appraisal must include ts (timestamp)');
    }

    if (!appraisal.source) {
      throw new Error('Appraisal must include source');
    }

    if (typeof appraisal.confidence !== 'number') {
      throw new Error('Appraisal must include confidence');
    }

    // WHY RANGE CHECK?
    // Confidence is documented as 0-1. Values outside this range indicate
    // a bug in the evaluator. Catch it here rather than propagating garbage.
    if (appraisal.confidence < 0 || appraisal.confidence > 1) {
      throw new Error('Appraisal confidence must be between 0 and 1');
    }

    // =========================================================================
    // ORDERING CHECK
    // =========================================================================
    // WHY CHECK EXISTING?
    // The "latest wins" design. If we already have a newer appraisal for
    // this domain, reject the incoming one.

    const existing = this.appraisals.get(appraisal.id);

    // WHY <= (not just <)?
    // Same timestamp means "not newer". This handles:
    // - Duplicate publishes from the same evaluator
    // - Clock precision issues (two events in same millisecond)
    // Decision: tie goes to the existing appraisal. Strict "newer to replace".
    if (existing && appraisal.ts <= existing.ts) {
      // WHY LOG?
      // Debugging aid. If an evaluator's appraisals are being rejected,
      // this log helps identify the cause (timestamp ordering issue).
      this.runtime.logger.debug(
        {
          src: 'plugin:appraisal',
          agentId: this.runtime.agentId,
          appraisalId: appraisal.id,
          existingTs: existing.ts,
          newTs: appraisal.ts,
        },
        'Rejected stale appraisal (older or same timestamp)'
      );
      return false;
    }

    // =========================================================================
    // STORAGE
    // =========================================================================
    // WHY CAST?
    // TypeScript generic handling. The Map stores Appraisal (unparameterized),
    // but we accept Appraisal<T>. The cast is safe because we only access
    // payload through typed getters.

    this.appraisals.set(appraisal.id, appraisal as Appraisal);

    // =========================================================================
    // EVENT EMISSION
    // =========================================================================
    // WHY EMIT EVENT?
    // Notification for debugging, logging, and monitoring. NOT for data flow.
    // Consumers should read via provider, not subscribe to this event.
    //
    // WHY INCLUDE previousAppraisal?
    // Enables change detection. Handlers can diff old vs new for logging.

    void this.emitCustomEvent(AppraisalEvents.UPDATED, {
      agentId: this.runtime.agentId,
      appraisalId: appraisal.id,
      appraisal,
      previousAppraisal: existing,
    });

    // =========================================================================
    // LOGGING
    // =========================================================================
    // Only log when there's an actual change in content, not just a timestamp
    // refresh. This reduces noise from periodic evaluations that produce
    // identical appraisals.

    const hasPayloadChange =
      !existing ||
      JSON.stringify(existing.payload) !== JSON.stringify(appraisal.payload);
    const hasConfidenceChange =
      !existing || Math.abs(existing.confidence - appraisal.confidence) > 0.01;

    if (hasPayloadChange || hasConfidenceChange) {
      this.runtime.logger.debug(
        {
          src: 'plugin:appraisal',
          agentId: this.runtime.agentId,
          appraisalId: appraisal.id,
          confidence: appraisal.confidence,
          source: appraisal.source,
        },
        'Appraisal published'
      );
    }

    return true;
  }

  // ===========================================================================
  // READ
  // ===========================================================================

  /**
   * Get a specific appraisal by domain id.
   *
   * WHY THIS METHOD?
   * Common case: "What's the current money situation?" You know the domain,
   * you just want its appraisal.
   *
   * WHY RETURN NULL (not undefined or throw)?
   * - null: Explicit "no appraisal for this domain"
   * - undefined: Ambiguous (could be missing or explicitly undefined)
   * - throw: Overkill for a normal case (domain hasn't been appraised yet)
   *
   * @param id - Domain identifier (e.g., 'money')
   * @returns The appraisal or null if not found
   *
   * @example
   * ```typescript
   * const money = service.get<MoneyPayload>('money');
   * if (money) {
   *   console.log(`Money status: ${money.payload.status}`);
   *   console.log(`Confidence: ${money.confidence}`);
   * } else {
   *   console.log('No money appraisal available');
   * }
   * ```
   */
  get<T>(id: string): Appraisal<T> | null {
    const appraisal = this.appraisals.get(id);
    // WHY CAST?
    // The caller specifies the expected payload type. We trust them
    // (or they'll get a runtime error when accessing payload fields).
    return (appraisal as Appraisal<T>) ?? null;
  }

  /**
   * Get all current appraisals as a record.
   *
   * WHY RECORD (not Map)?
   * - JSON-serializable: Providers need to pass this to LLM context
   * - Simpler iteration: Object.entries() is more familiar than Map.entries()
   * - No ordering guarantees needed: Appraisals aren't ordered by domain
   *
   * WHY RETURN A NEW OBJECT?
   * Object.fromEntries creates a new object. This prevents callers from
   * accidentally mutating the internal state.
   *
   * @returns Record of domain id → appraisal (empty object if none)
   *
   * @example
   * ```typescript
   * const all = service.getAll();
   * for (const [domain, appraisal] of Object.entries(all)) {
   *   console.log(`${domain}: ${appraisal.confidence}`);
   * }
   * ```
   */
  getAll(): Record<string, Appraisal> {
    // WHY Object.fromEntries?
    // Converts Map to plain object. Simple, readable, creates new object.
    return Object.fromEntries(this.appraisals);
  }

  /**
   * Get all registered appraisal domain ids.
   *
   * WHY THIS METHOD?
   * Useful for:
   * - Debugging: "What domains have appraisals?"
   * - UI: Show list of available domains
   * - Iteration: Loop through domains without loading full appraisals
   *
   * WHY RETURN ARRAY (not Set or iterator)?
   * - Arrays are familiar and easy to work with
   * - JSON-serializable for debugging/logging
   * - No ordering guarantees, so Set's uniqueness isn't special here
   *
   * @returns Array of domain ids (empty array if none)
   *
   * @example
   * ```typescript
   * const domains = service.getIds();
   * console.log(`Registered domains: ${domains.join(', ')}`);
   * ```
   */
  getIds(): string[] {
    // WHY Array.from?
    // Map.keys() returns an iterator. Array.from converts to array.
    return Array.from(this.appraisals.keys());
  }

  // ===========================================================================
  // CLEAR
  // ===========================================================================

  /**
   * Clear (remove) an appraisal by domain id.
   *
   * WHY THIS METHOD?
   * Two ways to invalidate an appraisal:
   *
   * 1. PUBLISH WITH CONFIDENCE 0
   *    ```typescript
   *    service.publish({ id: 'money', ts: Date.now(), confidence: 0, ... });
   *    ```
   *    Keeps the entry, marks it as "unknown/invalid". Preserves history
   *    of when it was last updated.
   *
   * 2. CLEAR (THIS METHOD)
   *    ```typescript
   *    service.clear('money');
   *    ```
   *    Removes the entry entirely. As if the domain was never appraised.
   *
   * USE CLEAR WHEN:
   * - A domain is no longer relevant (evaluator plugin unloaded)
   * - Testing: Reset state between tests
   * - Cleanup: Remove obsolete domains
   *
   * USE CONFIDENCE 0 WHEN:
   * - The domain is still relevant, but assessment is uncertain
   * - You want to preserve the "last known" timestamp
   * - You want getIds() to still include this domain
   *
   * @param id - Domain identifier to clear
   * @returns true if removed, false if not found
   *
   * @example
   * ```typescript
   * if (service.clear('money')) {
   *   console.log('Money appraisal cleared');
   * } else {
   *   console.log('No money appraisal to clear');
   * }
   * ```
   */
  clear(id: string): boolean {
    // WHY GET EXISTING FIRST?
    // Need the appraisal for the CLEARED event payload. Also determines
    // return value (true if existed, false if not).
    const existing = this.appraisals.get(id);

    if (!existing) {
      // WHY RETURN FALSE (not throw)?
      // Clearing a non-existent appraisal is not an error. The caller's
      // intent ("remove this domain") is achieved (nothing there).
      // But returning false tells them "there was nothing to remove".
      return false;
    }

    // Remove from registry
    this.appraisals.delete(id);

    // WHY EMIT EVENT?
    // Same rationale as UPDATED event: notification for debugging/monitoring.
    // The payload includes the cleared appraisal because it's gone from
    // the registry - this is the last chance to see it.
    void this.emitCustomEvent(AppraisalEvents.CLEARED, {
      agentId: this.runtime.agentId,
      appraisalId: id,
      clearedAppraisal: existing,
    });

    this.runtime.logger.debug(
      {
        src: 'plugin:appraisal',
        agentId: this.runtime.agentId,
        appraisalId: id,
      },
      'Appraisal cleared'
    );

    return true;
  }
}
