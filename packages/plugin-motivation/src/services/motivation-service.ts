/**
 * @fileoverview MotivationService - Core motivation interpreter
 *
 * WHY THIS SERVICE?
 * -----------------
 * This service is the heart of plugin-motivation. It orchestrates the
 * interpretation pipeline:
 *
 *   Homeostasis State → Signals → Patterns → Frame Filter → Output
 *
 * RESPONSIBILITIES
 * ----------------
 * 1. Subscribe to homeostasis state changes
 * 2. Convert state to categorical signals (buckets)
 * 3. Detect active patterns from signals
 * 4. Filter patterns through the active frame
 * 5. Generate priorities, constraints, and opportunities
 * 6. Produce a human-readable narrative
 * 7. Emit events for state changes
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * - We don't OWN state (homeostasis does)
 * - We don't EXECUTE actions (autonomous does)
 * - We don't DECIDE what to do (the LLM does, informed by our output)
 *
 * DESIGN PRINCIPLES
 * -----------------
 * 1. INTERPRET, DON'T PRESCRIBE: We provide context, not commands
 * 2. LIGHT GUIDE RAILS: Frames shape, they don't calculate
 * 3. RECOGNIZE PATTERNS: Named states, not formulas
 * 4. DECOUPLE VIA EVENTS: Consumers subscribe, we don't call them
 */

import { type EventPayload, type IAgentRuntime, Service } from '@elizaos/core';
import {
  APPRAISAL_SERVICE_TYPE,
  type Appraisal,
  type IAppraisalService,
} from '../appraisal-types.ts';
import { AppraisalDefaults, Defaults, MotivationEvents } from '../constants.ts';
import { type Frame, getFrame, selectFrame } from '../frames/index.ts';
import {
  type Drives,
  HomeostasisEvents,
  type IHomeostasisService,
  type Physiological,
  type Resources,
} from '../homeostasis-types.ts';
import { generateGoalCandidates } from '../integration/goals.ts';
import {
  formatMotivationContext,
  generateNarrative,
} from '../narrative/generator.ts';
import { patternsToConstraints } from '../output/constraints.ts';
import { patternsToOpportunities } from '../output/opportunities.ts';
import { patternsToPriorities } from '../output/priorities.ts';
import { detectPatterns } from '../patterns/index.ts';
import { stateToSignals } from '../signals/index.ts';
import type {
  ActivePattern,
  FrameType,
  MotivationConstraint,
  MotivationOpportunity,
  MotivationPriority,
  MotivationState,
  RuntimeContext,
  SignalState,
} from '../types.ts';

/**
 * MotivationService
 *
 * Interprets homeostasis state into actionable motivation.
 * Produces priorities, constraints, opportunities, and narrative.
 */
export class MotivationService extends Service {
  static override serviceType = 'motivation';
  public readonly capabilityDescription =
    'Interprets agent drives into motivation and priorities';

  // ==========================================================================
  // STATE
  //
  // WHY CACHE STATE?
  // We cache signals, patterns, and output because:
  // 1. Recalculation is triggered by events, not polling
  // 2. Consumers may read state multiple times between updates
  // 3. We need previous state for change detection (event emission)
  // ==========================================================================

  /** Current motivation state — the public output */
  private state: MotivationState;

  /** Previous state for change detection */
  private previousState: MotivationState | null = null;

  /** Current signals (cached for debugging/inspection) */
  private signals: SignalState | null = null;

  /** Current active patterns (cached for debugging/inspection) */
  private patterns: ActivePattern[] = [];

  /** Current interpretation frame */
  private currentFrame: Frame;

  /**
   * Frame override — if set, this frame is used instead of automatic selection.
   * WHY ALLOW OVERRIDE? Some agents may want to force a specific worldview
   * (e.g., a power-hungry villain always uses power frame).
   */
  private frameOverride: FrameType | null = null;

  /** Default frame from configuration */
  private defaultFrame: FrameType;

  /**
   * Throttling state
   * WHY THROTTLE? Homeostasis may emit many events in quick succession.
   * Recalculating for each would waste CPU without meaningful updates.
   */
  private lastUpdateAt: number = 0;
  private updateThrottleMs: number;

  /** Runtime context (optional, for future V2 features) */
  private context: RuntimeContext = {};

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================

  constructor(runtime: IAgentRuntime) {
    super(runtime);

    // Load configuration from settings
    this.defaultFrame = this.getSetting(
      'MOTIVATION_DEFAULT_FRAME',
      Defaults.DEFAULT_FRAME
    ) as FrameType;
    this.updateThrottleMs = this.getSetting(
      'MOTIVATION_UPDATE_THROTTLE_MS',
      Defaults.UPDATE_THROTTLE_MS
    );

    // Initialize with default frame
    this.currentFrame = getFrame(this.defaultFrame);

    // Initialize with empty state
    this.state = this.createEmptyState();
  }

  private emitCustomEvent(
    event: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    return this.runtime.emitEvent(event, {
      runtime: this.runtime,
      source: 'motivation',
      ...payload,
    } as EventPayload);
  }

  // ==========================================================================
  // LIFECYCLE
  //
  // WHY STATIC START?
  // elizaOS services use a static factory pattern. The runtime calls
  // Service.start() to create and initialize the service instance.
  // ==========================================================================

  /**
   * Start the service.
   * Called by the runtime during plugin initialization.
   */
  static async start(runtime: IAgentRuntime): Promise<MotivationService> {
    runtime.logger.info(
      { src: 'plugin:motivation', agentId: runtime.agentId },
      'Starting Motivation service'
    );

    const service = new MotivationService(runtime);

    // Subscribe to homeostasis events
    // WHY EVENTS, NOT POLLING? Decoupling. We react to changes, not constantly check.
    service.subscribeToHomeostasis();

    // Do initial calculation if homeostasis is available
    // WHY INITIAL? Homeostasis may already have state when we start.
    await service.initialCalculation();

    runtime.logger.success(
      { src: 'plugin:motivation', agentId: runtime.agentId },
      'Motivation service started'
    );
    return service;
  }

  /**
   * Stop the service.
   */
  async stop(): Promise<void> {
    this.runtime.logger.info(
      { src: 'plugin:motivation', agentId: this.runtime.agentId },
      'Stopping Motivation service'
    );
    // No cleanup needed — event subscriptions are handled by the runtime
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Create an empty motivation state.
   * Used for initialization before first calculation.
   */
  private createEmptyState(): MotivationState {
    return {
      priorities: [],
      constraints: [],
      opportunities: [],
      dominantFrame: this.defaultFrame,
      narrative: 'Motivation state not yet calculated.',
      timestamp: Date.now(),
    };
  }

  /**
   * Subscribe to homeostasis state changes.
   *
   * WHY SUBSCRIBE TO ALL THREE?
   * - Drives: Psychological state changes → priorities change
   * - Physiological: Body state changes → may trigger survival mode
   * - Resources: Available resources → affects constraints/opportunities
   */
  private subscribeToHomeostasis(): void {
    // Subscribe to drives updated
    this.runtime.registerEvent(
      HomeostasisEvents.DRIVES_UPDATED,
      async (payload) => {
        await this.onStateChange();
      }
    );

    // Subscribe to physiological updated
    this.runtime.registerEvent(
      HomeostasisEvents.PHYSIOLOGICAL_UPDATED,
      async (payload) => {
        await this.onStateChange();
      }
    );

    // Subscribe to resources updated
    this.runtime.registerEvent(
      HomeostasisEvents.RESOURCES_UPDATED,
      async (payload) => {
        await this.onStateChange();
      }
    );

    this.runtime.logger.debug(
      { src: 'plugin:motivation', agentId: this.runtime.agentId },
      'Subscribed to homeostasis events'
    );
  }

  /**
   * Do initial calculation from current homeostasis state.
   *
   * WHY INITIAL CALCULATION?
   * Homeostasis may have been running before we started. We need to
   * calculate motivation state immediately, not wait for the next change.
   */
  private async initialCalculation(): Promise<void> {
    const homeostasis = this.runtime.getService(
      'homeostasis'
    ) as IHomeostasisService | null;

    if (!homeostasis) {
      this.runtime.logger.debug(
        { src: 'plugin:motivation', agentId: this.runtime.agentId },
        'Homeostasis not available yet'
      );
      return;
    }

    await this.recalculate();
  }

  // ==========================================================================
  // CORE CALCULATION
  //
  // This is the main interpretation pipeline. Each step transforms data
  // toward the final output.
  // ==========================================================================

  /**
   * Handle state change from homeostasis.
   *
   * This is the event handler called when any homeostasis state changes.
   * We throttle to avoid excessive recalculation.
   */
  private async onStateChange(): Promise<void> {
    // Throttle updates
    const now = Date.now();
    if (now - this.lastUpdateAt < this.updateThrottleMs) {
      return;
    }
    this.lastUpdateAt = now;

    await this.recalculate();
  }

  /**
   * Recalculate motivation state.
   *
   * THE INTERPRETATION PIPELINE:
   *
   * 1. Get raw state from homeostasis + appraisals
   *    ↓
   * 2. Convert to signals (categorical buckets)
   *    ↓
   * 3. Detect patterns (meaningful combinations)
   *    ↓
   * 4. Select interpretation frame
   *    ↓
   * 5. Filter patterns through frame
   *    ↓
   * 6. Map patterns to output (priorities, constraints, opportunities)
   *    ↓
   * 7. Generate narrative
   *    ↓
   * 8. Emit events
   */
  async recalculate(): Promise<void> {
    const homeostasis = this.runtime.getService(
      'homeostasis'
    ) as IHomeostasisService | null;

    if (!homeostasis) {
      this.runtime.logger.warn(
        { src: 'plugin:motivation', agentId: this.runtime.agentId },
        'Cannot calculate: homeostasis not available'
      );
      return;
    }

    // -------------------------------------------------------------------------
    // STEP 1: Get current homeostasis state
    // -------------------------------------------------------------------------
    const drives = homeostasis.getDrives();
    const physiological = homeostasis.getPhysiological();
    const resources = homeostasis.getResources();

    // -------------------------------------------------------------------------
    // STEP 1.5: Get current appraisals (optional)
    //
    // WHY APPRAISALS?
    // ---------------
    // Motivation was originally based only on internal state (homeostasis).
    // Appraisals add external context — what's happening in the world:
    //
    //   internal state (how I feel) + external state (what's happening)
    //                         = contextual motivation
    //
    // Example: "I want recognition (status drive low) but money is tight
    // (financial appraisal strained)" → pattern: financial_constraint
    //
    // WHY OPTIONAL?
    // -------------
    // Plugin-appraisal may not be loaded. This is fine — motivation still
    // works based on internal state alone. Appraisals enrich, not replace.
    //
    // This design follows the "graceful degradation" principle: the system
    // works at multiple levels of capability depending on what's available.
    //
    // WHY FILTER BY CONFIDENCE?
    // -------------------------
    // Low-confidence appraisals add noise without signal. If an evaluator
    // says "I'm 20% confident money is critical", acting on that could cause
    // erratic behavior. Better to ignore uncertain information.
    // -------------------------------------------------------------------------
    const appraisalService = this.runtime.getService(
      APPRAISAL_SERVICE_TYPE
    ) as IAppraisalService | null;
    const confidentAppraisals = this.getConfidentAppraisals(appraisalService);

    // -------------------------------------------------------------------------
    // STEP 2: State → Signals
    // Convert continuous values to categorical buckets.
    // WHY? Categories are interpretable; numbers are not.
    // -------------------------------------------------------------------------
    this.signals = stateToSignals(
      drives,
      physiological,
      resources,
      confidentAppraisals
    );

    // -------------------------------------------------------------------------
    // STEP 3: Signals → Patterns
    // Recognize meaningful state combinations.
    // WHY? Patterns encode contextual meaning that single values don't have.
    // -------------------------------------------------------------------------
    this.patterns = detectPatterns(this.signals);

    // -------------------------------------------------------------------------
    // STEP 4: Select frame
    // Choose the interpretation lens. Survival frame may auto-activate.
    // WHY? Different worldviews prioritize different patterns.
    // -------------------------------------------------------------------------
    const previousFrame = this.currentFrame;
    this.currentFrame = selectFrame(
      this.signals,
      this.defaultFrame,
      this.frameOverride || undefined
    );

    // -------------------------------------------------------------------------
    // STEP 5: Frame → Filter patterns
    // Apply frame's worldview to filter and reorder patterns.
    // WHY? The frame decides what surfaces to the top.
    // -------------------------------------------------------------------------
    const filteredPatterns = this.currentFrame.filterPatterns(
      this.patterns,
      this.signals
    );

    // -------------------------------------------------------------------------
    // STEP 6: Patterns → Output
    // Map patterns to priorities, constraints, and opportunities.
    // WHY? These are the structured outputs that inform decision-making.
    // -------------------------------------------------------------------------
    const priorities = patternsToPriorities(filteredPatterns);
    const constraints = patternsToConstraints(filteredPatterns);
    const opportunities = patternsToOpportunities(
      filteredPatterns,
      this.signals
    );

    // -------------------------------------------------------------------------
    // STEP 7: Generate narrative
    // Create human-readable summary for LLM context.
    // WHY? LLMs work with language, not data structures.
    // -------------------------------------------------------------------------
    const narrative = generateNarrative(
      this.currentFrame,
      priorities,
      constraints,
      opportunities
    );

    // Save previous state for change detection
    this.previousState = { ...this.state };

    // Update state
    this.state = {
      priorities,
      constraints,
      opportunities,
      dominantFrame: this.currentFrame.name,
      narrative,
      timestamp: Date.now(),
    };

    // -------------------------------------------------------------------------
    // STEP 8: Emit events
    // Notify consumers of state changes.
    // WHY? Decoupling. Consumers subscribe; we don't call them directly.
    // -------------------------------------------------------------------------
    await this.emitEvents(previousFrame);

    // -------------------------------------------------------------------------
    // STEP 9: Push motivation hint to autonomous service
    // WHY? The planning engine uses motivation hints for relevance scoring.
    // We push after recalculation so it always has the latest state.
    // -------------------------------------------------------------------------
    this.pushMotivationHint();

    // -------------------------------------------------------------------------
    // STEP 10: Generate and process goal candidates
    // WHY? High-priority needs deserve explicit goals. This bridges
    // "what matters" (motivation) to "what to do" (goals).
    // WHY AWAIT? Fire-and-forget can cause unhandled promise rejections.
    // -------------------------------------------------------------------------
    await this.processGoalCandidates();

    this.runtime.logger.debug(
      {
        src: 'plugin:motivation',
        agentId: this.runtime.agentId,
        frame: this.currentFrame.name,
        priorities: priorities.length,
        constraints: constraints.length,
        opportunities: opportunities.length,
      },
      'Motivation recalculated'
    );
  }

  /**
   * Push motivation hint to the autonomous message service.
   * This enables the planning engine to factor motivation into decisions.
   */
  private pushMotivationHint(): void {
    try {
      // Get autonomous message service if available
      const autonomousService = this.runtime.getService(
        'autonomous-message'
      ) as any;
      if (!autonomousService?.setAgentMotivation) {
        return; // Service not available - that's fine
      }

      // Generate hint from top priorities
      const topPriorities = this.state.priorities.slice(0, 3);
      const hint =
        topPriorities.length > 0
          ? topPriorities.map((p) => p.need).join(', ')
          : 'balanced';

      // Determine disposition from constraints and opportunities
      const hasHardConstraints = this.state.constraints.length > 0;
      const hasOpportunities =
        this.state.opportunities.length > 0 &&
        this.state.opportunities.some((o) => o.potential > 0.5);

      const disposition: 'conservative' | 'balanced' | 'opportunistic' =
        hasHardConstraints
          ? 'conservative'
          : hasOpportunities
            ? 'opportunistic'
            : 'balanced';

      // Push to autonomous service
      autonomousService.setAgentMotivation(
        this.runtime.agentId,
        hint,
        disposition
      );
    } catch {
      // Silently ignore errors - this is a nice-to-have integration
    }
  }

  /**
   * Process and emit goal candidates.
   *
   * WHY EMIT, NOT CREATE?
   * --------------------
   * Motivation is an interpreter, not an actor. We identify what goals
   * COULD be useful, but the decision to create them belongs to:
   *
   * - plugin-autonomous (decides what to do based on motivation)
   * - The user (may want to approve goals)
   * - Other plugins with goal-creation logic
   *
   * We emit MOTIVATION_GOAL_CANDIDATE events so interested parties can:
   * 1. See what motivation suggests
   * 2. Decide whether to create actual goals
   * 3. Modify/filter candidates before creation
   *
   * This maintains clean separation of concerns:
   * - Motivation = "what matters" (interpretation)
   * - Autonomous = "what to do" (decision)
   * - Goals = "track progress" (persistence)
   */
  private async processGoalCandidates(): Promise<void> {
    try {
      // Generate goal candidates from current motivation state
      // Uses integration/goals.ts utilities which convert priorities/opportunities
      const candidates = generateGoalCandidates(this.state, {
        minIntensity: 0.5, // Only consider meaningful priorities
        maxCandidates: 5,
        includeOpportunities: true,
        includeConstraintGoals: false, // Constraints are limits, not goals
      });

      if (candidates.length === 0) {
        return;
      }

      // Emit events for each candidate
      // WHY EVENTS? Allows plugin-autonomous or others to listen and act
      // WHY AWAIT? Ensures errors propagate to the try/catch and avoids
      // unhandled promise rejections from fire-and-forget calls.
      for (const candidate of candidates) {
        await this.emitCustomEvent(MotivationEvents.GOAL_CANDIDATE, {
          agentId: this.runtime.agentId,
          candidate,
        });
      }

      this.runtime.logger.debug(
        { src: 'plugin:motivation', candidateCount: candidates.length },
        'Emitted goal candidates'
      );
    } catch (error) {
      // Goal candidate processing is optional - don't fail the whole recalculation
      this.runtime.logger.debug(
        {
          src: 'plugin:motivation',
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to process goal candidates'
      );
    }
  }

  /**
   * Emit events for state changes.
   *
   * WHY MULTIPLE EVENTS?
   * Different consumers care about different things:
   * - Some want any update (UPDATED)
   * - Some only care when priorities change (PRIORITIES_CHANGED)
   * - Some need to know about new constraints (CONSTRAINT_ACTIVATED)
   * - Some need to know about frame shifts (FRAME_SHIFTED)
   */
  private async emitEvents(previousFrame: Frame): Promise<void> {
    // Always emit updated event
    await this.emitCustomEvent(MotivationEvents.UPDATED, {
      agentId: this.runtime.agentId,
      state: this.state,
      previousState: this.previousState,
    });

    // Check for frame shift
    if (previousFrame.name !== this.currentFrame.name) {
      await this.emitCustomEvent(MotivationEvents.FRAME_SHIFTED, {
        agentId: this.runtime.agentId,
        newFrame: this.currentFrame.name,
        previousFrame: previousFrame.name,
        reason: 'state_change',
      });
    }

    // Check for new constraints
    if (this.previousState) {
      const previousTypes = new Set(
        this.previousState.constraints.map((c) => c.type)
      );
      for (const constraint of this.state.constraints) {
        if (!previousTypes.has(constraint.type)) {
          await this.emitCustomEvent(MotivationEvents.CONSTRAINT_ACTIVATED, {
            agentId: this.runtime.agentId,
            constraint,
          });
        }
      }
    }

    // Check for priority changes
    if (this.previousState) {
      const previousNeeds = this.previousState.priorities
        .map((p) => p.need)
        .join(',');
      const currentNeeds = this.state.priorities.map((p) => p.need).join(',');

      if (previousNeeds !== currentNeeds) {
        await this.emitCustomEvent(MotivationEvents.PRIORITIES_CHANGED, {
          agentId: this.runtime.agentId,
          priorities: this.state.priorities,
          previousPriorities: this.previousState.priorities,
        });
      }
    }
  }

  // ==========================================================================
  // PUBLIC API - READ
  //
  // These methods allow consumers to read current motivation state.
  // All return copies to prevent external mutation.
  // ==========================================================================

  /**
   * Get current motivation state.
   * This is the main API for accessing motivation.
   */
  getState(): MotivationState {
    return { ...this.state };
  }

  /**
   * Get motivation state in the format expected by plugin-autonomous.
   *
   * WHY THIS ADAPTER METHOD?
   * ------------------------
   * plugin-autonomous was designed before plugin-motivation was finalized.
   * It expects a slightly different interface:
   * - priorities with {id, label, intensity, source}
   * - constraints with {id, description, severity}
   * - opportunities with {id, description, relevance}
   * - disposition (derived from frame and constraints)
   *
   * This method adapts our internal format to what autonomous expects.
   * We maintain both formats for backward compatibility and clean separation.
   *
   * USED BY: plugin-autonomous/src/phase3/service.ts getMotivationState()
   */
  getMotivationState(): {
    priorities: Array<{
      id: string;
      label: string;
      intensity: number;
      source: string;
    }>;
    constraints: Array<{
      id: string;
      description: string;
      severity: 'hard' | 'soft';
    }>;
    opportunities: Array<{
      id: string;
      description: string;
      relevance: number;
    }>;
    disposition: 'conservative' | 'balanced' | 'opportunistic';
  } | null {
    // WHY ALL THREE? Only return null when truly empty. If opportunities exist
    // but priorities/constraints don't, we should still return the opportunities.
    if (
      !this.state.priorities.length &&
      !this.state.constraints.length &&
      !this.state.opportunities.length
    ) {
      return null;
    }

    // Map priorities to autonomous format
    const priorities = this.state.priorities.map((p) => ({
      id: p.need,
      label: p.rationale || p.need.replace(/_/g, ' '),
      intensity: p.intensity,
      source: p.drivers.join(', ') || 'motivation',
    }));

    // Map constraints to autonomous format
    // WHY 'soft' default? Most motivation constraints are guidance, not hard blocks
    const constraints = this.state.constraints.map((c) => ({
      id: c.type,
      description: `${c.guidance} (${c.because})`,
      severity: 'soft' as const,
    }));

    // Map opportunities to autonomous format
    const opportunities = this.state.opportunities.map((o) => ({
      id: o.type,
      description: `${o.type.replace(/_/g, ' ')} (${o.because})`,
      relevance: o.potential,
    }));

    // Derive disposition from frame and constraints
    // - survival/foundation_shaky → conservative
    // - stable_foundation with opportunities → opportunistic
    // - otherwise → balanced
    const hasHardConstraints =
      this.state.constraints.length > 0 &&
      this.patterns.some(
        (p) => p.id === 'survival_mode' || p.id === 'foundation_shaky'
      );
    const hasGoodOpportunities =
      this.state.opportunities.length > 0 &&
      this.state.opportunities.some((o) => o.potential > 0.5);

    const disposition: 'conservative' | 'balanced' | 'opportunistic' =
      hasHardConstraints
        ? 'conservative'
        : hasGoodOpportunities
          ? 'opportunistic'
          : 'balanced';

    return {
      priorities,
      constraints,
      opportunities,
      disposition,
    };
  }

  /**
   * Get current priorities.
   * Convenience method for consumers that only need priorities.
   */
  getPriorities(): MotivationPriority[] {
    return [...this.state.priorities];
  }

  /**
   * Get current constraints.
   */
  getConstraints(): MotivationConstraint[] {
    return [...this.state.constraints];
  }

  /**
   * Get current opportunities.
   */
  getOpportunities(): MotivationOpportunity[] {
    return [...this.state.opportunities];
  }

  /**
   * Get current narrative.
   */
  getNarrative(): string {
    return this.state.narrative;
  }

  /**
   * Get dominant frame.
   */
  getDominantFrame(): FrameType {
    return this.state.dominantFrame;
  }

  /**
   * Get current signals (for debugging).
   */
  getSignals(): SignalState | null {
    return this.signals ? { ...this.signals } : null;
  }

  /**
   * Get current patterns (for debugging).
   */
  getPatterns(): ActivePattern[] {
    return [...this.patterns];
  }

  /**
   * Get formatted context for LLM injection.
   * This is what the provider uses to build prompt context.
   */
  getFormattedContext(): string {
    return formatMotivationContext(
      this.currentFrame,
      this.state.priorities,
      this.state.constraints,
      this.state.opportunities,
      this.state.narrative
    );
  }

  // ==========================================================================
  // PUBLIC API - WRITE
  // ==========================================================================

  /**
   * Set frame override.
   *
   * WHY ALLOW THIS?
   * Some agents or scenarios may need a specific worldview. A power-hungry
   * character should use power frame; a social agent should use a frame
   * that prioritizes connection.
   *
   * Pass null to clear override and use automatic frame selection.
   */
  setFrameOverride(frame: FrameType | null): void {
    this.frameOverride = frame;

    // Recalculate with new frame
    this.recalculate().catch((err) => {
      this.runtime.logger.error(
        { src: 'plugin:motivation', error: err },
        'Failed to recalculate after frame override'
      );
    });
  }

  /**
   * Update runtime context.
   *
   * WHY CONTEXT?
   * V2 feature: context about current task, audience, time pressure, etc.
   * can influence motivation interpretation. For now, we store it but
   * don't use it in calculations.
   */
  updateContext(context: Partial<RuntimeContext>): void {
    this.context = { ...this.context, ...context };

    // Context changes might affect interpretation
    // For V0, we don't use context in calculation, but it's prepared for V2
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Get setting with default value.
   *
   * WHY WRAPPER?
   * Provides type-safe access to settings with defaults, handling the case
   * where settings may be undefined or wrong type.
   */
  private getSetting(key: string, defaultValue: string): string;
  private getSetting(key: string, defaultValue: number): number;
  private getSetting(
    key: string,
    defaultValue: string | number
  ): string | number {
    const value = this.runtime.getSetting(key);
    if (value === null || value === undefined) return defaultValue;
    if (typeof defaultValue === 'number') return Number(value);
    return String(value);
  }

  /**
   * Get appraisals filtered by confidence threshold.
   *
   * WHY FILTER BY CONFIDENCE?
   * Low-confidence appraisals represent uncertainty from the evaluator.
   * Acting on uncertain information can lead to erratic behavior.
   * By filtering out low-confidence appraisals, we only incorporate
   * situational awareness that the evaluator is reasonably sure about.
   *
   * WHY GRACEFUL DEGRADATION?
   * Plugin-appraisal is optional. If it's not loaded, we return an empty
   * record and motivation continues to work based solely on homeostasis.
   * This ensures the plugin is resilient to different configurations.
   *
   * @param appraisalService - The appraisal service (may be null)
   * @returns Record of domain → appraisal for confident appraisals only
   */
  private getConfidentAppraisals(
    appraisalService: IAppraisalService | null
  ): Record<string, Appraisal> {
    // Graceful degradation: no appraisal service → no situational signals
    if (!appraisalService) {
      return {};
    }

    const allAppraisals = appraisalService.getAll();
    const confident: Record<string, Appraisal> = {};

    for (const [domain, appraisal] of Object.entries(allAppraisals)) {
      // Only include appraisals above the confidence threshold
      if (appraisal.confidence >= AppraisalDefaults.CONFIDENCE_THRESHOLD) {
        confident[domain] = appraisal;
      }
    }

    // Log what we're incorporating (debug level)
    const domains = Object.keys(confident);
    if (domains.length > 0) {
      this.runtime.logger.debug(
        {
          src: 'plugin:motivation',
          agentId: this.runtime.agentId,
          domains,
          count: domains.length,
        },
        'Incorporating situational appraisals'
      );
    }

    return confident;
  }
}
