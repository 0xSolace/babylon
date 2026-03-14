/**
 * Appraisal Refresh Worker
 *
 * =============================================================================
 * WHY THIS WORKER EXISTS
 * =============================================================================
 *
 * Appraisals represent the agent's understanding of external situations.
 * Over time, this understanding becomes less reliable:
 *
 * - Money situation changes (transactions, market movements)
 * - Power dynamics shift (relationships, influence)
 * - Reputation evolves (new interactions, events)
 *
 * Rather than hard expiry (appraisals disappear), we use CONFIDENCE DECAY:
 * old appraisals remain but their confidence gradually decreases, signaling
 * increasing uncertainty.
 *
 * =============================================================================
 * HOW IT WORKS
 * =============================================================================
 *
 * 1. Plugin registers this task worker on init
 * 2. Plugin creates a single APPRAISAL_REFRESH task (if not exists)
 * 3. TaskService polls this task every N seconds (configurable)
 * 4. Worker checks all appraisals for staleness
 * 5. Stale appraisals have confidence reduced by decay rate
 * 6. Very low confidence triggers 'appraisal:refresh_needed' event
 * 7. Domain evaluators listen and re-run their evaluation
 *
 * =============================================================================
 * WHY EVENT-DRIVEN REFRESH?
 * =============================================================================
 *
 * We don't re-compute appraisals ourselves - we emit events that domain
 * evaluators respond to. This maintains clean separation:
 *
 * - plugin-appraisal: Registry and lifecycle management
 * - Domain evaluators: Domain-specific logic and computation
 *
 * If we computed appraisals here, we'd need to know about every domain's
 * logic, creating tight coupling.
 *
 * =============================================================================
 * CONFIGURATION
 * =============================================================================
 *
 * Settings (in character.settings or .env):
 *
 * - APPRAISAL_REFRESH_INTERVAL: How often to check (default: 5 min)
 *   WHY 5 MINUTES? Balances freshness with overhead. Too frequent wastes
 *   resources, too infrequent allows stale data.
 *
 * - APPRAISAL_STALENESS_THRESHOLD: Age before considered stale (default: 15 min)
 *   WHY 15 MINUTES? Most evaluators should update within this window.
 *   Longer suggests the evaluator isn't running or data is stagnant.
 *
 * - APPRAISAL_CONFIDENCE_DECAY_RATE: Per-check decay (default: 0.1 = 10%)
 *   WHY 10%? Gradual decay over 5-10 checks before confidence drops below
 *   useful thresholds. Not too aggressive, not too slow.
 *
 * @module appraisal-refresh
 */

import type { IAgentRuntime, Task, TaskWorker } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { APPRAISAL_SERVICE_TYPE, AppraisalEvents } from '../constants.ts';
import type { AppraisalService } from '../services/appraisal-service.ts';
import type { Appraisal } from '../types.ts';

// ============================================================================
// Constants
// ============================================================================

/** Task name for the appraisal refresh worker */
export const APPRAISAL_REFRESH_TASK = 'appraisal:refresh_check';

/** Default interval between refresh checks (5 minutes) */
export const APPRAISAL_REFRESH_INTERVAL = 5 * 60 * 1000;

/** Default age before an appraisal is considered stale (15 minutes) */
export const APPRAISAL_STALENESS_THRESHOLD = 15 * 60 * 1000;

/** Default confidence decay rate per check (10%) */
export const APPRAISAL_CONFIDENCE_DECAY_RATE = 0.1;

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event payload when an appraisal needs refresh
 */
export interface AppraisalRefreshNeededEvent {
  /** ID of the appraisal that needs refresh */
  appraisalId: string;
  /** Source plugin that should re-evaluate */
  source: string;
  /** How old the appraisal is (ms) */
  age: number;
  /** Current confidence (may have decayed) */
  currentConfidence: number;
  /** Reason for refresh request */
  reason: 'stale' | 'low_confidence' | 'manual';
}

/**
 * Event payload for confidence decay
 */
export interface AppraisalConfidenceDecayedEvent {
  /** ID of the appraisal */
  appraisalId: string;
  /** Previous confidence */
  previousConfidence: number;
  /** New confidence after decay */
  newConfidence: number;
}

// ============================================================================
// Task Worker
// ============================================================================

/**
 * Task worker that checks for stale appraisals and triggers refresh
 */
export const appraisalRefreshWorker: TaskWorker = {
  name: APPRAISAL_REFRESH_TASK,

  /**
   * Execute the appraisal refresh check
   */
  execute: async (
    runtime: IAgentRuntime,
    _options: Record<string, unknown>,
    _task: Task
  ): Promise<void> => {
    const appraisalService = runtime.getService(
      APPRAISAL_SERVICE_TYPE
    ) as AppraisalService;

    if (!appraisalService) {
      logger.debug(
        { src: 'plugin:appraisal', task: APPRAISAL_REFRESH_TASK },
        'AppraisalService not available, skipping refresh check'
      );
      return;
    }

    try {
      // Get configuration from settings
      // WHY FROM SETTINGS?
      // Allows per-character customization. A high-frequency trading agent
      // might need faster refresh than a long-term strategy agent.
      const settings = runtime.character?.settings as
        | Record<string, unknown>
        | undefined;

      // WHY Number() WITH NaN CHECK?
      // Settings are stored as strings (from .env) or may be numbers (from JSON).
      // Number() safely converts both, returning NaN for invalid values.
      // We use Number.isNaN() to check for invalid values, NOT the || operator,
      // because || would treat explicit 0 as falsy and incorrectly use the default.
      // This allows setting staleness threshold or decay rate to 0 if needed.
      const stalenessThresholdValue = Number(
        settings?.APPRAISAL_STALENESS_THRESHOLD
      );
      const stalenessThreshold = Number.isNaN(stalenessThresholdValue)
        ? APPRAISAL_STALENESS_THRESHOLD
        : stalenessThresholdValue;

      const decayRateValue = Number(settings?.APPRAISAL_CONFIDENCE_DECAY_RATE);
      const decayRate = Number.isNaN(decayRateValue)
        ? APPRAISAL_CONFIDENCE_DECAY_RATE
        : decayRateValue;

      const now = Date.now();
      const appraisalsMap = appraisalService.getAll();
      const appraisals = Object.values(appraisalsMap);
      let staleCount = 0;
      let decayedCount = 0;

      for (const appraisal of appraisals) {
        const age = now - appraisal.ts;

        // Check if stale
        // WHY CHECK AGE?
        // Only decay confidence for appraisals that haven't been updated
        // recently. Fresh appraisals (< threshold) are still reliable.
        if (age > stalenessThreshold) {
          staleCount++;

          // Apply confidence decay
          // WHY DECAY CONFIDENCE?
          // Gradual reduction signals increasing uncertainty without
          // removing the appraisal entirely. The agent still has some
          // information, just less reliable.
          const previousConfidence = appraisal.confidence;
          const newConfidence = Math.max(0, previousConfidence - decayRate);

          if (newConfidence !== previousConfidence) {
            // Update the appraisal with decayed confidence
            // WHY PUBLISH INSTEAD OF DIRECT UPDATE?
            // Goes through normal validation and event emission. Maintains
            // consistency with how appraisals are always updated.
            appraisalService.publish({
              ...appraisal,
              confidence: newConfidence,
              ts: appraisal.ts, // WHY KEEP ORIGINAL? Preserves true age for staleness tracking
            } as Appraisal<unknown>);

            decayedCount++;

            // Emit decay event
            await runtime.emitEvent('appraisal:confidence_decayed', {
              runtime,
              source: 'appraisal-refresh',
              appraisalId: appraisal.id,
              previousConfidence,
              newConfidence,
            } as AppraisalConfidenceDecayedEvent & {
              runtime: IAgentRuntime;
              source: string;
            });
          }

          // If confidence is very low, request refresh from source
          // WHY 0.3 THRESHOLD?
          // Below 30% confidence, the appraisal is unreliable enough that
          // we should ask the evaluator to re-assess. This balances:
          // - Avoiding unnecessary work (don't refresh at 80% confidence)
          // - Ensuring data quality (don't wait until 0% confidence)
          // - Giving evaluators time to respond before data is useless
          if (newConfidence < 0.3) {
            // WHY EMIT EVENT?
            // Domain evaluators listen for this and can decide whether to
            // re-evaluate. They might skip if they're busy or if the domain
            // isn't critical right now.
            await runtime.emitEvent('appraisal:refresh_needed', {
              runtime,
              source: appraisal.source,
              appraisalId: appraisal.id,
              age,
              currentConfidence: newConfidence,
              reason: 'stale',
            } as AppraisalRefreshNeededEvent & {
              runtime: IAgentRuntime;
              source: string;
            });
          }
        }
      }

      if (staleCount > 0) {
        logger.info(
          {
            src: 'plugin:appraisal',
            task: APPRAISAL_REFRESH_TASK,
            staleCount,
            decayedCount,
            totalAppraisals: appraisals.length,
          },
          `Appraisal refresh: ${staleCount} stale, ${decayedCount} decayed`
        );
      } else {
        logger.debug(
          { src: 'plugin:appraisal', task: APPRAISAL_REFRESH_TASK },
          'No stale appraisals found'
        );
      }
    } catch (error) {
      logger.error(
        { src: 'plugin:appraisal', task: APPRAISAL_REFRESH_TASK, error },
        'Error during appraisal refresh check'
      );
    }
  },
};

// ============================================================================
// Task Registration
// ============================================================================

/**
 * Register the appraisal refresh task if it doesn't exist
 */
export async function ensureAppraisalRefreshTask(
  runtime: IAgentRuntime
): Promise<void> {
  try {
    // Get configuration from settings
    const settings = runtime.character?.settings as
      | Record<string, unknown>
      | undefined;
    const refreshInterval =
      Number(settings?.APPRAISAL_REFRESH_INTERVAL) ||
      APPRAISAL_REFRESH_INTERVAL;

    // Check if task already exists
    const existingTasks = await runtime.getTasksByName(APPRAISAL_REFRESH_TASK);

    if (existingTasks.length > 0) {
      logger.debug(
        { src: 'plugin:appraisal', taskCount: existingTasks.length },
        'Appraisal refresh task already exists'
      );
      return;
    }

    // Create the recurring appraisal refresh task
    await runtime.createTask({
      name: APPRAISAL_REFRESH_TASK,
      description:
        'Periodically check appraisals for staleness and decay confidence',
      roomId: runtime.agentId,
      worldId: undefined,
      tags: ['queue', 'repeat', 'system'],
      metadata: {
        updateInterval: refreshInterval,
      },
    });

    logger.info(
      {
        src: 'plugin:appraisal',
        interval: `${refreshInterval / 1000}s`,
      },
      'Created appraisal refresh task'
    );
  } catch (error) {
    logger.error(
      { src: 'plugin:appraisal', error },
      'Failed to create appraisal refresh task'
    );
  }
}

export default appraisalRefreshWorker;
