/**
 * @fileoverview HomeostasisService - Core state manager for agent internal state
 *
 * WHAT THIS SERVICE DOES
 * =======================
 * Maintains the agent's three-layer internal state:
 *
 * 1. PHYSIOLOGICAL (body simulation): hunger, fatigue, hydration, health
 *    - Scale: 0 = satisfied (good), 100 = deprived (critical)
 *    - Dynamics: ACCUMULATE over time (needs build up)
 *    - When high: constrain psychological functioning (survival mode)
 *
 * 2. PSYCHOLOGICAL (mind/drives): security, social, status, autonomy, meaning
 *    - Scale: 50 = balanced (good), 0 or 100 = extreme (tension)
 *    - Dynamics: EQUILIBRIUM-seeking (recover toward baseline)
 *
 * 3. RESOURCES (external assets): wallets, inference tokens, etc.
 *    - Scale: Unbounded (can be any number)
 *    - Dynamics: None by default (just tracks values)
 *
 * WHAT THIS SERVICE DOES NOT DO
 * =============================
 * - Interpret what values mean (that's plugin-motivation)
 * - Make decisions or choose actions (that's plugin-autonomous)
 * - Learn or adapt over time (that's plugin-neuro)
 * - Understand social context (that's plugin-rolodex)
 *
 * KEY DESIGN PRINCIPLE: Pure State
 * =================================
 * This service is intentionally "dumb". It holds numbers and applies math.
 * The intelligence comes from other plugins that read this state and decide
 * what it means. This separation keeps the architecture clean and testable.
 *
 * THE TICK LOOP
 * =============
 * Every N seconds (configurable), the service:
 * 1. Applies queued deltas from external plugins
 * 2. Applies physiological accumulation (needs build up)
 * 3. Applies psychological recovery toward baseline (with coupling)
 * 4. Clamps values to valid ranges
 * 5. Emits events for any changes
 * 6. Persists state to survive restarts
 *
 * PHYSIOLOGICAL → PSYCHOLOGICAL COUPLING
 * ======================================
 * When physiological stress is high (average > 70%), psychological
 * recovery rate is halved. This creates emergent "survival mode":
 * a hungry, tired agent naturally focuses on immediate needs rather
 * than higher-level drives like meaning or status.
 *
 * This creates a living, breathing internal state that changes over time
 * even when the agent isn't actively engaged.
 */

import {
  type EventPayload,
  EventType,
  type IAgentRuntime,
  Service,
  type UUID,
} from '@elizaos/core';
import type {
  AgentLegacy,
  CouplingRule,
  DeathMode,
  DeltaMetadata,
  DistressBracket,
  DistressWeights,
  DomainBody,
  DomainPhysiological,
  DriveConfig,
  DriveId,
  Drives,
  HomeostasisState,
  LifecycleState,
  LifecycleStatus,
  Physiological,
  PhysiologicalConfig,
  PhysiologicalId,
  QueuedDelta,
  ResourceConfig,
  Resources,
  // Domain body types
  WorldContext,
} from '../types.ts';
import {
  DEFAULT_DISTRESS_WEIGHTS,
  DRIVE_IDS,
  DriveThresholds,
  HomeostasisEvents,
  PHYSIOLOGICAL_IDS,
  PhysiologicalThresholds,
} from '../types.ts';

/**
 * HomeostasisService
 *
 * Maintains agent's internal drives and external resources.
 * Pure state container - no interpretation, just math.
 *
 * USAGE:
 * ```typescript
 * const service = runtime.getService('homeostasis') as HomeostasisService;
 *
 * // Read current state
 * const drives = service.getDrives();
 * const security = service.getDrive('security');
 *
 * // Write changes (applied at next tick)
 * service.proposeDriveDelta({ security: -10 }, { source: 'neuro', reason: 'task_failure' });
 * service.reportResourceDelta({ money: +50 }, { source: 'commerce' });
 * ```
 */
export class HomeostasisService extends Service {
  // Service identification for elizaOS service registry
  static override serviceType = 'homeostasis';
  public readonly capabilityDescription =
    'Manages agent internal drives and resources';

  // ===========================================================================
  // STATE
  // ===========================================================================

  /** Current internal state (physiological + drives + resources + timestamps) */
  private state: HomeostasisState;

  /** Per-physiological-variable configuration loaded from settings */
  private physiologicalConfigs: Record<PhysiologicalId, PhysiologicalConfig>;

  /** Per-drive configuration loaded from settings */
  private driveConfigs: Record<DriveId, DriveConfig>;

  /** Reference to the tick loop timer (so we can stop it) */
  private tickTimer: NodeJS.Timeout | null = null;

  /** How often the tick loop runs (milliseconds) - only used in 'timer' mode */
  private tickIntervalMs: number;

  /**
   * Tick mode: 'timer' or 'activity'
   *
   * 'timer': Traditional interval-based ticking (default)
   * 'activity': Tick when agent is active (on LLM use or message sent)
   *
   * WHY ACTIVITY MODE?
   * Timer-based ticking runs constantly even when the agent is idle.
   * Activity-based ticking only updates state when there's actual
   * engagement, making state changes responsive to agent activity.
   */
  private tickMode: 'timer' | 'activity';

  /**
   * Minimum milliseconds between activity ticks.
   *
   * Prevents excessive ticking during rapid activity bursts.
   * Only applies in 'activity' mode.
   */
  private activityThrottleMs: number;

  /** Timestamp of last activity tick (for throttling) */
  private lastActivityTickAt: number = 0;

  /**
   * Saturation factor for diminishing returns at extremes.
   *
   * WHY SATURATION?
   * Real systems have diminishing returns. It's hard to push security
   * from 95 to 100 (you're already very secure) but easy to push from
   * 50 to 55. This creates more natural, stable dynamics.
   */
  private saturationFactor: number;

  /**
   * Random variance applied to initial drive values.
   *
   * WHY VARIANCE?
   * Agents shouldn't all start in identical states. A small random
   * offset creates natural variety - one agent might start slightly
   * more secure, another slightly more social.
   */
  private initialVariance: number;

  /**
   * Threshold for physiological stress coupling.
   *
   * WHY COUPLING?
   * Maslow's insight: You can't pursue self-actualization while starving.
   * When average physiological deprivation exceeds this threshold (0-1),
   * psychological recovery rate is halved, creating "survival mode".
   */
  private physiologicalStressThreshold: number;

  // ===========================================================================
  // DELTA QUEUES
  // ===========================================================================

  /**
   * Deltas waiting to be applied at next tick.
   *
   * WHY QUEUE INSTEAD OF IMMEDIATE APPLICATION?
   * - Prevents race conditions when multiple plugins update simultaneously
   * - Ensures atomic application (all changes from one tick apply together)
   * - Allows batching for efficiency
   * - Makes event emission cleaner (one event per tick, not per delta)
   */
  private physiologicalDeltaQueue: QueuedDelta[] = [];
  private driveDeltaQueue: QueuedDelta[] = [];
  private resourceDeltaQueue: QueuedDelta[] = [];

  /**
   * Previous values for change detection and threshold events.
   *
   * WHY TRACK PREVIOUS VALUES?
   * - To detect if values actually changed (skip events if no change)
   * - To detect threshold crossings (was above 40, now below)
   * - To include in events for downstream plugins
   */
  private previousPhysiological: Physiological;
  private previousDrives: Drives;

  // ===========================================================================
  // SURVIVAL SYSTEM PROPERTIES
  // ===========================================================================

  /**
   * Distress weights for calculating aggregate distress score.
   * Loaded from settings or defaults.
   */
  private distressWeights: DistressWeights;

  /**
   * Crisis threshold - distress score at which agent enters crisis.
   * Default: 85
   */
  private crisisThreshold: number;

  /**
   * Ticks agent can be in crisis before death is imminent.
   * Default: 60
   */
  private ticksUntilDeath: number;

  /**
   * Final ticks after DEATH_IMMINENT before actual death.
   * Default: 10
   */
  private finalTicks: number;

  /**
   * What happens when agent dies: graceful, immediate, or suspended.
   * Default: 'suspended'
   */
  private deathMode: DeathMode;

  /**
   * Previous distress score for change detection.
   */
  private previousDistressScore: number = 0;

  // ===========================================================================
  // DOMAIN BODY REGISTRY
  // ===========================================================================
  //
  // WHY DOMAIN BODIES?
  // ==================
  // Agents operate in multiple contexts: chat, games, robots, etc.
  // Each context has its own "body" - the physical/virtual state that
  // affects decision-making. Rather than mixing all contexts together
  // (which would cause confusion), we use context-bound domain bodies:
  //
  // - Only ONE body is active at a time (determined by world context)
  // - Each body provides its own physiological state + resources
  // - Bodies affect psychological drives via coupling rules
  // - Default body (simulated hunger/fatigue) is used when no domain matches
  //
  // This architecture enables:
  // - Clean separation: Hyperscape health doesn't affect Discord decisions
  // - Progressive enhancement: Domain plugins register optionally
  // - Unified psychology: All bodies feed into the same drive system
  // - Emotional residue: Psychological state persists across context switches
  //
  // ===========================================================================

  /**
   * Registry of domain bodies.
   *
   * WHY A MAP?
   * Fast O(1) lookup by domain name. Multiple domains can be registered
   * but only one is active at a time based on current world context.
   *
   * Domain plugins (like Hyperscape) register their bodies here.
   */
  private domainBodies = new Map<string, DomainBody>();

  /**
   * Current world context.
   *
   * WHY DEFAULT TO 'default'?
   * When the agent starts, it's not in any game or domain - it's in the
   * "real world" (chat, Discord, etc.). The default body (simulated
   * hunger/fatigue) handles this case.
   *
   * Domain plugins call setWorldContext() when connecting/disconnecting.
   * When a domain disconnects, context falls back to 'default'.
   */
  private currentWorldContext: WorldContext = 'default';

  /**
   * Cooldown tracking for coupling rules.
   *
   * WHY TRACK COOLDOWNS?
   * Coupling rules fire when conditions are met (e.g., health < 30).
   * Without cooldowns, flickering conditions would spam drive changes.
   * Cooldowns ensure each rule fires once, then waits before firing again.
   *
   * WHY NOT PERSIST COOLDOWNS?
   * Cooldowns are transient - if the agent restarts, it's fine for rules
   * to fire again. Persisting would add complexity without benefit.
   */
  private couplingCooldowns = new Map<string, number>();

  // ===========================================================================
  // CONSTRUCTOR
  // ===========================================================================

  constructor(runtime: IAgentRuntime, initialState?: HomeostasisState) {
    super(runtime);

    // Load configuration from runtime settings
    // WHY RUNTIME SETTINGS?
    // Allows configuration via environment variables, character settings,
    // or any other source that feeds into runtime.getSetting()
    this.tickIntervalMs = this.getSetting(
      'HOMEOSTASIS_TICK_INTERVAL_MS',
      60000
    );
    this.tickMode = this.getSetting('HOMEOSTASIS_TICK_MODE', 'activity') as
      | 'timer'
      | 'activity';
    this.activityThrottleMs = this.getSetting(
      'HOMEOSTASIS_ACTIVITY_THROTTLE_MS',
      5000
    );
    this.saturationFactor = this.getSetting(
      'HOMEOSTASIS_SATURATION_FACTOR',
      0.3
    );
    this.initialVariance = this.getSetting('HOMEOSTASIS_INITIAL_VARIANCE', 5);
    this.physiologicalStressThreshold = this.getSetting(
      'HOMEOSTASIS_PHYSIOLOGICAL_STRESS_THRESHOLD',
      0.7
    );

    // Load survival system configuration
    this.distressWeights = this.loadDistressWeights();
    this.crisisThreshold = this.getSetting('HOMEOSTASIS_CRISIS_THRESHOLD', 85);
    this.ticksUntilDeath = this.getSetting('HOMEOSTASIS_TICKS_UNTIL_DEATH', 60);
    this.finalTicks = this.getSetting('HOMEOSTASIS_FINAL_TICKS', 10);
    this.deathMode = this.getSetting(
      'HOMEOSTASIS_DEATH_MODE',
      'suspended'
    ) as DeathMode;

    // Load per-variable configurations
    this.physiologicalConfigs = this.loadPhysiologicalConfigs();
    this.driveConfigs = this.loadDriveConfigs();

    // Initialize or restore state
    // WHY ACCEPT INITIAL STATE?
    // On restart, we load persisted state. On first run, we create fresh state.
    this.state = initialState || this.createInitialState();

    // Handle legacy state without physiological (backward compatibility)
    if (!this.state.physiological) {
      this.state.physiological = this.createInitialPhysiological();
    }

    // Handle legacy state without lifecycle (backward compatibility)
    if (!this.state.lifecycle) {
      this.state.lifecycle = this.createInitialLifecycle();
    }

    this.previousPhysiological = { ...this.state.physiological };
    this.previousDrives = { ...this.state.drives };
    this.previousDistressScore = this.getDistressScore();
  }

  getState(): HomeostasisState {
    return structuredClone(this.state);
  }

  private emitCustomEvent(
    event: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    return this.runtime.emitEvent(event, {
      runtime: this.runtime,
      source: 'homeostasis',
      ...payload,
    } as EventPayload);
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Start the service.
   *
   * Called by elizaOS when the agent initializes. This:
   * 1. Loads any persisted state from previous runs
   * 2. Applies catch-up recovery if agent was offline
   * 3. Starts the tick loop
   */
  static async start(runtime: IAgentRuntime): Promise<HomeostasisService> {
    runtime.logger.info(
      { src: 'plugin:homeostasis', agentId: runtime.agentId },
      'Starting Homeostasis service'
    );

    // Try to load persisted state from component storage
    // WHY COMPONENTS?
    // elizaOS components are the standard way to persist plugin state
    // They're stored in the database and survive restarts
    const persisted = await runtime.getComponent(
      runtime.agentId,
      'homeostasis_state'
    );
    const initialState = persisted?.data as HomeostasisState | undefined;

    const service = new HomeostasisService(runtime, initialState);

    // OFFLINE CATCH-UP
    // If we have persisted state and it's stale, apply dynamics for missed time
    // WHY CATCH-UP?
    // If agent was offline for 10 hours, physiological needs should have built up
    // and drives should have recovered toward baseline. We simulate the missed
    // ticks so state isn't "frozen" at the moment of shutdown.
    if (initialState) {
      const elapsedMs = Date.now() - initialState.lastTickAt;
      if (elapsedMs > service.tickIntervalMs) {
        const missedTicks = Math.floor(elapsedMs / service.tickIntervalMs);
        runtime.logger.info(
          {
            src: 'plugin:homeostasis',
            agentId: runtime.agentId,
            missedTicks,
            elapsedMs,
          },
          'Catching up on missed ticks'
        );

        // Apply catch-up (capped at 100 ticks to prevent excessive processing)
        // WHY CAP AT 100?
        // Beyond ~100 ticks, values have essentially converged anyway.
        // Capping prevents CPU spikes on long-offline agents.
        for (let i = 0; i < Math.min(missedTicks, 100); i++) {
          service.applyPhysiologicalAccumulation();
          service.applyRecovery();
        }

        service.state.lastTickAt = Date.now();
        await service.persistState();
      }
    }

    // Start ticking based on mode
    if (service.tickMode === 'timer') {
      service.startTickLoop();
    } else {
      service.startActivityListeners();
    }

    runtime.logger.success(
      {
        src: 'plugin:homeostasis',
        agentId: runtime.agentId,
        tickMode: service.tickMode,
      },
      'Homeostasis service started'
    );
    return service;
  }

  /**
   * Stop the service gracefully.
   *
   * Called when the agent shuts down. Persists final state so it can be
   * restored on next startup.
   */
  async stop(): Promise<void> {
    this.runtime.logger.info(
      { src: 'plugin:homeostasis', agentId: this.runtime.agentId },
      'Stopping Homeostasis service'
    );

    // Stop the tick loop
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    // Persist final state
    await this.persistState();
    this.runtime.logger.success(
      { src: 'plugin:homeostasis', agentId: this.runtime.agentId },
      'Homeostasis service stopped'
    );
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Create initial state for a fresh agent.
   *
   * Physiological starts at 0 (satisfied) with optional variance.
   * Drives start at baseline (with optional variance).
   * Resources start empty (other plugins will populate them).
   * Lifecycle starts as 'alive'.
   */
  private createInitialState(): HomeostasisState {
    return {
      physiological: this.createInitialPhysiological(),
      drives: this.createInitialDrives(),
      resources: {},
      lifecycle: this.createInitialLifecycle(),
      lastTickAt: Date.now(),
      createdAt: Date.now(),
    };
  }

  /**
   * Create initial lifecycle state.
   */
  private createInitialLifecycle(): LifecycleState {
    return {
      status: 'alive',
      ticksInCrisis: 0,
    };
  }

  /**
   * Create initial physiological state.
   *
   * All physiological variables start at 0 (fully satisfied) with optional variance.
   *
   * WHY START AT 0?
   * For physiological, 0 = satisfied and 100 = deprived.
   * Starting agents fully satisfied gives them time to establish
   * themselves before physiological needs start affecting behavior.
   */
  private createInitialPhysiological(): Physiological {
    return {
      hunger: this.randomizePhysiological('hunger'),
      fatigue: this.randomizePhysiological('fatigue'),
      hydration: this.randomizePhysiological('hydration'),
      health: this.randomizePhysiological('health'),
    };
  }

  /**
   * Create initial drive state.
   */
  private createInitialDrives(): Drives {
    return {
      security: this.randomizeDriveBaseline('security'),
      social: this.randomizeDriveBaseline('social'),
      status: this.randomizeDriveBaseline('status'),
      autonomy: this.randomizeDriveBaseline('autonomy'),
      meaning: this.randomizeDriveBaseline('meaning'),
    };
  }

  /**
   * Add random variance to physiological starting value.
   *
   * Physiological starts near 0 (satisfied) with small variance.
   * Uses smaller variance than drives since 0-20 is the "good" range.
   */
  private randomizePhysiological(id: PhysiologicalId): number {
    // Start near 0 (satisfied) with small variance
    const variance = Math.random() * this.initialVariance;
    return this.clamp(variance, 0, 100);
  }

  /**
   * Add random variance to drive baseline for natural variation.
   *
   * WHY VARIANCE?
   * Even agents with identical configuration shouldn't start identically.
   * A small random offset (e.g., ±5) creates natural variety without
   * significantly changing behavior.
   */
  private randomizeDriveBaseline(driveId: DriveId): number {
    const config = this.driveConfigs[driveId];
    const baseValue = config.baseline === null ? 50 : config.baseline;

    // Random value between -variance and +variance
    const variance = (Math.random() - 0.5) * 2 * this.initialVariance;
    return this.clamp(baseValue + variance, 0, 100);
  }

  /**
   * Load physiological configurations from runtime settings.
   *
   * Each variable can be configured independently via settings like:
   * - HOMEOSTASIS_HUNGER_ACCUMULATION_RATE = 0.02
   * - HOMEOSTASIS_HUNGER_SATISFACTION_RATE = 1.0
   * - HOMEOSTASIS_HUNGER_SENSITIVITY = 1.0
   *
   * DEFAULT VALUES:
   * - hunger: accumulates moderately (0.02)
   * - fatigue: accumulates slowly (0.01)
   * - hydration: accumulates quickly (0.03)
   * - health: doesn't auto-accumulate (0), only affected by events
   */
  private loadPhysiologicalConfigs(): Record<
    PhysiologicalId,
    PhysiologicalConfig
  > {
    const defaults: Record<PhysiologicalId, PhysiologicalConfig> = {
      hunger: {
        accumulationRate: 0.02,
        satisfactionRate: 1.0,
        sensitivity: 1.0,
      },
      fatigue: {
        accumulationRate: 0.01,
        satisfactionRate: 1.0,
        sensitivity: 1.0,
      },
      hydration: {
        accumulationRate: 0.03,
        satisfactionRate: 1.0,
        sensitivity: 1.0,
      },
      health: { accumulationRate: 0, satisfactionRate: 1.0, sensitivity: 1.0 },
    };

    const configs: Partial<Record<PhysiologicalId, PhysiologicalConfig>> = {};

    for (const id of PHYSIOLOGICAL_IDS) {
      const prefix = `HOMEOSTASIS_${id.toUpperCase()}`;
      configs[id] = {
        accumulationRate: this.getSetting(
          `${prefix}_ACCUMULATION_RATE`,
          defaults[id].accumulationRate
        ),
        satisfactionRate: this.getSetting(
          `${prefix}_SATISFACTION_RATE`,
          defaults[id].satisfactionRate
        ),
        sensitivity: this.getSetting(
          `${prefix}_SENSITIVITY`,
          defaults[id].sensitivity
        ),
      };
    }

    return configs as Record<PhysiologicalId, PhysiologicalConfig>;
  }

  /**
   * Load drive configurations from runtime settings.
   *
   * Each drive can be configured independently via settings like:
   * - HOMEOSTASIS_SECURITY_BASELINE = 50
   * - HOMEOSTASIS_SECURITY_RECOVERY_RATE = 0.5
   * - HOMEOSTASIS_SECURITY_SENSITIVITY = 1.0
   * - HOMEOSTASIS_SECURITY_CIRCADIAN_AMPLITUDE = 0
   */
  private loadDriveConfigs(): Record<DriveId, DriveConfig> {
    const configs: Partial<Record<DriveId, DriveConfig>> = {};

    for (const driveId of DRIVE_IDS) {
      const prefix = `HOMEOSTASIS_${driveId.toUpperCase()}`;
      const baselineRaw = this.getSetting(`${prefix}_BASELINE`, 50);

      // Handle 'null' string (from env vars) as actual null
      const baselineValue =
        baselineRaw === 'null' || baselineRaw === null
          ? null
          : Number(baselineRaw);

      configs[driveId] = {
        baseline: baselineValue,
        recoveryRate: this.getSetting(`${prefix}_RECOVERY_RATE`, 0.5),
        sensitivity: this.getSetting(`${prefix}_SENSITIVITY`, 1.0),
        circadianAmplitude: this.getSetting(`${prefix}_CIRCADIAN_AMPLITUDE`, 0),
      };
    }

    return configs as Record<DriveId, DriveConfig>;
  }

  /**
   * Load distress weights from settings.
   *
   * Can be configured via HOMEOSTASIS_DISTRESS_WEIGHTS as JSON string:
   * '{"hunger":0.4,"fatigue":0.2,"health":0.3,"hydration":0.1}'
   */
  private loadDistressWeights(): DistressWeights {
    const weightsStr = this.runtime.getSetting('HOMEOSTASIS_DISTRESS_WEIGHTS');
    if (weightsStr && typeof weightsStr === 'string') {
      try {
        const parsed = JSON.parse(weightsStr);
        return {
          hunger: parsed.hunger ?? DEFAULT_DISTRESS_WEIGHTS.hunger,
          fatigue: parsed.fatigue ?? DEFAULT_DISTRESS_WEIGHTS.fatigue,
          health: parsed.health ?? DEFAULT_DISTRESS_WEIGHTS.health,
          hydration: parsed.hydration ?? DEFAULT_DISTRESS_WEIGHTS.hydration,
        };
      } catch (e) {
        this.runtime.logger.warn(
          { src: 'plugin:homeostasis', error: e },
          'Failed to parse HOMEOSTASIS_DISTRESS_WEIGHTS, using defaults'
        );
      }
    }
    return { ...DEFAULT_DISTRESS_WEIGHTS };
  }

  /**
   * Helper to get setting with default.
   *
   * Handles type coercion (string -> number/boolean) based on default type.
   */
  private getSetting(key: string, defaultValue: any): any {
    const value = this.runtime.getSetting(key);
    if (value === null || value === undefined) return defaultValue;
    if (value === 'null') return 'null'; // Special case for null baseline
    if (typeof defaultValue === 'number') return Number(value);
    if (typeof defaultValue === 'boolean') return Boolean(value);
    return value;
  }

  // ===========================================================================
  // TICK LOOP
  // ===========================================================================

  /**
   * Start the tick loop (timer mode).
   *
   * The tick loop is the heartbeat of homeostasis. Every N seconds:
   * 1. Apply queued deltas
   * 2. Apply recovery dynamics
   * 3. Emit events
   * 4. Persist state
   *
   * WHY A LOOP?
   * Drives should change over time even when the agent isn't active.
   * Recovery toward baseline creates organic, living-feeling state.
   *
   * NOTE: Only used when tickMode = 'timer'. Activity mode uses event listeners.
   */
  private startTickLoop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
    }

    this.tickTimer = setInterval(async () => {
      await this.tick();
    }, this.tickIntervalMs) as unknown as NodeJS.Timeout;

    this.runtime.logger.debug(
      {
        src: 'plugin:homeostasis',
        agentId: this.runtime.agentId,
        intervalMs: this.tickIntervalMs,
      },
      'Tick loop started (timer mode)'
    );
  }

  /**
   * Start activity listeners (activity mode).
   *
   * Instead of ticking on a timer, tick when the agent is actually active:
   * - MESSAGE_SENT: When the agent sends a reply
   * - MODEL_USED: When the LLM is invoked
   *
   * WHY ACTIVITY MODE?
   * - More responsive: State updates when there's engagement
   * - More efficient: No CPU cycles spent ticking during idle periods
   * - More meaningful: Physiological/psychological changes tied to activity
   *
   * THROTTLING:
   * To prevent excessive ticks during rapid activity (e.g., multiple LLM calls
   * in a single response), ticks are throttled to at most once per activityThrottleMs.
   *
   * For offline catch-up, the tick still runs on reconnection (in start()).
   */
  private startActivityListeners(): void {
    // Tick when agent sends a message (reply) - this is the primary trigger
    this.runtime.registerEvent(EventType.MESSAGE_SENT, async (payload) => {
      if (payload.source === 'homeostasis') return; // Skip our own events
      await this.activityTick('MESSAGE_SENT');
    });

    // Also tick when the LLM is used (catches cases without reply, like thinking)
    this.runtime.registerEvent(EventType.MODEL_USED, async (payload) => {
      if (payload.source === 'homeostasis') return; // Skip our own events
      await this.activityTick('MODEL_USED');
    });

    this.runtime.logger.debug(
      {
        src: 'plugin:homeostasis',
        agentId: this.runtime.agentId,
        throttleMs: this.activityThrottleMs,
      },
      'Activity listeners started (activity mode)'
    );
  }

  /**
   * Throttled activity tick.
   *
   * Called by activity listeners, but only actually ticks if enough time
   * has passed since the last tick (activityThrottleMs).
   */
  private async activityTick(trigger: string): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastActivityTickAt;

    // Skip if we've ticked too recently
    if (elapsed < this.activityThrottleMs) {
      this.runtime.logger.debug(
        {
          src: 'plugin:homeostasis',
          agentId: this.runtime.agentId,
          trigger,
          elapsed,
          throttleMs: this.activityThrottleMs,
        },
        'Activity tick throttled'
      );
      return;
    }

    this.lastActivityTickAt = now;

    this.runtime.logger.debug(
      {
        src: 'plugin:homeostasis',
        agentId: this.runtime.agentId,
        trigger,
        elapsed,
      },
      'Activity tick triggered'
    );

    await this.tick();
  }

  /**
   * Main tick function - the core of homeostasis.
   *
   * ORDER OF OPERATIONS:
   * 1. Apply external deltas (from other plugins)
   * 2. Apply physiological accumulation (needs build up)
   * 3. Apply psychological recovery (with coupling from physiological)
   * 4. Apply resource decay
   * 5. Enforce bounds (clamping)
   * 6. Check lifecycle (survival system)
   * 7. Persist and emit events
   *
   * WHY THIS ORDER?
   * - External deltas first: reflects what happened since last tick
   * - Physiological accumulation: needs naturally build up
   * - Psychological recovery with coupling: high physiological stress dampens recovery
   * - Clamping before lifecycle: ensures valid state for distress calculation
   * - Lifecycle check: may trigger death or crisis events
   *
   * CALLING TICK MANUALLY:
   * In activity mode, tick() is called automatically on MESSAGE_SENT and MODEL_USED.
   * You can also call tick() manually to force state updates.
   */
  async tick(): Promise<void> {
    // Skip tick if dead or suspended
    if (
      this.state.lifecycle.status === 'dead' ||
      this.state.lifecycle.status === 'suspended'
    ) {
      return;
    }

    const startTime = Date.now();
    let physiologicalChanged = false;
    let drivesChanged = false;
    let resourcesChanged = false;

    // Snapshot previous state for comparison
    this.previousPhysiological = { ...this.state.physiological };
    this.previousDrives = { ...this.state.drives };
    this.previousDistressScore = this.getDistressScore();
    const previousResources = { ...this.state.resources };

    // 1a. Apply queued physiological deltas with sensitivity
    const appliedPhysiologicalDeltas = this.applyQueuedPhysiologicalDeltas();
    if (Object.keys(appliedPhysiologicalDeltas).length > 0) {
      physiologicalChanged = true;
    }

    // 1b. Apply queued drive deltas with sensitivity
    const appliedDriveDeltas = this.applyQueuedDriveDeltas();
    if (Object.keys(appliedDriveDeltas).length > 0) {
      drivesChanged = true;
    }

    // 1c. Apply queued resource deltas
    const changedResourceKeys = this.applyQueuedResourceDeltas();
    if (changedResourceKeys.length > 0) {
      resourcesChanged = true;
    }

    // 2. Apply domain body coupling rules (if a domain body is active)
    // Coupling rules define how domain state (e.g., game health) affects psychological drives
    const couplingChanged = this.applyActiveCouplingRules();
    if (couplingChanged) {
      drivesChanged = true;
    }

    // 3. Apply physiological accumulation (needs build up over time)
    // Only applies when default body is active (domain bodies manage their own physiological state)
    if (this.isDefaultBodyActive()) {
      const accumulationChanged = this.applyPhysiologicalAccumulation();
      if (accumulationChanged) {
        physiologicalChanged = true;
      }
    }

    // 4. Apply psychological recovery toward baseline (with coupling)
    // When physiological stress is high (from default or domain body), recovery is dampened
    const recoveryChanged = this.applyRecovery();
    if (recoveryChanged) {
      drivesChanged = true;
    }

    // 4. Apply resource decay if configured
    const decayChanged = this.applyResourceDecay();
    if (decayChanged) {
      resourcesChanged = true;
    }

    // 5a. Clamp physiological to 0-100
    this.clampPhysiological();

    // 5b. Clamp drives to 0-100
    this.clampDrives();

    // 5c. Apply resource bounds if configured
    this.applyResourceBounds();

    // 6. Check lifecycle (survival system)
    // This may trigger death or crisis events
    const lifecycleChanged = await this.checkLifecycle();

    // 7. Emit distress updated event if distress changed significantly
    const currentDistress = this.getDistressScore();
    if (Math.abs(currentDistress - this.previousDistressScore) > 1) {
      await this.emitDistressUpdatedEvent();
    }

    // Update timestamp
    this.state.lastTickAt = startTime;

    // 8. Persist if anything changed
    if (
      physiologicalChanged ||
      drivesChanged ||
      resourcesChanged ||
      lifecycleChanged
    ) {
      await this.persistState();
    }

    // 9. Emit events
    if (physiologicalChanged) {
      await this.emitPhysiologicalUpdatedEvent(appliedPhysiologicalDeltas);
      await this.checkAndEmitPhysiologicalThresholdEvents();
    }

    if (drivesChanged) {
      await this.emitDrivesUpdatedEvent(appliedDriveDeltas);
      await this.checkAndEmitThresholdEvents();
    }

    if (resourcesChanged) {
      await this.emitResourcesUpdatedEvent(changedResourceKeys);
    }

    // Only log if something actually changed
    if (
      physiologicalChanged ||
      drivesChanged ||
      resourcesChanged ||
      lifecycleChanged
    ) {
      this.runtime.logger.debug(
        {
          src: 'plugin:homeostasis',
          agentId: this.runtime.agentId,
          physiologicalChanged,
          drivesChanged,
          resourcesChanged,
          lifecycleChanged,
          distress: currentDistress.toFixed(1),
          lifecycle: this.state.lifecycle.status,
          durationMs: Date.now() - startTime,
        },
        'Tick completed'
      );
    }
  }

  // ===========================================================================
  // PHYSIOLOGICAL DYNAMICS
  // ===========================================================================

  /**
   * Apply queued physiological deltas with sensitivity multipliers.
   *
   * NEGATIVE DELTAS = SATISFACTION
   * When external events satisfy needs (eating, resting), they propose
   * negative deltas to reduce the deprivation level.
   *
   * RETURNS: Object of accumulated deltas that were actually applied
   */
  private applyQueuedPhysiologicalDeltas(): Partial<Physiological> {
    if (this.physiologicalDeltaQueue.length === 0) {
      return {};
    }

    const accumulated: Partial<Physiological> = {};

    // Accumulate all deltas for each variable
    for (const queued of this.physiologicalDeltaQueue) {
      for (const id of PHYSIOLOGICAL_IDS) {
        const delta = (queued.delta as Partial<Physiological>)[id];
        if (delta !== undefined) {
          // Apply sensitivity multiplier
          const sensitivity = this.physiologicalConfigs[id].sensitivity;
          const effectiveDelta = delta * sensitivity;

          accumulated[id] = (accumulated[id] || 0) + effectiveDelta;
        }
      }
    }

    // Apply accumulated deltas
    for (const [id, delta] of Object.entries(accumulated)) {
      this.state.physiological[id as PhysiologicalId] += delta;
    }

    // Clear the queue (deltas have been applied)
    this.physiologicalDeltaQueue = [];

    return accumulated;
  }

  /**
   * Apply physiological accumulation (needs build up over time).
   *
   * ACCUMULATION FORMULA:
   * variable = variable + (100 - variable) * accumulationRate
   *
   * WHY THIS FORMULA?
   * - Asymptotic approach: accumulation slows as you approach 100
   * - Prevents instant jumps to critical
   * - Creates smooth, natural curves
   * - Same math as recovery, but toward 100 instead of baseline
   *
   * RETURNS: true if any variable changed
   */
  private applyPhysiologicalAccumulation(): boolean {
    let changed = false;

    for (const id of PHYSIOLOGICAL_IDS) {
      const config = this.physiologicalConfigs[id];

      // Skip variables with no accumulation (e.g., health)
      if (config.accumulationRate === 0) {
        continue;
      }

      const current = this.state.physiological[id];
      const headroom = 100 - current;
      const accumulation = headroom * config.accumulationRate;

      // Only apply if meaningful change (> 0.01)
      if (accumulation > 0.01) {
        this.state.physiological[id] = current + accumulation;
        changed = true;
      }
    }

    return changed;
  }

  /**
   * Calculate current physiological stress level.
   *
   * RETURNS: 0-1 where 0 = fully satisfied, 1 = fully deprived
   *
   * WHY AVERAGE?
   * A simple average gives equal weight to all physiological needs.
   * Could be weighted in the future (e.g., hunger matters more than hydration).
   */
  getPhysiologicalStress(): number {
    const values = Object.values(this.state.physiological);
    const sum = values.reduce((acc, v) => acc + v, 0);
    return sum / values.length / 100;
  }

  // ===========================================================================
  // DISTRESS CALCULATION (SURVIVAL SYSTEM)
  // ===========================================================================

  /**
   * Calculate aggregate distress score from physiological state.
   *
   * FORMULA:
   * distress = Σ(variable * weight)
   *
   * With default weights {hunger: 0.35, fatigue: 0.25, health: 0.30, hydration: 0.10},
   * an agent with hunger=80, fatigue=60, health=50, hydration=40 has:
   * distress = 80*0.35 + 60*0.25 + 50*0.30 + 40*0.10 = 28 + 15 + 15 + 4 = 62
   *
   * WHY WEIGHTED?
   * Different physiological needs have different urgency. Hunger and health
   * are primary survival needs, while hydration cycles faster but is less
   * immediately critical.
   *
   * RETURNS: 0-100 distress score
   */
  getDistressScore(): number {
    const p = this.state.physiological;
    return (
      p.hunger * this.distressWeights.hunger +
      p.fatigue * this.distressWeights.fatigue +
      p.health * this.distressWeights.health +
      p.hydration * this.distressWeights.hydration
    );
  }

  /**
   * Get the distress bracket for the current distress score.
   *
   * Brackets provide human-readable descriptions:
   * - content (0-15): All systems nominal
   * - aware (15-30): Faint awareness of needs
   * - concerned (30-50): Noticeable discomfort
   * - strained (50-70): Significant pressure
   * - struggling (70-85): Approaching limits
   * - desperate (85-95): Crisis zone
   * - terminal (95+): Death imminent
   */
  getDistressBracket(): DistressBracket {
    const score = this.getDistressScore();
    if (score < 15) return 'content';
    if (score < 30) return 'aware';
    if (score < 50) return 'concerned';
    if (score < 70) return 'strained';
    if (score < 85) return 'struggling';
    if (score < 95) return 'desperate';
    return 'terminal';
  }

  /**
   * Get which physiological variable is contributing most to distress.
   *
   * Useful for targeting intervention: "hunger is the primary issue".
   */
  getPrimaryDistressContributor(): PhysiologicalId {
    const p = this.state.physiological;
    const contributions: [PhysiologicalId, number][] = [
      ['hunger', p.hunger * this.distressWeights.hunger],
      ['fatigue', p.fatigue * this.distressWeights.fatigue],
      ['health', p.health * this.distressWeights.health],
      ['hydration', p.hydration * this.distressWeights.hydration],
    ];

    // Sort by contribution (descending) and return the highest
    contributions.sort((a, b) => b[1] - a[1]);
    return contributions[0][0];
  }

  /**
   * Get current lifecycle state.
   */
  getLifecycleState(): LifecycleState {
    return { ...this.state.lifecycle };
  }

  /**
   * Check if agent is alive (not dead or suspended).
   */
  isAlive(): boolean {
    return (
      this.state.lifecycle.status === 'alive' ||
      this.state.lifecycle.status === 'crisis' ||
      this.state.lifecycle.status === 'dying'
    );
  }

  /**
   * Check if agent is suspended (can be revived).
   */
  isSuspended(): boolean {
    return this.state.lifecycle.status === 'suspended';
  }

  /**
   * Check if agent is dead (cannot be revived).
   */
  isDead(): boolean {
    return this.state.lifecycle.status === 'dead';
  }

  // ===========================================================================
  // LIFECYCLE MANAGEMENT (SURVIVAL SYSTEM)
  // ===========================================================================

  /**
   * Check lifecycle state and update based on distress.
   *
   * STATE MACHINE:
   * alive -> crisis (distress >= crisisThreshold)
   * crisis -> alive (distress < crisisThreshold, crisis resolved)
   * crisis -> dying (ticksInCrisis >= ticksUntilDeath)
   * dying -> dead/suspended (ticksInCrisis >= ticksUntilDeath + finalTicks)
   * suspended -> alive (via revive())
   *
   * RETURNS: true if lifecycle state changed
   */
  private async checkLifecycle(): Promise<boolean> {
    // Skip if already dead or suspended
    if (
      this.state.lifecycle.status === 'dead' ||
      this.state.lifecycle.status === 'suspended'
    ) {
      return false;
    }

    const distress = this.getDistressScore();
    const previousStatus = this.state.lifecycle.status;

    if (distress >= this.crisisThreshold) {
      // In crisis territory
      this.state.lifecycle.ticksInCrisis++;

      // First tick in crisis - enter crisis state
      if (
        this.state.lifecycle.ticksInCrisis === 1 &&
        previousStatus === 'alive'
      ) {
        this.state.lifecycle.status = 'crisis';
        await this.emitDistressCriticalEvent();
        this.runtime.logger.warn(
          {
            src: 'plugin:homeostasis',
            agentId: this.runtime.agentId,
            distress,
            ticksUntilDeath: this.ticksUntilDeath,
          },
          'Agent entered crisis state'
        );
        return true;
      }

      // Death imminent
      if (
        this.state.lifecycle.ticksInCrisis === this.ticksUntilDeath &&
        previousStatus !== 'dying'
      ) {
        this.state.lifecycle.status = 'dying';
        await this.emitDeathImminentEvent();
        this.runtime.logger.error(
          {
            src: 'plugin:homeostasis',
            agentId: this.runtime.agentId,
            distress,
            finalTicks: this.finalTicks,
          },
          'Agent death is imminent'
        );
        return true;
      }

      // Actual death
      if (
        this.state.lifecycle.ticksInCrisis >=
        this.ticksUntilDeath + this.finalTicks
      ) {
        await this.triggerDeath('distress');
        return true;
      }
    } else if (previousStatus === 'crisis' || previousStatus === 'dying') {
      // Recovered from crisis!
      const ticksSpent = this.state.lifecycle.ticksInCrisis;
      this.state.lifecycle.status = 'alive';
      this.state.lifecycle.ticksInCrisis = 0;
      await this.emitCrisisResolvedEvent(ticksSpent);
      this.runtime.logger.info(
        {
          src: 'plugin:homeostasis',
          agentId: this.runtime.agentId,
          distress,
          ticksSpent,
        },
        'Agent recovered from crisis'
      );
      return true;
    }

    return false;
  }

  /**
   * Trigger death based on configured death mode.
   *
   * DEATH MODES:
   * - 'suspended': Agent hibernates, can be revived later (default)
   * - 'graceful': Agent gets one final response, then dies
   * - 'immediate': Agent dies instantly
   */
  private async triggerDeath(
    cause: 'distress' | 'shutdown' | 'admin'
  ): Promise<void> {
    this.runtime.logger.error(
      {
        src: 'plugin:homeostasis',
        agentId: this.runtime.agentId,
        cause,
        deathMode: this.deathMode,
      },
      'Agent death triggered'
    );

    if (this.deathMode === 'suspended') {
      this.state.lifecycle.status = 'suspended';
      this.state.lifecycle.suspendedAt = Date.now();
      this.stopTickLoop();
      await this.emitSuspendedEvent();
      await this.persistState();
    } else if (this.deathMode === 'graceful') {
      // In graceful mode, we stay in 'dying' status until completeDeath is called
      // This gives the agent one final response opportunity
      this.state.lifecycle.status = 'dying';
      await this.emitDeathImminentEvent();
      // Set a timeout to force death if completeDeath isn't called
      setTimeout(async () => {
        if (this.state.lifecycle.status === 'dying') {
          await this.completeDeath(cause);
        }
      }, 30000); // 30 second grace period
    } else {
      // Immediate death
      await this.completeDeath(cause);
    }
  }

  /**
   * Complete the death process (create legacy, emit event, stop).
   *
   * Called automatically in immediate mode, or after final response in graceful mode.
   */
  async completeDeath(
    cause: 'distress' | 'shutdown' | 'admin',
    finalWords?: string
  ): Promise<void> {
    this.state.lifecycle.status = 'dead';
    this.state.lifecycle.diedAt = Date.now();
    this.stopTickLoop();

    // Create legacy record
    const legacy = this.createLegacy(cause, finalWords);
    await this.persistLegacy(legacy);
    await this.emitDeathEvent(legacy);
    await this.persistState();

    this.runtime.logger.error(
      { src: 'plugin:homeostasis', agentId: this.runtime.agentId, legacy },
      'Agent has died'
    );
  }

  /**
   * Synchronize the live state to an externally computed snapshot immediately.
   *
   * This is useful for orchestration systems like Halliday that already own a
   * world model and need motivation/homeostasis consumers to see the mapped
   * state during the same compose cycle.
   */
  async syncExternalState(
    nextState: {
      physiological?: Partial<Physiological>;
      drives?: Partial<Drives>;
      resources?: Partial<Resources>;
    },
    metadata?: DeltaMetadata
  ): Promise<void> {
    const clampPhysiological = (value: number) =>
      Math.max(0, Math.min(100, value));
    const clampDrive = (value: number) => Math.max(0, Math.min(100, value));

    if (nextState.physiological) {
      for (const [key, value] of Object.entries(nextState.physiological)) {
        if (typeof value !== 'number' || Number.isNaN(value)) continue;
        this.state.physiological[key as PhysiologicalId] =
          clampPhysiological(value);
      }
    }

    if (nextState.drives) {
      for (const [key, value] of Object.entries(nextState.drives)) {
        if (typeof value !== 'number' || Number.isNaN(value)) continue;
        this.state.drives[key as DriveId] = clampDrive(value);
      }
    }

    if (nextState.resources) {
      for (const [key, value] of Object.entries(nextState.resources)) {
        if (typeof value !== 'number' || Number.isNaN(value)) continue;
        this.state.resources[key] = value;
      }
    }

    this.state.lastTickAt = Date.now();
    this.previousPhysiological = { ...this.state.physiological };
    this.previousDrives = { ...this.state.drives };
    this.previousDistressScore = this.getDistressScore();

    this.runtime.logger.debug(
      {
        src: 'plugin:homeostasis',
        agentId: this.runtime.agentId,
        metadata,
      },
      'External state synchronized'
    );

    await this.persistState();
  }

  /**
   * Create legacy record for a dying agent.
   */
  private createLegacy(
    cause: 'distress' | 'shutdown' | 'admin',
    finalWords?: string
  ): AgentLegacy {
    return {
      agentId: this.runtime.agentId,
      name: this.runtime.character.name ?? this.runtime.agentId,
      createdAt: this.state.createdAt,
      diedAt: Date.now(),
      lifespan: Date.now() - this.state.createdAt,
      cause,
      finalDistress: this.getDistressScore(),
      finalBracket: this.getDistressBracket(),
      physiological: { ...this.state.physiological },
      psychological: { ...this.state.drives },
      finalWords,
    };
  }

  /**
   * Persist legacy to component storage.
   */
  private async persistLegacy(legacy: AgentLegacy): Promise<void> {
    try {
      await this.runtime.createComponent({
        id: crypto.randomUUID() as UUID,
        entityId: this.runtime.agentId,
        agentId: this.runtime.agentId,
        roomId: undefined as any,
        worldId: undefined as any,
        sourceEntityId: undefined as any,
        type: 'homeostasis_legacy',
        data: legacy as any,
        createdAt: Date.now(),
      });
    } catch (error) {
      this.runtime.logger.error(
        {
          src: 'plugin:homeostasis',
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to persist legacy'
      );
    }
  }

  /**
   * Revive a suspended agent.
   *
   * Can only revive from 'suspended' status (not 'dead').
   * Resets physiological to moderate levels (not fully satisfied).
   */
  async revive(): Promise<void> {
    if (this.state.lifecycle.status !== 'suspended') {
      throw new Error('Can only revive suspended agents');
    }

    const suspendedFor =
      Date.now() - (this.state.lifecycle.suspendedAt || Date.now());

    // Reset to moderate physiological levels (give them a fighting chance)
    this.state.physiological = {
      hunger: 40,
      fatigue: 30,
      health: 50,
      hydration: 30,
    };

    // Reset lifecycle
    this.state.lifecycle.status = 'alive';
    this.state.lifecycle.ticksInCrisis = 0;
    this.state.lifecycle.suspendedAt = undefined;

    // Restart tick loop
    this.startTickLoop();

    await this.emitRevivedEvent(suspendedFor);
    await this.persistState();

    this.runtime.logger.info(
      {
        src: 'plugin:homeostasis',
        agentId: this.runtime.agentId,
        suspendedFor,
      },
      'Agent revived from suspension'
    );
  }

  /**
   * Stop the tick loop.
   */
  private stopTickLoop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  // ===========================================================================
  // DELTA APPLICATION
  // ===========================================================================

  /**
   * Apply queued drive deltas with sensitivity multipliers.
   *
   * SENSITIVITY:
   * Each drive has a sensitivity setting that multiplies incoming deltas.
   * - sensitivity = 0.5: deltas are halved (drive is "heavy")
   * - sensitivity = 1.0: deltas apply as-is (default)
   * - sensitivity = 1.5: deltas are amplified (drive is "volatile")
   *
   * SATURATION:
   * At extremes (near 0 or 100), deltas have diminishing returns.
   * This prevents drives from pinning at extremes and creates more
   * stable, organic dynamics.
   *
   * RETURNS: Object of accumulated deltas that were actually applied
   */
  private applyQueuedDriveDeltas(): Partial<Drives> {
    if (this.driveDeltaQueue.length === 0) {
      return {};
    }

    const accumulated: Partial<Drives> = {};
    const driveIds: DriveId[] = [
      'security',
      'social',
      'status',
      'autonomy',
      'meaning',
    ];

    // Accumulate all deltas for each drive
    for (const queued of this.driveDeltaQueue) {
      const delta = queued.delta as Partial<Drives>;
      for (const driveId of driveIds) {
        if (delta[driveId] !== undefined) {
          const rawDelta = delta[driveId]!;

          // Apply sensitivity multiplier
          const sensitivity = this.driveConfigs[driveId].sensitivity;
          const effectiveDelta = rawDelta * sensitivity;

          // Apply saturation (diminishing returns at extremes)
          const saturatedDelta = this.applySaturation(
            this.state.drives[driveId],
            effectiveDelta
          );

          accumulated[driveId] = (accumulated[driveId] || 0) + saturatedDelta;
        }
      }
    }

    // Apply accumulated deltas
    for (const [driveId, delta] of Object.entries(accumulated)) {
      this.state.drives[driveId as DriveId] += delta;
    }

    // Clear the queue (deltas have been applied)
    this.driveDeltaQueue = [];

    return accumulated;
  }

  /**
   * Apply saturation effect (diminishing returns at extremes).
   *
   * WHY SATURATION?
   * Real systems have diminishing returns:
   * - Easy to improve security from 50 to 60 (lots of room to grow)
   * - Hard to improve security from 95 to 100 (already near perfect)
   * - Easy to harm security at 50 (average, vulnerable)
   * - Hard to harm security at 5 (already terrible, can't get much worse)
   *
   * MATH:
   * multiplier = 1 - (distance_from_center / 50) * saturationFactor
   * - At center (50): multiplier = 1.0 (full effect)
   * - At extreme (0 or 100): multiplier = 1 - saturationFactor (reduced effect)
   */
  private applySaturation(currentValue: number, delta: number): number {
    const distanceFromCenter = Math.abs(currentValue - 50);
    const saturationMultiplier =
      1 - (distanceFromCenter / 50) * this.saturationFactor;

    // Never reduce below 10% effect (prevents complete stalling)
    return delta * Math.max(0.1, saturationMultiplier);
  }

  /**
   * Apply queued resource deltas.
   *
   * Resources are simpler than drives:
   * - No sensitivity (deltas apply 1:1)
   * - No saturation (resources can be any value)
   * - Lazily created (first delta for a key creates it)
   *
   * RETURNS: Array of resource keys that changed
   */
  private applyQueuedResourceDeltas(): string[] {
    if (this.resourceDeltaQueue.length === 0) {
      return [];
    }

    const changedKeys = new Set<string>();

    for (const queued of this.resourceDeltaQueue) {
      for (const [key, delta] of Object.entries(queued.delta)) {
        const existing = this.state.resources[key];

        if (typeof delta === 'number') {
          // Simple numeric delta
          if (typeof existing === 'number') {
            this.state.resources[key] = existing + delta;
          } else if (
            existing &&
            typeof existing === 'object' &&
            'value' in existing
          ) {
            // Add to configured resource
            existing.value += delta;
          } else {
            // Create new resource (lazy creation)
            this.state.resources[key] = delta;
          }
        } else if (typeof delta === 'object' && 'value' in delta) {
          // ResourceConfig object - replace entirely
          this.state.resources[key] = delta;
        }

        changedKeys.add(key);
      }
    }

    // Clear the queue
    this.resourceDeltaQueue = [];

    return Array.from(changedKeys);
  }

  // ===========================================================================
  // RECOVERY DYNAMICS
  // ===========================================================================

  /**
   * Apply recovery toward baseline for each drive.
   *
   * RECOVERY FORMULA:
   * drive = drive + (effectiveBaseline - drive) * recoveryRate * dampening
   *
   * This is exponential decay toward baseline:
   * - Fast when far from baseline
   * - Slow when near baseline
   * - Never quite reaches baseline (asymptotic)
   *
   * PHYSIOLOGICAL COUPLING:
   * When physiological stress exceeds threshold (default 0.7), recovery
   * rate is halved. This creates emergent "survival mode" where high
   * physiological needs naturally suppress psychological recovery.
   *
   * WHY NOT LINEAR?
   * Linear recovery would overshoot and oscillate. Exponential decay
   * creates smooth, stable approach to equilibrium.
   *
   * RETURNS: true if any drive changed
   */
  private applyRecovery(): boolean {
    let changed = false;
    const hour = new Date().getHours();

    // Calculate stress for coupling (from active body or default)
    // Stress > threshold dampens psychological recovery (survival mode)
    const activeBody = this.getActiveBody();
    let stress: number;
    if (activeBody) {
      // Use domain body's distress contribution (0-100 scale, convert to 0-1)
      stress = activeBody.getPhysiological().distressContribution / 100;
    } else {
      // Use default physiological stress
      stress = this.getPhysiologicalStress();
    }
    const dampening = stress > this.physiologicalStressThreshold ? 0.5 : 1.0;

    for (const driveId of Object.keys(this.state.drives) as DriveId[]) {
      const config = this.driveConfigs[driveId];

      // Skip drives with null baseline (they don't auto-recover)
      if (config.baseline === null) {
        continue;
      }

      // Calculate effective baseline with circadian modifier
      const effectiveBaseline = this.calculateEffectiveBaseline(driveId, hour);

      // Apply recovery with coupling dampening
      const current = this.state.drives[driveId];
      const distance = effectiveBaseline - current;
      const recovery = distance * config.recoveryRate * dampening;

      // Only apply if meaningful change (> 0.01)
      // WHY THRESHOLD?
      // Floating point noise would cause endless tiny updates and events.
      // 0.01 is small enough to be imperceptible but large enough to filter noise.
      if (Math.abs(recovery) > 0.01) {
        this.state.drives[driveId] = current + recovery;
        changed = true;
      }
    }

    return changed;
  }

  /**
   * Calculate effective baseline with circadian modifier.
   *
   * CIRCADIAN RHYTHM:
   * Real organisms have daily cycles. This adds a sine wave modifier
   * to the baseline based on time of day.
   *
   * FORMULA:
   * effectiveBaseline = baseline + sin(hour * π/12) * amplitude
   *
   * This creates a smooth 24-hour cycle:
   * - Peak at hour 6 (6am or 6pm depending on offset)
   * - Trough at hour 18 (opposite)
   *
   * DEFAULT: amplitude = 0 (no circadian effect)
   */
  private calculateEffectiveBaseline(driveId: DriveId, hour: number): number {
    const config = this.driveConfigs[driveId];
    if (config.baseline === null) return 50;

    if (config.circadianAmplitude === 0) {
      return config.baseline;
    }

    // Sine wave with 24-hour period
    const radians = (hour * Math.PI) / 12;
    const modifier = Math.sin(radians) * config.circadianAmplitude;

    return this.clamp(config.baseline + modifier, 0, 100);
  }

  /**
   * Apply decay to resources that have decayRate configured.
   *
   * DECAY FORMULA:
   * resource = resource - (resource * decayRate)
   *
   * This is percentage-based decay:
   * - decayRate = 0.1: lose 10% per tick
   * - Higher values decay faster
   * - Decays to near-zero asymptotically
   *
   * WHY OPTIONAL DECAY?
   * Most resources (money, tokens) don't decay. But some (energy, attention)
   * deplete over time. Making decay optional keeps simple cases simple.
   *
   * RETURNS: true if any resource changed
   */
  private applyResourceDecay(): boolean {
    let changed = false;

    for (const [key, resource] of Object.entries(this.state.resources)) {
      if (
        typeof resource === 'object' &&
        'decayRate' in resource &&
        resource.decayRate
      ) {
        const decay = resource.value * resource.decayRate;
        if (Math.abs(decay) > 0.01) {
          resource.value -= decay;
          changed = true;
        }
      }
    }

    return changed;
  }

  // ===========================================================================
  // DOMAIN BODY COUPLING
  // ===========================================================================
  //
  // WHY COUPLING RULES?
  // ===================
  // Domain bodies have their own physiological semantics - game health is
  // different from robot battery is different from simulated hunger. But
  // the agent has UNIFIED psychological drives (security, status, etc.).
  //
  // Coupling rules bridge this gap. They define:
  // "When [domain state reaches threshold], affect [psychological drive]"
  //
  // EXAMPLE:
  // - Hyperscape health < 30% → security drive -15
  // - In combat → security drive -3
  // - Died in game → status drive -20
  //
  // WHY RUN IN TICK LOOP?
  // =====================
  // Coupling is checked each tick because domain state changes constantly.
  // Cooldowns prevent spam - a rule fires once, then waits before firing again.
  //
  // WHY NOT THE DEFAULT BODY?
  // =========================
  // The default body uses the built-in physiological system (hunger, fatigue),
  // which already has direct coupling to psychological recovery via stress.
  // Coupling rules are only for domain bodies that need custom mappings.
  //
  // ===========================================================================

  /**
   * Apply coupling rules from the active domain body.
   *
   * WHY THIS METHOD?
   * Each tick, we check if any coupling rules should fire. Rules define
   * how domain state (health < 30) affects psychological drives (security -15).
   *
   * WHY CHECK EVERY TICK?
   * Domain state changes constantly. We need to detect when thresholds are
   * crossed. Cooldowns prevent rapid re-firing of the same rule.
   *
   * Only runs when a domain body is active (not default body).
   *
   * RETURNS: true if any drive was changed by coupling rules
   */
  private applyActiveCouplingRules(): boolean {
    const activeBody = this.getActiveBody();
    if (!activeBody) {
      // Default body - no coupling rules, uses existing dynamics
      return false;
    }

    const rules = activeBody.getCouplingRules();
    const physio = activeBody.getPhysiological();
    const now = Date.now();
    let changed = false;

    for (const rule of rules) {
      // Check cooldown
      const lastTriggered = this.couplingCooldowns.get(rule.id) ?? 0;
      const cooldown = rule.cooldownMs ?? 5000;
      if (now - lastTriggered < cooldown) {
        continue;
      }

      // Evaluate trigger condition
      const value = physio.variables[rule.trigger.variable] ?? 0;
      const triggered = this.evaluateCouplingTrigger(
        value,
        rule.trigger.op,
        rule.trigger.value
      );

      if (triggered) {
        // Apply effect to psychological drive
        this.state.drives[rule.effect.drive] += rule.effect.delta;
        this.couplingCooldowns.set(rule.id, now);
        changed = true;

        this.runtime.logger.debug(
          {
            src: 'plugin:homeostasis',
            agentId: this.runtime.agentId,
            ruleId: rule.id,
            drive: rule.effect.drive,
            delta: rule.effect.delta,
            variable: rule.trigger.variable,
            value,
            description: rule.description,
          },
          'Coupling rule fired'
        );
      }
    }

    return changed;
  }

  /**
   * Evaluate a coupling rule trigger condition.
   */
  private evaluateCouplingTrigger(
    value: number,
    op: string,
    threshold: number
  ): boolean {
    switch (op) {
      case '<':
        return value < threshold;
      case '>':
        return value > threshold;
      case '<=':
        return value <= threshold;
      case '>=':
        return value >= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Get effective distress from active body.
   *
   * If a domain body is active, uses its distressContribution.
   * Otherwise, uses the built-in physiological distress calculation.
   */
  getActiveDistress(): number {
    const activeBody = this.getActiveBody();
    if (activeBody) {
      return activeBody.getPhysiological().distressContribution;
    }
    return this.getDistressScore();
  }

  // ===========================================================================
  // BOUNDS ENFORCEMENT
  // ===========================================================================

  /**
   * Clamp all physiological values to 0-100 range.
   */
  private clampPhysiological(): void {
    for (const id of PHYSIOLOGICAL_IDS) {
      this.state.physiological[id] = this.clamp(
        this.state.physiological[id],
        0,
        100
      );
    }
  }

  /**
   * Clamp all drives to 0-100 range.
   *
   * WHY CLAMP?
   * Drives must stay in valid range regardless of what deltas were applied.
   * Clamping is the final safety net that ensures state validity.
   */
  private clampDrives(): void {
    for (const driveId of Object.keys(this.state.drives) as DriveId[]) {
      this.state.drives[driveId] = this.clamp(
        this.state.drives[driveId],
        0,
        100
      );
    }
  }

  /**
   * Apply bounds to resources that have min/max configured.
   */
  private applyResourceBounds(): void {
    for (const [key, resource] of Object.entries(this.state.resources)) {
      if (typeof resource === 'object' && 'value' in resource) {
        if (resource.min !== undefined) {
          resource.value = Math.max(resource.min, resource.value);
        }
        if (resource.max !== undefined) {
          resource.value = Math.min(resource.max, resource.value);
        }
      }
    }
  }

  /**
   * Clamp value to range.
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  // ===========================================================================
  // EVENTS
  // ===========================================================================

  /**
   * Emit physiological updated event.
   */
  private async emitPhysiologicalUpdatedEvent(
    deltas: Partial<Physiological>
  ): Promise<void> {
    const metadataArray = this.physiologicalDeltaQueue
      .map((q) => q.metadata)
      .filter(Boolean);

    await this.emitCustomEvent(HomeostasisEvents.PHYSIOLOGICAL_UPDATED, {
      agentId: this.runtime.agentId,
      physiological: { ...this.state.physiological },
      previousPhysiological: this.previousPhysiological,
      deltas,
      metadata: metadataArray.length > 0 ? metadataArray : undefined,
    });
  }

  /**
   * Emit drives updated event.
   *
   * Includes metadata from all deltas that were applied this tick,
   * allowing downstream plugins to know WHY drives changed.
   */
  private async emitDrivesUpdatedEvent(deltas: Partial<Drives>): Promise<void> {
    const metadataArray = this.driveDeltaQueue
      .map((q) => q.metadata)
      .filter(Boolean);

    await this.emitCustomEvent(HomeostasisEvents.DRIVES_UPDATED, {
      agentId: this.runtime.agentId,
      drives: { ...this.state.drives },
      previousDrives: this.previousDrives,
      deltas,
      metadata: metadataArray.length > 0 ? metadataArray : undefined,
    });
  }

  /**
   * Emit resources updated event.
   */
  private async emitResourcesUpdatedEvent(
    changedKeys: string[]
  ): Promise<void> {
    const metadataArray = this.resourceDeltaQueue
      .map((q) => q.metadata)
      .filter(Boolean);

    await this.emitCustomEvent(HomeostasisEvents.RESOURCES_UPDATED, {
      agentId: this.runtime.agentId,
      resources: { ...this.state.resources },
      changedKeys,
      metadata: metadataArray.length > 0 ? metadataArray : undefined,
    });
  }

  /**
   * Check for physiological threshold crossings and emit events.
   *
   * THRESHOLD EVENTS (note: HIGH values are BAD for physiological):
   * - PHYSIOLOGICAL_CRITICAL: rose above 80 (severe deprivation)
   * - PHYSIOLOGICAL_HIGH: rose above 50 (noticeable need)
   * - PHYSIOLOGICAL_SATISFIED: dropped below 20 (well-satisfied)
   *
   * WHY THRESHOLD EVENTS?
   * Rather than parsing every PHYSIOLOGICAL_UPDATED event, downstream
   * plugins can subscribe to specific transitions: "when hunger goes
   * critical, prioritize food-seeking behavior"
   */
  private async checkAndEmitPhysiologicalThresholdEvents(): Promise<void> {
    for (const id of PHYSIOLOGICAL_IDS) {
      const current = this.state.physiological[id];
      const previous = this.previousPhysiological[id];

      // Check for critical threshold (crossed above 80 = severe deprivation)
      if (
        previous < PhysiologicalThresholds.CRITICAL &&
        current >= PhysiologicalThresholds.CRITICAL
      ) {
        await this.emitPhysiologicalThresholdEvent(
          id,
          'critical',
          current,
          previous,
          'up'
        );
      }

      // Check for high threshold (crossed above 50 = noticeable need)
      if (
        previous < PhysiologicalThresholds.HIGH &&
        current >= PhysiologicalThresholds.HIGH
      ) {
        await this.emitPhysiologicalThresholdEvent(
          id,
          'high',
          current,
          previous,
          'up'
        );
      }

      // Check for satisfied threshold (crossed below 20 = well-satisfied)
      if (
        previous > PhysiologicalThresholds.SATISFIED &&
        current <= PhysiologicalThresholds.SATISFIED
      ) {
        await this.emitPhysiologicalThresholdEvent(
          id,
          'satisfied',
          current,
          previous,
          'down'
        );
      }
    }
  }

  /**
   * Emit a physiological threshold event.
   */
  private async emitPhysiologicalThresholdEvent(
    variable: PhysiologicalId,
    threshold: 'critical' | 'high' | 'moderate' | 'satisfied',
    value: number,
    previousValue: number,
    direction: 'up' | 'down'
  ): Promise<void> {
    const eventName = {
      critical: HomeostasisEvents.PHYSIOLOGICAL_CRITICAL,
      high: HomeostasisEvents.PHYSIOLOGICAL_HIGH,
      moderate: HomeostasisEvents.PHYSIOLOGICAL_HIGH, // Map moderate to high
      satisfied: HomeostasisEvents.PHYSIOLOGICAL_SATISFIED,
    }[threshold];

    await this.emitCustomEvent(eventName, {
      agentId: this.runtime.agentId,
      variable,
      threshold,
      value,
      previousValue,
      direction,
    });

    this.runtime.logger.info(
      {
        src: 'plugin:homeostasis',
        agentId: this.runtime.agentId,
        variable,
        threshold,
        value,
        direction,
      },
      `Physiological threshold crossed: ${variable} is ${threshold}`
    );
  }

  /**
   * Check for threshold crossings and emit events.
   *
   * THRESHOLD EVENTS:
   * - DRIVE_CRITICAL: dropped below 20 (urgent need)
   * - DRIVE_LOW: dropped below 40 (noticeable deficit)
   * - DRIVE_HIGH: rose above 80 (abundance)
   * - DRIVE_RECOVERED: returned within ±10 of baseline
   *
   * WHY THRESHOLD EVENTS?
   * Rather than parsing every DRIVES_UPDATED event, downstream plugins
   * can subscribe to specific transitions. This simplifies reactive logic:
   * "when security goes critical, trigger safety-seeking behavior"
   */
  private async checkAndEmitThresholdEvents(): Promise<void> {
    for (const driveId of Object.keys(this.state.drives) as DriveId[]) {
      const current = this.state.drives[driveId];
      const previous = this.previousDrives[driveId];
      const config = this.driveConfigs[driveId];

      // Check for critical threshold (crossed below 20)
      if (
        previous > DriveThresholds.CRITICAL &&
        current <= DriveThresholds.CRITICAL
      ) {
        await this.emitThresholdEvent(
          driveId,
          'critical',
          current,
          previous,
          'down'
        );
      }

      // Check for low threshold (crossed below 40)
      if (previous > DriveThresholds.LOW && current <= DriveThresholds.LOW) {
        await this.emitThresholdEvent(
          driveId,
          'low',
          current,
          previous,
          'down'
        );
      }

      // Check for high threshold (crossed above 80)
      if (previous < DriveThresholds.HIGH && current >= DriveThresholds.HIGH) {
        await this.emitThresholdEvent(driveId, 'high', current, previous, 'up');
      }

      // Check for recovered (returned within ±10 of baseline)
      if (config.baseline !== null) {
        const wasOutsideRange =
          Math.abs(previous - config.baseline) > DriveThresholds.RECOVERY_RANGE;
        const nowInsideRange =
          Math.abs(current - config.baseline) <= DriveThresholds.RECOVERY_RANGE;

        if (wasOutsideRange && nowInsideRange) {
          await this.emitThresholdEvent(
            driveId,
            'recovered',
            current,
            previous,
            previous < config.baseline ? 'up' : 'down',
            config.baseline
          );
        }
      }
    }
  }

  /**
   * Emit a threshold event.
   */
  private async emitThresholdEvent(
    drive: DriveId,
    threshold: 'critical' | 'low' | 'high' | 'recovered',
    value: number,
    previousValue: number,
    direction: 'up' | 'down',
    baseline?: number
  ): Promise<void> {
    const eventName = {
      critical: HomeostasisEvents.DRIVE_CRITICAL,
      low: HomeostasisEvents.DRIVE_LOW,
      high: HomeostasisEvents.DRIVE_HIGH,
      recovered: HomeostasisEvents.DRIVE_RECOVERED,
    }[threshold];

    await this.emitCustomEvent(eventName, {
      agentId: this.runtime.agentId,
      drive,
      threshold,
      value,
      previousValue,
      direction,
      baseline,
    });

    this.runtime.logger.info(
      {
        src: 'plugin:homeostasis',
        agentId: this.runtime.agentId,
        drive,
        threshold,
        value,
        direction,
      },
      `Drive threshold crossed: ${drive} is ${threshold}`
    );
  }

  // ===========================================================================
  // SURVIVAL EVENT EMISSION
  // ===========================================================================

  /**
   * Emit distress updated event.
   */
  private async emitDistressUpdatedEvent(): Promise<void> {
    await this.emitCustomEvent(HomeostasisEvents.DISTRESS_UPDATED, {
      agentId: this.runtime.agentId,
      distressScore: this.getDistressScore(),
      bracket: this.getDistressBracket(),
      previousDistressScore: this.previousDistressScore,
      physiological: { ...this.state.physiological },
      lifecycle: { ...this.state.lifecycle },
    });
  }

  /**
   * Emit distress critical event (agent entered crisis).
   */
  private async emitDistressCriticalEvent(): Promise<void> {
    await this.emitCustomEvent(HomeostasisEvents.DISTRESS_CRITICAL, {
      agentId: this.runtime.agentId,
      distressScore: this.getDistressScore(),
      bracket: this.getDistressBracket(),
      primaryContributor: this.getPrimaryDistressContributor(),
      physiological: { ...this.state.physiological },
      ticksUntilDeath: this.ticksUntilDeath,
    });
  }

  /**
   * Emit crisis resolved event (agent recovered from crisis).
   */
  private async emitCrisisResolvedEvent(
    ticksSpentInCrisis: number
  ): Promise<void> {
    await this.emitCustomEvent(HomeostasisEvents.CRISIS_RESOLVED, {
      agentId: this.runtime.agentId,
      distressScore: this.getDistressScore(),
      bracket: this.getDistressBracket(),
      ticksSpentInCrisis,
    });
  }

  /**
   * Emit death imminent event.
   */
  private async emitDeathImminentEvent(): Promise<void> {
    await this.emitCustomEvent(HomeostasisEvents.DEATH_IMMINENT, {
      agentId: this.runtime.agentId,
      distressScore: this.getDistressScore(),
      bracket: this.getDistressBracket(),
      finalTicksRemaining: this.finalTicks,
      deathMode: this.deathMode,
    });
  }

  /**
   * Emit death event.
   */
  private async emitDeathEvent(legacy: AgentLegacy): Promise<void> {
    await this.emitCustomEvent(HomeostasisEvents.DEATH, {
      agentId: this.runtime.agentId,
      legacy,
    });
  }

  /**
   * Emit suspended event.
   */
  private async emitSuspendedEvent(): Promise<void> {
    await this.emitCustomEvent(HomeostasisEvents.SUSPENDED, {
      agentId: this.runtime.agentId,
      distressScore: this.getDistressScore(),
      suspendedAt: this.state.lifecycle.suspendedAt,
    });
  }

  /**
   * Emit revived event.
   */
  private async emitRevivedEvent(suspendedFor: number): Promise<void> {
    await this.emitCustomEvent(HomeostasisEvents.REVIVED, {
      agentId: this.runtime.agentId,
      suspendedFor,
      physiological: { ...this.state.physiological },
    });
  }

  // ===========================================================================
  // PERSISTENCE
  // ===========================================================================

  /**
   * Persist state to component storage.
   *
   * WHY PERSIST?
   * State must survive agent restarts. Components are the elizaOS
   * standard for plugin state persistence.
   */
  private async persistState(): Promise<void> {
    try {
      const existing = await this.runtime.getComponent(
        this.runtime.agentId,
        'homeostasis_state'
      );

      if (existing) {
        await this.runtime.updateComponent({
          ...existing,
          data: this.state as any,
        });
      } else {
        await this.runtime.createComponent({
          id: crypto.randomUUID() as UUID,
          entityId: this.runtime.agentId,
          agentId: this.runtime.agentId,
          roomId: undefined as any,
          worldId: undefined as any,
          sourceEntityId: undefined as any,
          type: 'homeostasis_state',
          data: this.state as any,
          createdAt: Date.now(),
        });
      }
    } catch (error) {
      this.runtime.logger.error(
        {
          src: 'plugin:homeostasis',
          agentId: this.runtime.agentId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to persist homeostasis state'
      );
    }
  }

  // ===========================================================================
  // PUBLIC API - READ
  // ===========================================================================

  /**
   * Get current physiological state.
   *
   * Returns a copy (not reference) to prevent external mutation.
   *
   * SCALE: 0 = satisfied (good), 100 = deprived (critical)
   */
  getPhysiological(): Physiological {
    return { ...this.state.physiological };
  }

  /**
   * Get single physiological value.
   *
   * SCALE: 0 = satisfied (good), 100 = deprived (critical)
   */
  getPhysiologicalValue(id: PhysiologicalId): number {
    return this.state.physiological[id];
  }

  /**
   * Get current drives (psychological state).
   *
   * Returns a copy (not reference) to prevent external mutation.
   *
   * SCALE: 50 = balanced (good), 0 or 100 = extreme (tension)
   */
  getDrives(): Drives {
    return { ...this.state.drives };
  }

  /**
   * Get current resources.
   *
   * Returns a copy (not reference) to prevent external mutation.
   */
  getResources(): Resources {
    return { ...this.state.resources };
  }

  /**
   * Get single drive value.
   *
   * SCALE: 50 = balanced (good), 0 or 100 = extreme (tension)
   */
  getDrive(id: DriveId): number {
    return this.state.drives[id];
  }

  /**
   * Get single resource value.
   *
   * Unwraps ResourceConfig objects to just return the value.
   * Returns 0 for non-existent resources.
   */
  getResource(id: string): number {
    const resource = this.state.resources[id];
    if (typeof resource === 'number') return resource;
    if (resource && typeof resource === 'object' && 'value' in resource)
      return resource.value;
    return 0;
  }

  // ===========================================================================
  // PUBLIC API - WRITE
  // ===========================================================================

  /**
   * Propose a physiological delta (queued until next tick).
   *
   * Other plugins call this to affect physiological state. Deltas are:
   * - Validated (rejects NaN, Infinity)
   * - Queued (not applied immediately)
   * - Applied with sensitivity at next tick
   * - Batched with other deltas from the same tick
   *
   * NEGATIVE DELTAS = SATISFACTION
   * To satisfy a need (eating, resting), propose a negative delta.
   *
   * USAGE:
   * ```typescript
   * // After eating (satisfies hunger)
   * service.proposePhysiologicalDelta(
   *   { hunger: -30 },
   *   { source: 'plugin-activity', reason: 'ate_meal' }
   * );
   *
   * // After damage (increases health deprivation)
   * service.proposePhysiologicalDelta(
   *   { health: +20 },
   *   { source: 'plugin-combat', reason: 'took_damage' }
   * );
   * ```
   */
  proposePhysiologicalDelta(
    delta: Partial<Physiological>,
    metadata?: DeltaMetadata
  ): void {
    // Validate input (reject NaN, Infinity, non-numeric)
    if (!this.validateDelta(delta)) {
      this.runtime.logger.warn(
        { src: 'plugin:homeostasis', agentId: this.runtime.agentId, delta },
        'Invalid physiological delta rejected'
      );
      return;
    }

    // Queue for application at next tick
    this.physiologicalDeltaQueue.push({
      delta,
      metadata,
      timestamp: Date.now(),
    });

    this.runtime.logger.debug(
      {
        src: 'plugin:homeostasis',
        agentId: this.runtime.agentId,
        delta,
        metadata,
        queueLength: this.physiologicalDeltaQueue.length,
      },
      'Physiological delta queued'
    );
  }

  /**
   * Propose a drive delta (queued until next tick).
   *
   * Other plugins call this to affect drives. Deltas are:
   * - Validated (rejects NaN, Infinity)
   * - Queued (not applied immediately)
   * - Applied with sensitivity and saturation at next tick
   * - Batched with other deltas from the same tick
   *
   * USAGE:
   * ```typescript
   * // After task failure
   * service.proposeDriveDelta(
   *   { security: -10, status: -5 },
   *   { source: 'plugin-neuro', reason: 'task_failure' }
   * );
   * ```
   */
  proposeDriveDelta(delta: Partial<Drives>, metadata?: DeltaMetadata): void {
    // Validate input (reject NaN, Infinity, non-numeric)
    if (!this.validateDelta(delta)) {
      this.runtime.logger.warn(
        { src: 'plugin:homeostasis', agentId: this.runtime.agentId, delta },
        'Invalid drive delta rejected'
      );
      return;
    }

    // Queue for application at next tick
    this.driveDeltaQueue.push({
      delta,
      metadata,
      timestamp: Date.now(),
    });

    this.runtime.logger.debug(
      {
        src: 'plugin:homeostasis',
        agentId: this.runtime.agentId,
        delta,
        metadata,
        queueLength: this.driveDeltaQueue.length,
      },
      'Drive delta queued'
    );
  }

  /**
   * Report a resource delta (queued until next tick).
   *
   * Domain plugins call this when resources change.
   *
   * USAGE:
   * ```typescript
   * // After receiving payment
   * service.reportResourceDelta(
   *   { 'wallets.sol': +2.5, 'money': +150 },
   *   { source: 'plugin-commerce' }
   * );
   * ```
   */
  reportResourceDelta(
    delta: Partial<Resources>,
    metadata?: DeltaMetadata
  ): void {
    // Validate input
    if (!this.validateDelta(delta)) {
      this.runtime.logger.warn(
        { src: 'plugin:homeostasis', agentId: this.runtime.agentId, delta },
        'Invalid resource delta rejected'
      );
      return;
    }

    // Queue for application at next tick
    this.resourceDeltaQueue.push({
      delta,
      metadata,
      timestamp: Date.now(),
    });

    this.runtime.logger.debug(
      {
        src: 'plugin:homeostasis',
        agentId: this.runtime.agentId,
        delta,
        metadata,
        queueLength: this.resourceDeltaQueue.length,
      },
      'Resource delta queued'
    );
  }

  /**
   * Validate delta values (reject NaN, Infinity, non-numeric).
   *
   * WHY VALIDATE?
   * Invalid values (NaN, Infinity) would corrupt state and propagate
   * through the system. Better to reject early with a warning.
   */
  private validateDelta(delta: any): boolean {
    for (const [key, value] of Object.entries(delta)) {
      // Allow objects (for ResourceConfig)
      if (typeof value === 'object' && value !== null) {
        if ('value' in value) {
          const numValue = value.value;
          if (typeof numValue !== 'number' || !Number.isFinite(numValue)) {
            return false;
          }
        }
        continue;
      }

      // Must be a finite number
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return false;
      }
    }
    return true;
  }

  // ===========================================================================
  // DOMAIN BODY API
  // ===========================================================================
  //
  // WHY THESE METHODS?
  // ==================
  // Domain plugins need to:
  // 1. Register their body when loaded (registerDomainBody)
  // 2. Set world context when connecting/disconnecting (setWorldContext)
  // 3. Query if they're the active body (isInDomain, getActiveBody)
  //
  // This API is intentionally simple - the complexity is in the DomainBody
  // interface that plugins implement, not in these registration methods.
  //
  // ===========================================================================

  /**
   * Register a domain body.
   *
   * WHY THIS METHOD?
   * Domain plugins call this to register their body. The body provides:
   * - Physiological state (health, threats, etc.)
   * - Resources (gold, inventory, etc.)
   * - Coupling rules (how body state affects psychological drives)
   *
   * WHY DURING PLUGIN INIT?
   * Registration should happen once during plugin init, not repeatedly.
   * The registered body is a "source" that homeostasis queries when needed.
   *
   * USAGE:
   * ```typescript
   * homeostasis.registerDomainBody({
   *   domain: 'hyperscape',
   *   worldPatterns: ['hyperscape:*'],
   *   getPhysiological: () => ({ variables: { healthPercent: 85 }, distressContribution: 15 }),
   *   getResources: () => ({ gold: 500 }),
   *   getCouplingRules: () => [{ id: 'low-health', trigger: {...}, effect: {...} }],
   * });
   * ```
   */
  registerDomainBody(body: DomainBody): void {
    this.domainBodies.set(body.domain, body);
    this.runtime.logger.info(
      {
        src: 'plugin:homeostasis',
        agentId: this.runtime.agentId,
        domain: body.domain,
        patterns: body.worldPatterns,
      },
      'Domain body registered'
    );
  }

  /**
   * Unregister a domain body.
   *
   * Called when a domain plugin is unloaded or disconnected.
   * If currently in that domain's context, falls back to 'default'.
   */
  unregisterDomainBody(domain: string): void {
    this.domainBodies.delete(domain);

    // Fall back to default if we were in that domain
    if (this.currentWorldContext.startsWith(domain)) {
      this.currentWorldContext = 'default';
      this.runtime.logger.debug(
        { src: 'plugin:homeostasis', agentId: this.runtime.agentId, domain },
        'Fell back to default context after domain unregistered'
      );
    }

    this.runtime.logger.info(
      { src: 'plugin:homeostasis', agentId: this.runtime.agentId, domain },
      'Domain body unregistered'
    );
  }

  /**
   * Set the current world context.
   *
   * Called by domain plugins when the agent enters or leaves their world.
   * This determines which domain body is active.
   *
   * USAGE:
   * ```typescript
   * // When connecting to a game
   * homeostasis.setWorldContext('hyperscape:server-1');
   *
   * // When disconnecting
   * homeostasis.setWorldContext('default');
   * ```
   */
  setWorldContext(context: WorldContext): void {
    const previous = this.currentWorldContext;
    this.currentWorldContext = context;

    this.runtime.logger.debug(
      {
        src: 'plugin:homeostasis',
        agentId: this.runtime.agentId,
        previous,
        current: context,
      },
      'World context changed'
    );
  }

  /**
   * Get the current world context.
   */
  getCurrentWorldContext(): WorldContext {
    return this.currentWorldContext;
  }

  /**
   * Get the active domain body based on current world context.
   *
   * Returns null if no domain body matches (use default built-in physiological).
   */
  getActiveBody(): DomainBody | null {
    for (const body of this.domainBodies.values()) {
      if (
        body.worldPatterns.some((p) =>
          this.matchPattern(p, this.currentWorldContext)
        )
      ) {
        return body;
      }
    }
    return null; // Use default body
  }

  /**
   * Check if the default body is active (no domain body matches).
   */
  isDefaultBodyActive(): boolean {
    return this.getActiveBody() === null;
  }

  /**
   * Get list of registered domain names.
   */
  getRegisteredDomains(): string[] {
    return Array.from(this.domainBodies.keys());
  }

  /**
   * Check if currently in a specific domain.
   */
  isInDomain(domain: string): boolean {
    const activeBody = this.getActiveBody();
    return activeBody?.domain === domain;
  }

  /**
   * Match a world pattern against a context.
   *
   * Supports simple patterns:
   * - 'hyperscape:*' matches 'hyperscape:server-1', 'hyperscape:server-2', etc.
   * - 'hyperscape' matches exactly 'hyperscape'
   */
  private matchPattern(pattern: string, context: string): boolean {
    if (pattern.endsWith(':*')) {
      // Prefix match: 'hyperscape:*' matches 'hyperscape:server-1'
      return context.startsWith(pattern.slice(0, -1));
    }
    // Exact match
    return pattern === context;
  }

  /**
   * Get active physiological state.
   *
   * Returns domain physiological if a domain body is active,
   * otherwise returns the built-in physiological state.
   */
  getActivePhysiological(): Physiological | DomainPhysiological {
    const activeBody = this.getActiveBody();
    if (activeBody) {
      return activeBody.getPhysiological();
    }
    return this.state.physiological;
  }

  /**
   * Get active resources.
   *
   * Returns domain resources if a domain body is active,
   * otherwise returns the built-in resources.
   */
  getActiveResources(): Resources {
    const activeBody = this.getActiveBody();
    if (activeBody) {
      return activeBody.getResources();
    }
    return this.state.resources;
  }

  // ===========================================================================
  // ADMIN / TESTING API
  // ===========================================================================

  /**
   * Admin: Set state directly (for testing).
   *
   * Bypasses normal delta flow. Use for:
   * - Test setup (put agent in specific state)
   * - Admin overrides (emergency fixes)
   *
   * WARNING: Does not emit events or validate. Use carefully.
   */
  setState(state: Partial<HomeostasisState>): void {
    if (state.physiological) {
      this.state.physiological = {
        ...this.state.physiological,
        ...state.physiological,
      };
    }
    if (state.drives) {
      this.state.drives = { ...this.state.drives, ...state.drives };
    }
    if (state.resources) {
      this.state.resources = { ...this.state.resources, ...state.resources };
    }
    if (state.lastTickAt !== undefined) {
      this.state.lastTickAt = state.lastTickAt;
    }
  }

  /**
   * Admin: Run multiple ticks immediately (for testing).
   *
   * Simulates passage of time. Use for:
   * - Testing recovery dynamics
   * - Validating state evolution
   * - Burn-in scenarios
   */
  async runTicks(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.tick();
    }
  }
}
