/**
 * @fileoverview Plugin Appraisal - Main plugin definition
 *
 * =============================================================================
 * WHY THIS PLUGIN EXISTS
 * =============================================================================
 *
 * elizaOS agents need to maintain awareness of their external situation
 * across multiple domains (money, power, notoriety, relationships, etc.).
 * This plugin provides the infrastructure for that awareness.
 *
 * PROBLEM IT SOLVES:
 * Without this plugin, each evaluator would need to store its assessments
 * separately, and each consumer would need to know about all evaluators.
 * This creates tight coupling and makes adding new domains difficult.
 *
 * SOLUTION:
 * A central registry that evaluators publish to and consumers read from.
 * Evaluators don't know about each other. Consumers don't know about
 * evaluators. Clean decoupling through shared infrastructure.
 *
 * =============================================================================
 * ARCHITECTURAL POSITION
 * =============================================================================
 *
 * This plugin sits in a specific position in the agent's information flow:
 *
 * ```
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │                           AGENT STATE AWARENESS                          │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │                                                                          │
 * │   ┌─────────────────┐         ┌─────────────────┐                        │
 * │   │   HOMEOSTASIS   │         │    APPRAISAL    │                        │
 * │   │  (internal)     │         │   (external)    │                        │
 * │   │                 │         │                 │                        │
 * │   │  - Drives       │    +    │  - Money        │                        │
 * │   │  - Physiology   │         │  - Power        │                        │
 * │   │  - Resources    │         │  - Notoriety    │                        │
 * │   └────────┬────────┘         └────────┬────────┘                        │
 * │            │                           │                                 │
 * │            └───────────┬───────────────┘                                 │
 * │                        ▼                                                 │
 * │            ┌─────────────────┐                                           │
 * │            │   MOTIVATION    │                                           │
 * │            │ (interpretation)│                                           │
 * │            │                 │                                           │
 * │            │  - Priorities   │                                           │
 * │            │  - Constraints  │                                           │
 * │            │  - Opportunities│                                           │
 * │            └─────────────────┘                                           │
 * │                                                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * KEY INSIGHT: Homeostasis tracks INTERNAL state (how the agent feels).
 * Appraisal tracks EXTERNAL situation (what's happening around the agent).
 * Motivation combines both to decide priorities.
 *
 * =============================================================================
 * DESIGN PRINCIPLES
 * =============================================================================
 *
 * 1. PLUMBING, NOT INTELLIGENCE
 *    We are a registry. We don't interpret, prioritize, or decide.
 *    Evaluators own meaning; motivation owns arbitration.
 *
 *    WHY? Intelligence should be centralized in motivation. If each layer
 *    had "smart" logic, debugging would be impossible.
 *
 * 2. LATEST WINS
 *    When a new appraisal arrives, it replaces the old one (same id).
 *    No accumulation, no merging, no conflict resolution.
 *
 *    WHY? Simplicity. Predictable behavior. Easy to debug.
 *
 * 3. PROVIDER-BASED CONSUMPTION
 *    Consumers read appraisals via provider during composeState().
 *    Events are for notification/debugging only.
 *
 *    WHY? Fits elizaOS patterns. Ensures fresh data at point of use.
 *
 * 4. NO TIME-BASED EXPIRY
 *    Appraisals don't expire on a timer. If expiry is needed,
 *    producers schedule tasks (via plugin-pim) to publish updates.
 *
 *    WHY? Event-driven architecture. No hidden timers. Producers control
 *    the lifecycle of their appraisals.
 *
 * 5. ZERO DEPENDENCIES
 *    This plugin depends only on core runtime. No circular dependencies.
 *
 *    WHY? Infrastructure should be foundational. If we depended on
 *    homeostasis or motivation, ordering would be fragile.
 *
 * =============================================================================
 * WHAT THIS PLUGIN OWNS
 * =============================================================================
 *
 * ✅ AppraisalService - The registry (store, retrieve, clear)
 * ✅ Ordering guarantees - Reject older timestamps
 * ✅ appraisalProvider - LLM context with situational snapshot
 * ✅ Events - APPRAISAL_UPDATED, APPRAISAL_CLEARED for notification
 *
 * =============================================================================
 * WHAT THIS PLUGIN DOES NOT OWN
 * =============================================================================
 *
 * ❌ Domain logic (evaluator plugins like plugin-money own this)
 * ❌ Interpretation (motivation owns this)
 * ❌ Action execution (autonomous owns this)
 * ❌ Expiry scheduling (plugin-pim owns this)
 * ❌ LLM calls (nothing in this plugin calls an LLM)
 *
 * =============================================================================
 * USAGE
 * =============================================================================
 *
 * Adding to an agent:
 * ```typescript
 * import { appraisalPlugin } from '@elizaos/plugin-appraisal';
 *
 * const character = {
 *   name: 'MyAgent',
 *   plugins: [appraisalPlugin],
 * };
 * ```
 *
 * Publishing (from an evaluator):
 * ```typescript
 * const service = runtime.getService('appraisal') as AppraisalService;
 * service.publish({
 *   id: 'money',
 *   ts: Date.now(),
 *   confidence: 0.85,
 *   source: 'plugin-money',
 *   payload: { status: 'cautious' }
 * });
 * ```
 *
 * Reading (via provider):
 * ```typescript
 * const state = await runtime.composeState(message, ['APPRAISALS']);
 * const appraisals = state.data.providers.APPRAISALS.appraisals;
 * ```
 */

import {
  type IAgentRuntime,
  logger,
  type Plugin,
  Service,
} from '@elizaos/core';
import { inspectSituationAction } from './actions/inspect-situation.ts';
import { printBanner } from './banner.ts';
import { APPRAISAL_SERVICE_TYPE } from './constants.ts';
import { appraisalProvider } from './providers/appraisal-provider.ts';
import { appraisalDebugProvider } from './providers/debug-provider.ts';
import {
  appraisalInstructionsProvider,
  appraisalSettingsProvider,
} from './providers/plugin-info.ts';
import { appraisalDebugRoutes } from './routes/debug-routes.ts';
import { AppraisalService } from './services/appraisal-service.ts';
import {
  appraisalRefreshWorker,
  ensureAppraisalRefreshTask,
} from './workers/appraisal-refresh.ts';

/**
 * Appraisal Plugin
 *
 * Situational evaluation registry for domain evaluator outputs.
 * Stores appraisals and exposes them via provider for motivation to consume.
 *
 * This is a Plugin object that elizaOS loads and initializes.
 * The Plugin interface defines:
 * - name: Unique identifier
 * - description: Human-readable purpose
 * - dependencies: Other plugins we require
 * - init: Called on startup
 * - services: Service factories to register
 * - providers: Context providers to register
 */
export const appraisalPlugin: Plugin = {
  /**
   * Plugin name.
   *
   * WHY 'appraisal'?
   * - Descriptive: Tells you what it does
   * - Short: Easy to type and reference
   * - Unique: No conflicts with other plugins
   *
   * Used for:
   * - Dependency declarations: dependencies: ['appraisal']
   * - Logging: [APPRAISAL] Starting...
   * - Debugging: "Is the appraisal plugin loaded?"
   */
  name: 'appraisal',

  /**
   * Human-readable description.
   *
   * WHY?
   * Shows up in plugin listings, debugging tools, and potentially
   * LLM reasoning about available capabilities.
   */
  description:
    'Situational appraisal registry - holds domain evaluator outputs',

  /**
   * Plugin dependencies.
   *
   * WHY EMPTY ARRAY?
   * This plugin is pure infrastructure. It depends only on core runtime.
   *
   * The dependency graph is:
   *   appraisal → (nothing)
   *   motivation → appraisal, homeostasis
   *   plugin-money → appraisal
   *
   * By having no dependencies, we can load early and be available
   * when other plugins initialize.
   *
   * If we depended on homeostasis or motivation:
   * - Circular dependency risk
   * - Fragile load ordering
   * - Testing becomes harder
   */
  dependencies: [],

  /**
   * Initialize the plugin.
   *
   * WHY THIS FUNCTION?
   * Called once when the plugin loads. Opportunity to:
   * - Display startup banner
   * - Log configuration
   * - Perform one-time setup
   *
   * Our init is simple because the service does the real work.
   *
   * @param _config - Plugin configuration (unused, we have no config)
   * @param runtime - Agent runtime for logging, settings, etc.
   */
  init: async (
    _config: Record<string, string>,
    runtime: IAgentRuntime
  ): Promise<void> => {
    // Display startup banner
    // WHY BANNER?
    // Visual confirmation the plugin loaded. Shows agent name.
    // Helps distinguish multiple agents in logs.
    printBanner({ runtime });

    // Log initialization
    // WHY LOG?
    // Audit trail. "Did the plugin start?" Check the logs.
    logger.info('[APPRAISAL] Initializing appraisal plugin');

    // Register the appraisal refresh worker
    // WHY?
    // Task workers must be registered with the runtime for the task
    // system to know how to execute them.
    runtime.registerTaskWorker(appraisalRefreshWorker);

    // Schedule task creation after runtime initialization (database adapter ready)
    // WHY .then() INSTEAD OF await?
    // Plugin init must complete for runtime init to finish - awaiting would deadlock.
    // The refresh worker needs a task to poll. If no task exists,
    // the worker never runs. We create the task here on init.
    runtime.initPromise.then(async () => {
      try {
        await ensureAppraisalRefreshTask(runtime);
      } catch (error) {
        logger.error(
          { src: 'plugin:appraisal', error },
          'Failed to create appraisal refresh task'
        );
      }
    });
  },

  /**
   * Service factories.
   *
   * WHY A FACTORY CLASS?
   * elizaOS services use a factory pattern:
   * 1. The runtime reads serviceType to know what service this provides
   * 2. The runtime calls start() to create an instance
   * 3. The runtime registers the instance for getService() access
   * 4. On shutdown, the runtime calls stop()
   *
   * WHY NOT JUST EXPORT AppraisalService?
   * The factory pattern allows:
   * - Async initialization (database connections, etc.)
   * - Dependency injection via runtime
   * - Clean separation between factory and implementation
   *
   * Our factory delegates to AppraisalService.start(), keeping the
   * pattern but avoiding duplication.
   */
  services: [
    class AppraisalServiceFactory extends Service {
      /**
       * Service type identifier.
       *
       * WHY STATIC?
       * Runtime reads this before instantiation to register the service type.
       *
       * WHY OVERRIDE?
       * Base Service has a default. We use our constant for consistency.
       */
      static override serviceType = APPRAISAL_SERVICE_TYPE;

      /**
       * Human-readable capability description.
       *
       * WHY?
       * May be used by debugging tools or LLMs reasoning about
       * available services.
       */
      public readonly capabilityDescription =
        'Situational appraisal registry for domain evaluator outputs';

      /**
       * Start the service.
       *
       * WHY DELEGATE TO AppraisalService.start()?
       * Keeps implementation in the service class, not the factory.
       * Factory is just the adapter for elizaOS's plugin system.
       *
       * @param runtime - Agent runtime
       * @returns Initialized service instance
       */
      static async start(runtime: IAgentRuntime): Promise<Service> {
        return await AppraisalService.start(runtime);
      }

      /**
       * Stop the service.
       *
       * WHY RETRIEVE FROM RUNTIME?
       * The factory class isn't the same instance as the running service.
       * We need to get the actual running service to stop it.
       *
       * @param runtime - Agent runtime
       */
      static async stop(runtime: IAgentRuntime): Promise<void> {
        const service = runtime.getService(
          APPRAISAL_SERVICE_TYPE
        ) as AppraisalService | null;
        if (service) {
          await service.stop();
        }
      }

      /**
       * Instance stop method.
       *
       * WHY EMPTY?
       * Required by Service interface. The actual shutdown logic is in
       * the static stop() above and AppraisalService.stop().
       */
      async stop(): Promise<void> {
        // Instance method for compatibility with Service interface
      }
    },
  ],

  /**
   * Providers inject context into LLM prompts.
   *
   * WHY THESE PROVIDERS?
   *
   * 1. appraisalProvider (APPRAISALS)
   *    The main provider. Injects current appraisal snapshot into LLM
   *    context. This is how the LLM knows the agent's situational awareness.
   *
   * 2. appraisalInstructionsProvider (AppraisalPluginInfo)
   *    Documentation for the LLM about how appraisals work. Helps the
   *    LLM understand what the appraisal data means.
   *
   * 3. appraisalSettingsProvider (AppraisalPluginSettings)
   *    Current plugin status. Shows registered domains, counts, etc.
   *    Useful for debugging and self-awareness.
   *
   * 4. appraisalDebugProvider (APPRAISAL_DEBUG)
   *    Verbose debugging information for developers. Shows health metrics,
   *    staleness, critical domains.
   *
   * WHY ARRAY?
   * elizaOS registers all providers during plugin init. They become
   * available for composeState() calls.
   */
  providers: [
    appraisalProvider,
    appraisalInstructionsProvider,
    appraisalSettingsProvider,
    appraisalDebugProvider,
  ],

  /**
   * Actions available from this plugin.
   *
   * WHY INSPECT_SITUATION?
   * Debugging tool. Allows developers or users to ask the agent
   * "what's your current situation?" and get a detailed snapshot
   * of all appraisals, homeostasis, and motivation state.
   */
  actions: [inspectSituationAction],

  /**
   * HTTP routes for debugging.
   *
   * Available endpoints:
   * - GET /debug/appraisals - All current appraisals
   * - GET /debug/appraisals/health - Health metrics
   * - GET /debug/appraisals/:id - Specific appraisal
   */
  routes: appraisalDebugRoutes,
};

/**
 * Default export for convenient importing.
 *
 * WHY BOTH NAMED AND DEFAULT?
 * - Named export: `import { appraisalPlugin } from '...'`
 * - Default export: `import appraisal from '...'`
 *
 * Accommodates different import preferences.
 */
export default appraisalPlugin;
