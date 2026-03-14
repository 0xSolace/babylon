/**
 * @fileoverview Constants for plugin-appraisal
 *
 * =============================================================================
 * WHY THIS FILE EXISTS
 * =============================================================================
 *
 * Centralizing constants provides:
 *
 * 1. SINGLE SOURCE OF TRUTH
 *    Event names, provider names, and service types are used across multiple
 *    files. Defining them once prevents typos and inconsistencies.
 *
 * 2. EASY REFACTORING
 *    If we rename an event, we change it here and TypeScript catches all
 *    usages. No grep-and-replace across the codebase.
 *
 * 3. DOCUMENTATION
 *    Constants grouped together are easier to discover and understand
 *    than scattered string literals.
 *
 * 4. TYPE SAFETY
 *    Using `as const` makes these readonly and enables TypeScript to
 *    infer literal types, catching typos at compile time.
 */

/**
 * Event names emitted by plugin-appraisal.
 *
 * =============================================================================
 * WHY EVENTS?
 * =============================================================================
 *
 * Events serve as NOTIFICATIONS, not DATA FLOW channels.
 *
 * DO use events for:
 * - Debugging/logging when appraisals change
 * - Monitoring appraisal update frequency
 * - Analytics and history recording
 * - Triggering side effects (e.g., UI updates)
 *
 * DON'T use events for:
 * - Reading appraisal data (use the provider instead)
 * - Data synchronization between plugins
 * - Real-time reactive data flow
 *
 * WHY THIS DISTINCTION?
 * elizaOS uses a provider-based architecture for data flow. Providers inject
 * data into the LLM context during composeState(). Events are fire-and-forget
 * notifications. Mixing these patterns leads to race conditions and complexity.
 *
 * CORRECT PATTERN:
 * ```typescript
 * // Reading appraisals (DO THIS)
 * const state = await runtime.composeState(message, ['APPRAISALS']);
 * const moneyAppraisal = state.data.providers.APPRAISALS.appraisals.money;
 *
 * // Logging changes (THIS IS FINE)
 * runtime.registerEvent('APPRAISAL_UPDATED', (payload) => {
 *   logger.debug('Appraisal updated:', payload.appraisalId);
 * });
 * ```
 *
 * ANTI-PATTERN:
 * ```typescript
 * // DON'T DO THIS - events for data flow
 * let cachedAppraisals = {};
 * runtime.registerEvent('APPRAISAL_UPDATED', (payload) => {
 *   cachedAppraisals[payload.appraisalId] = payload.appraisal; // BAD
 * });
 * ```
 */
export const AppraisalEvents = {
  /**
   * Emitted when an appraisal is published or updated.
   *
   * WHY THIS EVENT?
   * Enables debugging and monitoring without polling. You can log every
   * appraisal change, track update frequency, or trigger UI refreshes.
   *
   * PAYLOAD: AppraisalUpdatedPayload
   * Contains: runtime, source, agentId, appraisalId, appraisal, previousAppraisal
   *
   * @example
   * ```typescript
   * runtime.registerEvent(AppraisalEvents.UPDATED, (payload) => {
   *   console.log(`${payload.appraisalId} updated: confidence ${payload.appraisal.confidence}`);
   *   if (payload.previousAppraisal) {
   *     console.log(`Previous confidence was: ${payload.previousAppraisal.confidence}`);
   *   }
   * });
   * ```
   */
  UPDATED: 'APPRAISAL_UPDATED',

  /**
   * Emitted when an appraisal is explicitly cleared (removed).
   *
   * WHY THIS EVENT?
   * Distinguishes between "appraisal updated" and "appraisal removed".
   * Useful for cleanup logic, debugging domain lifecycle, and analytics.
   *
   * WHY SEPARATE FROM UPDATED?
   * Semantically different operations. An update replaces data; a clear
   * removes it. Handlers may want to react differently.
   *
   * PAYLOAD: AppraisalClearedPayload
   * Contains: runtime, source, agentId, appraisalId, clearedAppraisal
   *
   * @example
   * ```typescript
   * runtime.registerEvent(AppraisalEvents.CLEARED, (payload) => {
   *   console.log(`${payload.appraisalId} cleared`);
   *   // Maybe trigger cleanup of dependent data
   * });
   * ```
   */
  CLEARED: 'APPRAISAL_CLEARED',
} as const;

/**
 * Provider name for appraisals.
 *
 * WHY A CONSTANT?
 * Provider names are strings used for:
 * 1. Registration: `providers: [{ name: APPRAISAL_PROVIDER_NAME, ... }]`
 * 2. Consumption: `composeState(message, [APPRAISAL_PROVIDER_NAME])`
 * 3. State access: `state.data.providers[APPRAISAL_PROVIDER_NAME]`
 *
 * A constant ensures consistency across all usages.
 *
 * WHY 'APPRAISALS' (PLURAL)?
 * The provider returns ALL appraisals, not just one. Plural naming
 * makes this clear: `APPRAISALS.appraisals.money` vs `APPRAISAL.money`.
 *
 * @example
 * ```typescript
 * // In consumer plugin
 * const state = await runtime.composeState(message, [APPRAISAL_PROVIDER_NAME]);
 * const appraisals = state.data.providers[APPRAISAL_PROVIDER_NAME].appraisals;
 * ```
 */
export const APPRAISAL_PROVIDER_NAME = 'APPRAISALS';

/**
 * Service type identifier.
 *
 * WHY A CONSTANT?
 * Service types are strings used for:
 * 1. Registration: `static serviceType = APPRAISAL_SERVICE_TYPE`
 * 2. Retrieval: `runtime.getService(APPRAISAL_SERVICE_TYPE)`
 *
 * A constant ensures the service factory and consumers use the same string.
 *
 * WHY 'appraisal' (SINGULAR)?
 * Service names are typically singular: 'motivation', 'homeostasis', 'message'.
 * The service IS the appraisal service, not "appraisals service".
 *
 * @example
 * ```typescript
 * // In plugin.ts
 * class AppraisalServiceFactory extends Service {
 *   static override serviceType = APPRAISAL_SERVICE_TYPE;
 * }
 *
 * // In consumer plugin
 * const service = runtime.getService(APPRAISAL_SERVICE_TYPE) as AppraisalService;
 * ```
 */
export const APPRAISAL_SERVICE_TYPE = 'appraisal';
