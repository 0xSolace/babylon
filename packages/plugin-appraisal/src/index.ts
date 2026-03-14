/**
 * @elizaos/plugin-appraisal
 *
 * Situational appraisal registry for elizaOS agents.
 *
 * =============================================================================
 * WHAT THIS PACKAGE PROVIDES
 * =============================================================================
 *
 * A central registry for domain evaluator outputs. Evaluators (money, power,
 * notoriety, etc.) publish appraisals, and consumers (motivation) read them.
 *
 * =============================================================================
 * WHY THIS PACKAGE EXISTS
 * =============================================================================
 *
 * PROBLEM: Without centralized appraisal tracking:
 * - Each evaluator stores assessments separately
 * - Each consumer needs to know about all evaluators
 * - Tight coupling between evaluators and consumers
 * - Adding new domains requires changes everywhere
 *
 * SOLUTION: This package provides:
 * - A typed registry (AppraisalService)
 * - Provider-based consumption (appraisalProvider)
 * - Clean decoupling between producers and consumers
 * - Simple "latest wins" ordering
 *
 * =============================================================================
 * ARCHITECTURE
 * =============================================================================
 *
 * This package sits in the middle of the agent's situational awareness:
 *
 *   homeostasis (internal state) + appraisal (external situation) → motivation (priorities)
 *
 * - Homeostasis: How the agent feels inside (hunger, fatigue, drives)
 * - Appraisal: What's happening outside (money, power, reputation)
 * - Motivation: What to prioritize based on both
 *
 * =============================================================================
 * KEY DESIGN DECISIONS
 * =============================================================================
 *
 * 1. LATEST WINS
 *    When a new appraisal arrives, it replaces the old one (same domain).
 *    No accumulation, no merging, no conflict resolution.
 *    WHY: Simple, predictable, debuggable.
 *
 * 2. PROVIDER-BASED CONSUMPTION
 *    Consumers read via provider during composeState(), not via events.
 *    WHY: Fresh data at point of use, no caching issues.
 *
 * 3. NO TIME-BASED EXPIRY
 *    Appraisals don't expire on a timer. Producers schedule tasks if needed.
 *    WHY: Event-driven architecture, no hidden timers.
 *
 * 4. TYPED PAYLOADS
 *    Appraisal<T> is generic to allow domain-specific payload types.
 *    WHY: Type safety while keeping registry domain-agnostic.
 *
 * =============================================================================
 * USAGE
 * =============================================================================
 *
 * @example Adding the plugin to an agent
 * ```typescript
 * import { appraisalPlugin } from '@elizaos/plugin-appraisal';
 *
 * const character = {
 *   name: 'MyAgent',
 *   plugins: [appraisalPlugin],
 * };
 * ```
 *
 * @example Publishing an appraisal (from a domain evaluator plugin)
 * ```typescript
 * import { AppraisalService, APPRAISAL_SERVICE_TYPE } from '@elizaos/plugin-appraisal';
 *
 * const service = runtime.getService(APPRAISAL_SERVICE_TYPE) as AppraisalService;
 * service.publish({
 *   id: 'money',
 *   ts: Date.now(),
 *   confidence: 0.85,
 *   source: 'plugin-money',
 *   payload: { status: 'cautious', reserves: 'low' }
 * });
 * ```
 *
 * @example Reading appraisals (via provider during composeState)
 * ```typescript
 * import { APPRAISAL_PROVIDER_NAME } from '@elizaos/plugin-appraisal';
 *
 * const state = await runtime.composeState(message, [APPRAISAL_PROVIDER_NAME]);
 * const appraisals = state.data.providers[APPRAISAL_PROVIDER_NAME].appraisals;
 * const money = appraisals.money;
 * if (money && money.confidence > 0.5) {
 *   console.log(`Money status: ${money.payload.status}`);
 * }
 * ```
 *
 * @example Reading appraisals (via service directly)
 * ```typescript
 * import { AppraisalService, APPRAISAL_SERVICE_TYPE } from '@elizaos/plugin-appraisal';
 *
 * const service = runtime.getService(APPRAISAL_SERVICE_TYPE) as AppraisalService;
 * const money = service.get<{ status: string }>('money');
 * const all = service.getAll();
 * const domains = service.getIds();
 * ```
 *
 * =============================================================================
 * EXPORTS
 * =============================================================================
 *
 * Types:
 * - Appraisal<T>: The core appraisal interface
 * - IAppraisalService: Service interface for type-safe access
 * - AppraisalUpdatedPayload: Event payload for APPRAISAL_UPDATED
 * - AppraisalClearedPayload: Event payload for APPRAISAL_CLEARED
 *
 * Constants:
 * - AppraisalEvents: Event names (UPDATED, CLEARED)
 * - APPRAISAL_PROVIDER_NAME: Provider name ('APPRAISALS')
 * - APPRAISAL_SERVICE_TYPE: Service type ('appraisal')
 *
 * Service:
 * - AppraisalService: The registry implementation
 *
 * Providers:
 * - appraisalProvider: Main provider with situational snapshot
 * - appraisalInstructionsProvider: Documentation for LLM
 * - appraisalSettingsProvider: Current plugin status
 *
 * Plugin:
 * - appraisalPlugin: The Plugin object to register with elizaOS
 *
 * @module @elizaos/plugin-appraisal
 */

// =============================================================================
// TYPES
// =============================================================================
// WHY EXPORT TYPES?
// Other plugins need these for type-safe integration:
// - Appraisal<T> for publishing typed appraisals
// - IAppraisalService for mock implementations in tests
// - Event payloads for event handlers

export * from './types.ts';

// =============================================================================
// CONSTANTS
// =============================================================================
// WHY EXPORT CONSTANTS?
// Other plugins need these for:
// - Event registration: runtime.registerEvent(AppraisalEvents.UPDATED, ...)
// - Service access: runtime.getService(APPRAISAL_SERVICE_TYPE)
// - Provider access: composeState(msg, [APPRAISAL_PROVIDER_NAME])

export * from './constants.ts';

// =============================================================================
// SERVICE
// =============================================================================
// WHY EXPORT SERVICE CLASS?
// Consumers may need to cast the service for type-safe access:
//   const service = runtime.getService('appraisal') as AppraisalService;
// Also useful for testing with the real implementation.

export { AppraisalService } from './services/appraisal-service.ts';

// =============================================================================
// PROVIDERS
// =============================================================================
// WHY EXPORT PROVIDERS?
// The plugin registers these automatically, but exporting allows:
// - Testing providers in isolation
// - Referencing providers in documentation
// - Custom plugin compositions that reuse our providers

export { appraisalProvider } from './providers/appraisal-provider.ts';
export { appraisalDebugProvider } from './providers/debug-provider.ts';
export {
  appraisalInstructionsProvider,
  appraisalSettingsProvider,
} from './providers/plugin-info.ts';

// =============================================================================
// ACTIONS
// =============================================================================
// WHY EXPORT ACTIONS?
// The plugin registers these automatically, but exporting allows:
// - Testing actions in isolation
// - Custom plugin compositions that reuse our actions

export { inspectSituationAction } from './actions/inspect-situation.ts';

// =============================================================================
// ROUTES
// =============================================================================
// WHY EXPORT ROUTES?
// Debug routes for HTTP inspection of appraisal state.
// Useful for monitoring and debugging the motivation flow.
//
// Available endpoints:
// - GET /debug/appraisals - All current appraisals
// - GET /debug/appraisals/health - Health metrics
// - GET /debug/appraisals/:id - Specific appraisal by domain

export { appraisalDebugRoutes } from './routes/debug-routes.ts';

// =============================================================================
// WORKERS
// =============================================================================
// WHY EXPORT WORKERS?
// Task workers for scheduled appraisal maintenance.
// - appraisalRefreshWorker: Checks staleness, applies confidence decay
// - ensureAppraisalRefreshTask: Creates the recurring task on init
//
// Events emitted:
// - 'appraisal:refresh_needed': When an appraisal is too stale
// - 'appraisal:confidence_decayed': When confidence is reduced

export {
  APPRAISAL_CONFIDENCE_DECAY_RATE,
  APPRAISAL_REFRESH_INTERVAL,
  APPRAISAL_REFRESH_TASK,
  APPRAISAL_STALENESS_THRESHOLD,
  type AppraisalConfidenceDecayedEvent,
  type AppraisalRefreshNeededEvent,
  appraisalRefreshWorker,
  ensureAppraisalRefreshTask,
} from './workers/appraisal-refresh.ts';

// =============================================================================
// UTILITIES
// =============================================================================
// WHY EXPORT UTILITIES?
// Helper functions for domain evaluators:
// - isEvaluatorEnabled: Check if evaluator should run for this character
// - getEnabledEvaluators: Get list of enabled evaluator domains
// - getEvaluatorConfigSummary: Debug logging helper

export {
  getEnabledEvaluators,
  getEvaluatorConfigSummary,
  isEvaluatorEnabled,
} from './utils/evaluator-config.ts';

// =============================================================================
// PLUGIN
// =============================================================================
// WHY EXPORT PLUGIN?
// This is the main export. Agents add it to their plugins array:
//   plugins: [appraisalPlugin]
//
// WHY BOTH NAMED AND DEFAULT?
// - Named: import { appraisalPlugin } from '...'
// - Default: import appraisal from '...'
// Accommodates different import preferences.

export { appraisalPlugin, default } from './plugin.ts';
