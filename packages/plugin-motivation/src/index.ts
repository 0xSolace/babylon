/**
 * @elizaos/plugin-motivation
 *
 * Motivation interpreter for elizaOS agents.
 *
 * OVERVIEW
 * ========
 * This plugin interprets raw homeostasis state (drives, physiological, resources)
 * AND situational appraisals (from plugin-appraisal) into actionable orientation:
 *
 * - **Priorities**: What matters most right now
 * - **Constraints**: What limits acceptable action
 * - **Opportunities**: What possibilities exist
 * - **Narrative**: Human-readable motivational story
 *
 * ARCHITECTURE
 * ============
 * ```
 * Homeostasis State + Appraisals (optional)
 *        ↓
 * Signals (buckets: critical/low/balanced/satisfied/abundant)
 *        ↓
 * Patterns (internal + situational combinations)
 *        ↓
 * Frame Filter (Maslow/Power/Notoriety lens)
 *        ↓
 * Output (priorities, constraints, opportunities, narrative)
 * ```
 *
 * APPRAISAL INTEGRATION (v0.2)
 * ============================
 * If plugin-appraisal is loaded, motivation incorporates situational awareness:
 *
 * - **Internal patterns**: From homeostasis (survival_mode, foundation_shaky, etc.)
 * - **Situational patterns**: From appraisals (financial_constraint, influence_position, etc.)
 *
 * This combines "how I feel" (internal) with "what's happening" (external)
 * for contextual motivation.
 *
 * FRAMES
 * ======
 * Frames are interpretation lenses, not algorithms:
 *
 * - **Maslow**: Hierarchical needs - lower must be met before higher surface
 * - **Power**: Control/influence lens - status and autonomy primary
 * - **Notoriety**: Reputation lens - visibility and perception primary
 * - **Survival**: Auto-activates on critical physiological stress
 *
 * QUICK START
 * ===========
 * ```typescript
 * import { motivationPlugin } from '@elizaos/plugin-motivation';
 *
 * const runtime = new AgentRuntime({
 *   character,
 *   plugins: [homeostasisPlugin, motivationPlugin, ...otherPlugins],
 * });
 * ```
 *
 * READING STATE
 * =============
 * ```typescript
 * const service = runtime.getService('motivation') as MotivationService;
 *
 * // Get current motivation
 * const state = service.getState();
 * // { priorities, constraints, opportunities, dominantFrame, narrative }
 *
 * // Get just priorities
 * const priorities = service.getPriorities();
 * // [{ need: 'restore_security', intensity: 0.8, drivers: ['security'] }]
 *
 * // Get narrative
 * const narrative = service.getNarrative();
 * // "My foundation needs attention. Security feels unstable..."
 * ```
 *
 * CONFIGURATION
 * =============
 * ```
 * MOTIVATION_DEFAULT_FRAME=maslow     # Default interpretation frame
 * MOTIVATION_SURVIVAL_THRESHOLD=75    # Physiological level to force survival frame
 * MOTIVATION_UPDATE_THROTTLE_MS=1000  # Minimum time between recalculations
 * ```
 *
 * EVENTS
 * ======
 * ```typescript
 * runtime.on('MOTIVATION_UPDATED', (payload) => {
 *   console.log('Motivation updated:', payload.state);
 * });
 *
 * runtime.on('MOTIVATION_PRIORITIES_CHANGED', (payload) => {
 *   console.log('Priorities changed:', payload.priorities);
 * });
 *
 * runtime.on('MOTIVATION_FRAME_SHIFTED', (payload) => {
 *   console.log(`Frame shifted: ${payload.previousFrame} → ${payload.newFrame}`);
 * });
 * ```
 *
 * @module @elizaos/plugin-motivation
 */

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Export appraisal types for consumers who need them.
 */
export type { Appraisal, IAppraisalService } from './appraisal-types.ts';
export { APPRAISAL_SERVICE_TYPE } from './appraisal-types.ts';
/**
 * Export constants.
 */
export {
  AppraisalDefaults, // Appraisal integration constants
  Defaults,
  IndicatorMap, // Appraisal signal conversion keywords
  MotivationEvents,
  PatternIds,
  SignalIntensity,
} from './constants.ts';
/**
 * Frame utilities.
 */
export {
  getAllFrames,
  getCharacterDefaultFrame,
  getFrame,
  inferDefaultFrame,
  selectFrame,
} from './frames/index.ts';
export type { Frame } from './frames/types.ts';
/**
 * Autonomous integration utilities.
 *
 * These helpers make it easy for plugin-autonomous to consume motivation state.
 *
 * @example
 * ```typescript
 * import {
 *   getMotivationContext,
 *   shouldPrioritize,
 *   hasConstraint,
 *   isConservative,
 * } from '@elizaos/plugin-motivation';
 *
 * const context = await getMotivationContext(runtime);
 * if (context && isConservative(context)) {
 *   // Be more cautious in responses
 * }
 * ```
 */
export {
  formatForPrompt,
  getMotivationContext,
  getMotivationFromState,
  getRelevanceMultiplier,
  getTopPriority,
  hasConstraint,
  hasOpportunity,
  isConservative,
  type MotivationContext,
  shouldPrioritize,
} from './integration/autonomous.ts';
/**
 * Goals integration utilities.
 * Connect motivation priorities and opportunities to plugin-goals.
 *
 * @example
 * ```typescript
 * import { generateGoalCandidates, convertPriorityToGoal } from '@elizaos/plugin-motivation';
 *
 * const candidates = generateGoalCandidates(motivationState);
 * const goalParams = convertPriorityToGoal(priority, agentId);
 * await goalService.createGoal(goalParams);
 * ```
 */
export {
  convertOpportunityToGoal,
  convertPriorityToGoal,
  type GoalCandidate,
  type GoalCreationParams,
  generateGoalCandidates,
  suggestGoalUpdate,
} from './integration/goals.ts';
/**
 * Narrative utilities.
 */
export {
  formatMotivationContext,
  generateNarrative,
} from './narrative/generator.ts';
export { patternsToConstraints } from './output/constraints.ts';
export { patternsToOpportunities } from './output/opportunities.ts';
/**
 * Output utilities.
 */
export { patternsToPriorities } from './output/priorities.ts';
/**
 * Pattern utilities.
 */
export { detectPatterns } from './patterns/index.ts';
/**
 * The main plugin export.
 */
export { motivationPlugin } from './plugin.ts';
/**
 * The provider for direct access.
 */
export { motivationProvider } from './providers/motivation-provider.ts';
/**
 * Debug routes for HTTP inspection.
 *
 * Available endpoints:
 * - GET /debug/motivation - Full motivation state
 * - GET /debug/motivation/priorities - Current priorities
 * - GET /debug/motivation/signals - Current signals
 * - GET /debug/motivation/patterns - Active patterns
 * - GET /debug/motivation/full - Complete snapshot
 */
export { motivationDebugRoutes } from './routes/debug-routes.ts';
/**
 * The service class for direct access.
 */
export { MotivationService } from './services/motivation-service.ts';
/**
 * Signal utilities.
 */
export {
  appraisalToSignal, // Convert appraisal to situational signal
  driveToSignal,
  isConstrainedSituational, // Check if situational signal is constraining
  isFavorableSituational, // Check if situational signal is favorable
  physiologicalToSignal,
  stateToSignals,
} from './signals/index.ts';
/**
 * Export all types.
 */
export * from './types.ts';
