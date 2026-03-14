/**
 * @fileoverview Plugin Motivation - Main plugin definition
 *
 * WHY THIS PLUGIN?
 * ----------------
 * elizaOS agents have internal state (drives, physiological needs, resources)
 * managed by plugin-homeostasis. But raw numbers don't tell a story. This
 * plugin interprets that state into motivation:
 *
 * - "What matters most right now?" → Priorities
 * - "What limits acceptable action?" → Constraints
 * - "What possibilities exist?" → Opportunities
 *
 * ARCHITECTURE
 * ============
 *
 * The interpretation pipeline:
 *
 * ```
 * Homeostasis State (drives, physiological, resources)
 *        ↓
 * Signals (categorical buckets: low, balanced, high, etc.)
 *        ↓
 * Patterns (meaningful combinations: "survival_mode", "seeking_connection")
 *        ↓
 * Frame Filter (worldview shapes what surfaces: Maslow, Power, Notoriety)
 *        ↓
 * Output (priorities, constraints, opportunities, narrative)
 * ```
 *
 * KEY DESIGN PRINCIPLES
 * =====================
 *
 * 1. RECOGNIZE, DON'T CALCULATE
 *    We use pattern matching, not mathematical formulas. Patterns are
 *    interpretable and debuggable; formulas are opaque.
 *
 * 2. FILTER, DON'T WEIGHT
 *    Frames decide what surfaces, not weighted scores. The Maslow frame
 *    suppresses growth needs when foundation is shaky — it doesn't give
 *    them a 0.3x multiplier.
 *
 * 3. EXPRESS, DON'T PRESCRIBE
 *    Our output is orientation ("restore security"), not commands
 *    ("call API X with params Y"). The LLM and other plugins decide
 *    what to actually do.
 *
 * 4. GUIDE RAILS, NOT ALGORITHMS
 *    Frames provide structure for the LLM, not replacement logic.
 *    The narrative colors interpretation; it doesn't compute decisions.
 *
 * WHAT WE OWN
 * ===========
 * - The interpretation pipeline (state → signals → patterns → output)
 * - Frame definitions and frame selection logic
 * - Event emission for motivation changes
 *
 * WHAT WE DON'T OWN
 * =================
 * - Raw state (plugin-homeostasis owns this)
 * - Action execution (plugin-autonomous owns this)
 * - Goal management (plugin-goals owns this)
 * - Decision making (the LLM owns this)
 *
 * CONFIGURATION
 * =============
 *
 * | Setting                        | Default  | Description |
 * |--------------------------------|----------|-------------|
 * | MOTIVATION_DEFAULT_FRAME       | 'maslow' | Default interpretation frame |
 * | MOTIVATION_SURVIVAL_THRESHOLD  | 75       | Physiological level to force survival frame |
 * | MOTIVATION_UPDATE_THROTTLE_MS  | 1000     | Min ms between recalculations |
 */

import {
  type IAgentRuntime,
  logger,
  type Plugin,
  Service,
} from '@elizaos/core';
import { printBanner } from './banner.ts';
import { Defaults, MotivationEvents } from './constants.ts';
import { motivationProvider } from './providers/motivation-provider.ts';
import {
  pluginInfoProvider,
  pluginSettingsProvider,
} from './providers/plugin-info.ts';
import { motivationDebugRoutes } from './routes/debug-routes.ts';
import { MotivationService } from './services/motivation-service.ts';

/**
 * Motivation Plugin
 *
 * Interprets homeostasis state into priorities, constraints, and opportunities.
 * Uses frames (Maslow, Power, Notoriety) to shape interpretation.
 */
export const motivationPlugin: Plugin = {
  name: 'motivation',
  description:
    'Motivation interpreter - transforms drives/resources into prioritized needs',

  /**
   * Dependencies.
   *
   * WHY DEPEND ON HOMEOSTASIS?
   * We need homeostasis because:
   * 1. It provides the raw state we interpret
   * 2. We subscribe to its events to know when to recalculate
   * 3. We can't function without it (we'd have nothing to interpret)
   *
   * WHY NO GOALS DEPENDENCY?
   * Motivation INTERPRETS state, it doesn't CREATE goals. We emit
   * MOTIVATION_GOAL_CANDIDATE events for interested parties (like
   * plugin-autonomous) to act on. This maintains clean separation:
   *
   * - Motivation = "what matters" (interpretation)
   * - Autonomous = "what to do" (decision)
   * - Goals = "track progress" (persistence)
   */
  dependencies: ['@elizaos/plugin-homeostasis'],

  /**
   * Initialize the plugin.
   *
   * WHY LOG CONFIGURATION?
   * Configuration affects behavior. Logging it on startup helps debugging
   * when motivation seems wrong ("oh, it's using power frame, not maslow").
   */
  init: async (
    _config: Record<string, string>,
    runtime: IAgentRuntime
  ): Promise<void> => {
    // Log configuration
    const defaultFrame =
      runtime.getSetting('MOTIVATION_DEFAULT_FRAME') || Defaults.DEFAULT_FRAME;
    const throttleMs =
      runtime.getSetting('MOTIVATION_UPDATE_THROTTLE_MS') ||
      Defaults.UPDATE_THROTTLE_MS;
    const survivalThreshold =
      runtime.getSetting('MOTIVATION_SURVIVAL_THRESHOLD') ||
      Defaults.SURVIVAL_THRESHOLD;

    printBanner({
      runtime,
      settings: [
        {
          name: 'MOTIVATION_DEFAULT_FRAME',
          value: defaultFrame,
          defaultValue: 'maslow',
        },
        {
          name: 'MOTIVATION_SURVIVAL_THRESHOLD',
          value: survivalThreshold,
          defaultValue: 75,
        },
        {
          name: 'MOTIVATION_UPDATE_THROTTLE_MS',
          value: throttleMs,
          defaultValue: 1000,
        },
      ],
    });

    logger.info('[MOTIVATION] Initializing motivation plugin');
  },

  /**
   * Service factory.
   *
   * WHY A FACTORY CLASS?
   * elizaOS services use a factory pattern where:
   * - The class has a static `start` method that creates instances
   * - The runtime calls `start` during plugin initialization
   * - This allows for async initialization and dependency injection
   */
  services: [
    class MotivationServiceFactory extends Service {
      static override serviceType = 'motivation';
      public readonly capabilityDescription =
        'Interprets agent drives into motivation and priorities';

      /**
       * Start the service.
       * Called by the runtime during plugin initialization.
       */
      static async start(runtime: IAgentRuntime): Promise<Service> {
        return await MotivationService.start(runtime);
      }

      /**
       * Stop the service.
       * Called by the runtime during shutdown.
       */
      static async stop(runtime: IAgentRuntime): Promise<void> {
        const service = runtime.getService(
          'motivation'
        ) as MotivationService | null;
        if (service) {
          await service.stop();
        }
      }

      async stop(): Promise<void> {
        // Instance method for compatibility
      }
    },
  ],

  /**
   * Providers inject context into LLM prompts.
   *
   * WHY A PROVIDER?
   * The LLM needs to know the agent's motivation to generate appropriate
   * responses. The provider formats our state into readable prompt context.
   */
  providers: [motivationProvider, pluginInfoProvider, pluginSettingsProvider],

  /**
   * Default configuration values.
   *
   * WHY IN CONFIG?
   * These can be overridden by environment variables or runtime settings.
   * Providing defaults here means the plugin works out-of-box.
   */
  config: {
    // Default interpretation frame
    // WHY MASLOW? It's the most general-purpose frame that doesn't assume
    // anything about the agent's personality.
    MOTIVATION_DEFAULT_FRAME:
      process.env.MOTIVATION_DEFAULT_FRAME || Defaults.DEFAULT_FRAME,

    // Physiological level that forces survival frame (0-100)
    // WHY 75? This is where physiological stress becomes critical.
    // Below this, higher frames can still function.
    MOTIVATION_SURVIVAL_THRESHOLD:
      process.env.MOTIVATION_SURVIVAL_THRESHOLD ||
      String(Defaults.SURVIVAL_THRESHOLD),

    // Minimum milliseconds between recalculations
    // WHY 1000? Motivation doesn't change that fast. More frequent updates
    // waste CPU without providing meaningful information.
    MOTIVATION_UPDATE_THROTTLE_MS:
      process.env.MOTIVATION_UPDATE_THROTTLE_MS ||
      String(Defaults.UPDATE_THROTTLE_MS),
  },

  /**
   * HTTP routes for debugging.
   *
   * Available endpoints:
   * - GET /debug/motivation - Full motivation state
   * - GET /debug/motivation/priorities - Current priorities
   * - GET /debug/motivation/signals - Current signals
   * - GET /debug/motivation/patterns - Active patterns
   * - GET /debug/motivation/full - Complete snapshot
   */
  routes: motivationDebugRoutes,
};

export default motivationPlugin;
