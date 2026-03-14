/**
 * @elizaos/plugin-homeostasis
 *
 * Internal state manager for elizaOS agents.
 *
 * OVERVIEW
 * ========
 * This plugin maintains the agent's three-layer internal state:
 *
 * 1. **Physiological** (body simulation): hunger, fatigue, hydration, health
 *    - Scale: 0=satisfied, 100=deprived
 *    - Dynamics: Accumulate on activity
 *
 * 2. **Psychological** (mind/drives): security, social, status, autonomy, meaning
 *    - Scale: 50=balanced, extremes=tension
 *    - Dynamics: Recover toward baseline
 *
 * 3. **Resources** (external assets): wallets, inference tokens, files, etc.
 *    - Scale: Unbounded
 *    - Dynamics: None by default
 *
 * Think of it as the agent's "body" - it tracks state but doesn't decide actions.
 *
 * TICK MODES
 * ==========
 * By default, homeostasis ticks on **activity** (when LLM is used or agent replies).
 * This makes state changes responsive to actual engagement rather than wall-clock time.
 *
 * Set HOMEOSTASIS_TICK_MODE='timer' for traditional interval-based ticking.
 *
 * QUICK START
 * ===========
 * ```typescript
 * import { homeostasisPlugin } from '@elizaos/plugin-homeostasis';
 *
 * const runtime = new AgentRuntime({
 *   character,
 *   plugins: [homeostasisPlugin, ...otherPlugins],
 * });
 * ```
 *
 * READING STATE
 * =============
 * ```typescript
 * const service = runtime.getService('homeostasis') as HomeostasisService;
 *
 * // Physiological (0=satisfied, 100=deprived)
 * const phys = service.getPhysiological();
 * // { hunger: 15, fatigue: 42, hydration: 8, health: 5 }
 *
 * // Psychological (50=balanced)
 * const drives = service.getDrives();
 * // { security: 72, social: 45, status: 58, autonomy: 63, meaning: 41 }
 *
 * // Resources
 * const solBalance = service.getResource('wallets.sol');
 * // 2.5
 *
 * // Overall stress level (0-1)
 * const stress = service.getPhysiologicalStress();
 * // 0.175
 * ```
 *
 * WRITING STATE
 * =============
 * ```typescript
 * // Satisfying hunger (negative delta = reduce deprivation)
 * service.proposePhysiologicalDelta(
 *   { hunger: -30 },
 *   { source: 'activity', reason: 'ate_meal' }
 * );
 *
 * // Task failure affects psychological state
 * service.proposeDriveDelta(
 *   { security: -10, status: -5 },
 *   { source: 'neuro', reason: 'task_failure' }
 * );
 *
 * // Resource changes
 * service.reportResourceDelta(
 *   { 'wallets.sol': +2.5 },
 *   { source: 'commerce' }
 * );
 * ```
 *
 * EVENTS
 * ======
 * ```typescript
 * // Physiological events
 * runtime.on('HOMEOSTASIS_PHYSIOLOGICAL_CRITICAL', (payload) => {
 *   console.log(`${payload.variable} is critical: ${payload.value}`);
 * });
 *
 * // Psychological events
 * runtime.on('HOMEOSTASIS_DRIVE_CRITICAL', (payload) => {
 *   console.log(`${payload.drive} is critical: ${payload.value}`);
 * });
 * ```
 *
 * COUPLING
 * ========
 * When physiological stress is high (average > 70%), psychological recovery
 * is halved. This creates emergent "survival mode" where hungry, tired agents
 * naturally focus on immediate needs.
 *
 * ARCHITECTURE
 * ============
 * This plugin is intentionally "dumb" - it holds numbers and applies math.
 * Interpretation and decision-making belong in other plugins:
 *
 * - plugin-motivation: Interprets drives into priorities
 * - plugin-autonomous: Decides actions based on state
 * - plugin-neuro: Evaluates outcomes and reports deltas
 * - Domain plugins: Report resource changes
 *
 * @module @elizaos/plugin-homeostasis
 */

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * The feeding evaluator for processing FEEDING_COMMAND messages.
 * Usually registered automatically by the plugin.
 */
export { feedingEvaluator } from './evaluators/feeding-evaluator.ts';

/**
 * The main plugin export.
 * Add this to your agent's plugins array.
 */
export { homeostasisPlugin } from './plugin.ts';
/**
 * The provider for direct access.
 * Usually registered automatically by the plugin.
 */
export { homeostasisProvider } from './providers/homeostasis-provider.ts';
/**
 * The service class for direct access.
 * Usually accessed via: runtime.getService('homeostasis')
 */
export { HomeostasisService } from './services/homeostasis-service.ts';
/**
 * Export all types for consumers to use.
 */
export * from './types.ts';
