/**
 * @fileoverview Plugin Homeostasis - Main plugin definition
 *
 * WHAT THIS PLUGIN DOES
 * =====================
 * Maintains the agent's three-layer internal state:
 *
 * 1. PHYSIOLOGICAL (body simulation): hunger, fatigue, hydration, health
 *    - Scale: 0=satisfied, 100=deprived
 *    - Dynamics: Accumulate over time
 *    - High values = agent needs attention (hungry, tired, etc.)
 *
 * 2. PSYCHOLOGICAL (mind/drives): security, social, status, autonomy, meaning
 *    - Scale: 50=balanced, extremes=tension
 *    - Dynamics: Recover toward baseline
 *    - Extremes = agent is out of balance
 *
 * 3. RESOURCES (external assets): wallets, inference tokens, files, etc.
 *    - Scale: Unbounded
 *    - Dynamics: None by default (just tracks values)
 *
 * This is the agent's "body" - a pure state container that other plugins
 * read from and write to. It does NOT make decisions or interpret state.
 *
 * ARCHITECTURE ROLE
 * =================
 * ```
 * ┌──────────────────────────────────────────────────────┐
 * │                   DECISION LAYER                     │
 * │         (plugin-autonomous, plugin-motivation)       │
 * └──────────────────────────────────────────────────────┘
 *                           ↑ reads
 * ┌──────────────────────────────────────────────────────┐
 * │                   STATE LAYER                        │
 * │              (plugin-homeostasis)  ← YOU ARE HERE    │
 * └──────────────────────────────────────────────────────┘
 *                           ↑ writes
 * ┌──────────────────────────────────────────────────────┐
 * │                   WORLD LAYER                        │
 * │      (plugin-commerce, plugin-neuro, etc.)           │
 * └──────────────────────────────────────────────────────┘
 * ```
 *
 * - World plugins write deltas (events happen → state changes)
 * - Decision plugins read state (what are my needs → what should I do)
 * - Homeostasis just maintains the numbers
 *
 * PHYSIOLOGICAL → PSYCHOLOGICAL COUPLING
 * ======================================
 * When physiological stress is high (average > 70%), psychological
 * recovery rate is halved. This creates "survival mode" where hungry,
 * tired agents naturally focus on immediate needs.
 *
 * CONFIGURATION
 * =============
 * All settings via environment variables or character.settings:
 *
 * GLOBAL:
 * - HOMEOSTASIS_TICK_MODE: 'activity' (default) or 'timer'
 *   - 'activity': Tick when LLM fires or agent replies (efficient, responsive)
 *   - 'timer': Tick on interval (traditional, constant updates)
 * - HOMEOSTASIS_TICK_INTERVAL_MS: Tick frequency in timer mode (default: 60000)
 * - HOMEOSTASIS_ACTIVITY_THROTTLE_MS: Min ms between activity ticks (default: 5000)
 * - HOMEOSTASIS_SATURATION_FACTOR: Diminishing returns (default: 0.3)
 * - HOMEOSTASIS_INITIAL_VARIANCE: Random start variance (default: 5)
 * - HOMEOSTASIS_PHYSIOLOGICAL_STRESS_THRESHOLD: Coupling threshold (default: 0.7)
 *
 * PHYSIOLOGICAL (per variable, e.g., HUNGER):
 * - HOMEOSTASIS_HUNGER_ACCUMULATION_RATE: How fast it builds up (default: 0.02)
 * - HOMEOSTASIS_HUNGER_SATISFACTION_RATE: How fast it decreases (default: 1.0)
 * - HOMEOSTASIS_HUNGER_SENSITIVITY: Delta multiplier (default: 1.0)
 *
 * PSYCHOLOGICAL (per drive, e.g., SECURITY):
 * - HOMEOSTASIS_SECURITY_BASELINE: Target equilibrium (default: 50)
 * - HOMEOSTASIS_SECURITY_RECOVERY_RATE: Recovery speed (default: 0.5)
 * - HOMEOSTASIS_SECURITY_SENSITIVITY: Delta multiplier (default: 1.0)
 * - HOMEOSTASIS_SECURITY_CIRCADIAN_AMPLITUDE: Time-of-day variation (default: 0)
 */

import { type IAgentRuntime, type Plugin, Service } from '@elizaos/core';
import { printBanner } from './banner.ts';
import { HomeostasisEngagementPolicy } from './engagement/homeostasis-policy.ts';
import { feedingEvaluator } from './evaluators/feeding-evaluator.ts';
import { homeostasisProvider } from './providers/homeostasis-provider.ts';
import {
  pluginInfoProvider,
  pluginSettingsProvider,
} from './providers/plugin-info.ts';
import { HomeostasisService } from './services/homeostasis-service.ts';

/**
 * Homeostasis Plugin
 *
 * Maintains agent's three-layer internal state:
 * - Physiological: 4 body variables (0=satisfied, 100=deprived)
 * - Psychological: 5 atomic drives (50=balanced, extremes=tension)
 * - Resources: agent-scoped assets (unbounded)
 *
 * Pure state container - no interpretation, just math.
 * Other plugins write deltas, read values, subscribe to events.
 */
export const homeostasisPlugin: Plugin = {
  name: 'homeostasis',
  description:
    'Internal state manager - maintains physiological, psychological, and resources',

  /**
   * Feature flags this plugin provides.
   *
   * 'has-homeostasis' indicates the agent has internal state management:
   * - Physiological needs (hunger, fatigue, hydration, health)
   * - Psychological drives (security, social, status, autonomy, meaning)
   * - Resources tracking
   */
  /**
   * Initialize the plugin.
   *
   * ## WHY REGISTER WITH AUTONOMOUS
   *
   * plugin-autonomous controls when agents engage with messages.
   * By registering our HomeostasisEngagementPolicy, we let internal state
   * (fatigue, social need, etc.) affect engagement decisions.
   *
   * Example effects:
   * - Tired agent (high fatigue) → less likely to respond
   * - Lonely agent (low social) → more likely to respond
   * - Dead agent → never responds
   *
   * ## WHY SERVICE PROMISE PATTERN
   *
   * We don't know if autonomous is loaded:
   * - If it IS loaded: Promise resolves, we register our policy
   * - If NOT loaded: Promise never resolves, no error, no-op
   *
   * This is BETTER than:
   * - Checking if service exists (race condition with load order)
   * - Try/catch around registration (clutters code)
   * - Hard dependency (breaks if autonomous not installed)
   *
   * ## SEPARATION OF CONCERNS
   *
   * Notice: All homeostasis logic lives HERE in homeostasis-policy.ts.
   * plugin-autonomous just provides the EngagementPolicy interface.
   * This keeps:
   * - autonomous focused on batching/coordination
   * - homeostasis focused on internal state
   * - No circular dependencies
   */
  init: async (
    _config: Record<string, string>,
    runtime: IAgentRuntime
  ): Promise<void> => {
    printBanner({ runtime });

    // ========================================================================
    // REGISTER ENGAGEMENT POLICY WITH AUTONOMOUS
    // ========================================================================
    // WHY CAST: getServicePromise might not exist on all IAgentRuntime implementations
    // (e.g., test mocks). Cast to check safely.
    const runtimeWithPromise = runtime as IAgentRuntime & {
      getServicePromise?: (name: string) => Promise<any>;
    };

    if (runtimeWithPromise.getServicePromise) {
      // WHY .then() NOT await:
      // - Don't block plugin init waiting for autonomous
      // - Autonomous might load after homeostasis
      // - Fire-and-forget registration is fine
      runtimeWithPromise
        .getServicePromise('autonomous')
        .then((autonomous: any) => {
          if (autonomous?.engagementEngine) {
            autonomous.engagementEngine.register(
              new HomeostasisEngagementPolicy()
            );
            runtime.logger.info(
              { src: 'plugin:homeostasis', agentId: runtime.agentId },
              '[HOMEOSTASIS] ✅ Registered engagement policy with autonomous'
            );
          }
        });
      // WHY NO .catch():
      // - If autonomous isn't installed, promise never resolves (not rejects)
      // - No error to catch, just silent no-op
      // - This is intentional - homeostasis works without autonomous
    }
  },

  /**
   * Service factory.
   *
   * WHY A FACTORY CLASS?
   * elizaOS expects services to be classes with static start/stop methods.
   * The factory pattern lets us use our custom HomeostasisService while
   * conforming to the expected interface.
   */
  services: [
    class HomeostasisServiceFactory extends Service {
      static override serviceType = 'homeostasis';
      public readonly capabilityDescription =
        'Manages agent internal drives and resources';

      /**
       * Start the service.
       * Called by elizaOS during agent initialization.
       */
      static async start(runtime: IAgentRuntime): Promise<Service> {
        return await HomeostasisService.start(runtime);
      }

      /**
       * Stop the service.
       * Called by elizaOS during agent shutdown.
       */
      static async stop(runtime: IAgentRuntime): Promise<void> {
        const service = runtime.getService(
          'homeostasis'
        ) as HomeostasisService | null;
        if (service) {
          await service.stop();
        }
      }

      /**
       * Instance stop method (required by Service interface).
       */
      async stop(): Promise<void> {
        // Instance method for compatibility - actual stop is static
      }
    },
  ],

  /**
   * Providers inject context into LLM prompts.
   *
   * The homeostasis provider adds current drives and resources to every
   * message context, so the LLM can naturally incorporate internal state.
   */
  providers: [homeostasisProvider, pluginInfoProvider, pluginSettingsProvider],

  /**
   * Evaluators run after messages are received.
   *
   * The feeding evaluator processes FEEDING_COMMAND messages from
   * plugin-grocery and applies physiological restoration when this
   * agent is in the target list.
   */
  evaluators: [feedingEvaluator],

  /**
   * Component types this plugin uses.
   *
   * WHY REGISTER COMPONENT TYPES?
   * elizaOS needs to know about component schemas for:
   * - Database migrations
   * - Validation
   * - Admin interfaces
   */
  componentTypes: [],

  /**
   * Default configuration values.
   *
   * These are merged with environment variables and character settings.
   * Environment takes precedence.
   *
   * WHY SO MANY SETTINGS?
   * Each drive can be configured independently, allowing:
   * - Per-character tuning (stoic vs neurotic personalities)
   * - Per-deployment tuning (production vs testing)
   * - Runtime adjustment without code changes
   */
  config: {
    // ==========================================================================
    // GLOBAL SETTINGS
    // ==========================================================================

    /**
     * Tick mode: how homeostasis state updates are triggered.
     * - 'timer': Traditional interval-based ticking (every TICK_INTERVAL_MS)
     * - 'activity': Tick on agent activity (LLM use or message sent)
     *
     * Activity mode is more efficient and responsive - state changes are
     * tied to actual agent engagement rather than wall-clock time.
     */
    HOMEOSTASIS_TICK_MODE: process.env.HOMEOSTASIS_TICK_MODE || 'activity',

    /**
     * How often the tick loop runs (milliseconds).
     * Only used in 'timer' mode.
     */
    HOMEOSTASIS_TICK_INTERVAL_MS:
      process.env.HOMEOSTASIS_TICK_INTERVAL_MS || '60000',

    /**
     * Minimum milliseconds between activity-triggered ticks.
     * Only used in 'activity' mode.
     *
     * Prevents excessive ticking during rapid activity bursts
     * (e.g., multiple LLM calls in a single response).
     * Default: 5000 (5 seconds)
     */
    HOMEOSTASIS_ACTIVITY_THROTTLE_MS:
      process.env.HOMEOSTASIS_ACTIVITY_THROTTLE_MS || '5000',

    /**
     * Saturation factor for diminishing returns at extremes.
     * 0 = no saturation (linear response)
     * 1 = full saturation (nearly flat at extremes)
     * Recommended: 0.2-0.4
     */
    HOMEOSTASIS_SATURATION_FACTOR:
      process.env.HOMEOSTASIS_SATURATION_FACTOR || '0.3',

    /**
     * Random variance added to initial values.
     * Creates natural variation between agents with same config.
     */
    HOMEOSTASIS_INITIAL_VARIANCE:
      process.env.HOMEOSTASIS_INITIAL_VARIANCE || '5',

    /**
     * Physiological stress threshold for coupling.
     * When average physiological deprivation exceeds this (0-1),
     * psychological recovery rate is halved ("survival mode").
     */
    HOMEOSTASIS_PHYSIOLOGICAL_STRESS_THRESHOLD:
      process.env.HOMEOSTASIS_PHYSIOLOGICAL_STRESS_THRESHOLD || '0.7',

    // ==========================================================================
    // SURVIVAL SYSTEM
    // ==========================================================================

    /**
     * Distress weights for calculating aggregate distress score.
     * JSON object with keys: hunger, fatigue, health, hydration.
     * Values should sum to 1.0 for intuitive 0-100 distress score.
     * Default: {"hunger":0.35,"fatigue":0.25,"health":0.30,"hydration":0.10}
     */
    HOMEOSTASIS_DISTRESS_WEIGHTS:
      process.env.HOMEOSTASIS_DISTRESS_WEIGHTS ||
      '{"hunger":0.35,"fatigue":0.25,"health":0.30,"hydration":0.10}',

    /**
     * Crisis threshold - distress score at which agent enters crisis state.
     * At crisis, a countdown to death begins. Default: 85.
     */
    HOMEOSTASIS_CRISIS_THRESHOLD:
      process.env.HOMEOSTASIS_CRISIS_THRESHOLD || '85',

    /**
     * Number of ticks agent can spend in crisis before death is imminent.
     * Default: 60 (if tick interval is 60s, this is ~1 hour).
     */
    HOMEOSTASIS_TICKS_UNTIL_DEATH:
      process.env.HOMEOSTASIS_TICKS_UNTIL_DEATH || '60',

    /**
     * Final ticks after DEATH_IMMINENT event before actual death.
     * Gives last chance for intervention. Default: 10.
     */
    HOMEOSTASIS_FINAL_TICKS: process.env.HOMEOSTASIS_FINAL_TICKS || '10',

    /**
     * What happens when agent dies:
     * - 'suspended': Agent hibernates, can be revived (default, safest)
     * - 'graceful': Agent gets one final response, then dies
     * - 'immediate': Agent dies instantly
     */
    HOMEOSTASIS_DEATH_MODE: process.env.HOMEOSTASIS_DEATH_MODE || 'suspended',

    // ==========================================================================
    // HUNGER (Physiological)
    // Craving for input, novelty, engagement
    // ==========================================================================

    /** How fast hunger builds up per tick (0-1). Higher = faster. */
    HOMEOSTASIS_HUNGER_ACCUMULATION_RATE:
      process.env.HOMEOSTASIS_HUNGER_ACCUMULATION_RATE || '0.02',

    /** How fast hunger decreases when satisfied (multiplier on negative deltas). */
    HOMEOSTASIS_HUNGER_SATISFACTION_RATE:
      process.env.HOMEOSTASIS_HUNGER_SATISFACTION_RATE || '1.0',

    /** Delta multiplier. Lower = more stable, higher = more reactive. */
    HOMEOSTASIS_HUNGER_SENSITIVITY:
      process.env.HOMEOSTASIS_HUNGER_SENSITIVITY || '1.0',

    // ==========================================================================
    // FATIGUE (Physiological)
    // Accumulated processing strain, conversation length
    // ==========================================================================

    /** How fast fatigue builds up per tick. Slower than hunger (0.01 default). */
    HOMEOSTASIS_FATIGUE_ACCUMULATION_RATE:
      process.env.HOMEOSTASIS_FATIGUE_ACCUMULATION_RATE || '0.01',
    HOMEOSTASIS_FATIGUE_SATISFACTION_RATE:
      process.env.HOMEOSTASIS_FATIGUE_SATISFACTION_RATE || '1.0',
    HOMEOSTASIS_FATIGUE_SENSITIVITY:
      process.env.HOMEOSTASIS_FATIGUE_SENSITIVITY || '1.0',

    // ==========================================================================
    // HYDRATION (Physiological)
    // Flow state, connection quality, resource access
    // ==========================================================================

    /** How fast hydration builds up per tick. Faster than others (0.03 default). */
    HOMEOSTASIS_HYDRATION_ACCUMULATION_RATE:
      process.env.HOMEOSTASIS_HYDRATION_ACCUMULATION_RATE || '0.03',
    HOMEOSTASIS_HYDRATION_SATISFACTION_RATE:
      process.env.HOMEOSTASIS_HYDRATION_SATISFACTION_RATE || '1.0',
    HOMEOSTASIS_HYDRATION_SENSITIVITY:
      process.env.HOMEOSTASIS_HYDRATION_SENSITIVITY || '1.0',

    // ==========================================================================
    // HEALTH (Physiological)
    // Overall coherence, error rate, system stability
    // ==========================================================================

    /** Health doesn't auto-accumulate (0 default). Only changes from events. */
    HOMEOSTASIS_HEALTH_ACCUMULATION_RATE:
      process.env.HOMEOSTASIS_HEALTH_ACCUMULATION_RATE || '0',
    HOMEOSTASIS_HEALTH_SATISFACTION_RATE:
      process.env.HOMEOSTASIS_HEALTH_SATISFACTION_RATE || '1.0',
    HOMEOSTASIS_HEALTH_SENSITIVITY:
      process.env.HOMEOSTASIS_HEALTH_SENSITIVITY || '1.0',

    // ==========================================================================
    // SECURITY (Psychological)
    // Safety, stability, predictability
    // ==========================================================================

    /** Target equilibrium (0-100 or 'null' for no recovery) */
    HOMEOSTASIS_SECURITY_BASELINE:
      process.env.HOMEOSTASIS_SECURITY_BASELINE || '50',

    /** Recovery rate per tick (0-1). Higher = faster return to baseline. */
    HOMEOSTASIS_SECURITY_RECOVERY_RATE:
      process.env.HOMEOSTASIS_SECURITY_RECOVERY_RATE || '0.5',

    /** Delta multiplier. Lower = "heavy" drive, higher = "volatile" drive. */
    HOMEOSTASIS_SECURITY_SENSITIVITY:
      process.env.HOMEOSTASIS_SECURITY_SENSITIVITY || '1.0',

    /** Circadian amplitude (0 = none). Adds time-of-day variation to baseline. */
    HOMEOSTASIS_SECURITY_CIRCADIAN_AMPLITUDE:
      process.env.HOMEOSTASIS_SECURITY_CIRCADIAN_AMPLITUDE || '0',

    // ==========================================================================
    // SOCIAL (Psychological)
    // Connection, belonging, being known
    // ==========================================================================

    HOMEOSTASIS_SOCIAL_BASELINE:
      process.env.HOMEOSTASIS_SOCIAL_BASELINE || '50',
    HOMEOSTASIS_SOCIAL_RECOVERY_RATE:
      process.env.HOMEOSTASIS_SOCIAL_RECOVERY_RATE || '0.5',
    HOMEOSTASIS_SOCIAL_SENSITIVITY:
      process.env.HOMEOSTASIS_SOCIAL_SENSITIVITY || '1.0',
    HOMEOSTASIS_SOCIAL_CIRCADIAN_AMPLITUDE:
      process.env.HOMEOSTASIS_SOCIAL_CIRCADIAN_AMPLITUDE || '0',

    // ==========================================================================
    // STATUS (Psychological)
    // Recognition, respect, competence
    // ==========================================================================

    HOMEOSTASIS_STATUS_BASELINE:
      process.env.HOMEOSTASIS_STATUS_BASELINE || '50',
    HOMEOSTASIS_STATUS_RECOVERY_RATE:
      process.env.HOMEOSTASIS_STATUS_RECOVERY_RATE || '0.5',
    HOMEOSTASIS_STATUS_SENSITIVITY:
      process.env.HOMEOSTASIS_STATUS_SENSITIVITY || '1.0',
    HOMEOSTASIS_STATUS_CIRCADIAN_AMPLITUDE:
      process.env.HOMEOSTASIS_STATUS_CIRCADIAN_AMPLITUDE || '0',

    // ==========================================================================
    // AUTONOMY (Psychological)
    // Agency, choice, self-direction
    // ==========================================================================

    HOMEOSTASIS_AUTONOMY_BASELINE:
      process.env.HOMEOSTASIS_AUTONOMY_BASELINE || '50',
    HOMEOSTASIS_AUTONOMY_RECOVERY_RATE:
      process.env.HOMEOSTASIS_AUTONOMY_RECOVERY_RATE || '0.5',
    HOMEOSTASIS_AUTONOMY_SENSITIVITY:
      process.env.HOMEOSTASIS_AUTONOMY_SENSITIVITY || '1.0',
    HOMEOSTASIS_AUTONOMY_CIRCADIAN_AMPLITUDE:
      process.env.HOMEOSTASIS_AUTONOMY_CIRCADIAN_AMPLITUDE || '0',

    // ==========================================================================
    // MEANING (Psychological)
    // Purpose, contribution, significance
    // ==========================================================================

    HOMEOSTASIS_MEANING_BASELINE:
      process.env.HOMEOSTASIS_MEANING_BASELINE || '50',
    HOMEOSTASIS_MEANING_RECOVERY_RATE:
      process.env.HOMEOSTASIS_MEANING_RECOVERY_RATE || '0.5',
    HOMEOSTASIS_MEANING_SENSITIVITY:
      process.env.HOMEOSTASIS_MEANING_SENSITIVITY || '1.0',
    HOMEOSTASIS_MEANING_CIRCADIAN_AMPLITUDE:
      process.env.HOMEOSTASIS_MEANING_CIRCADIAN_AMPLITUDE || '0',
  },
};

export default homeostasisPlugin;
