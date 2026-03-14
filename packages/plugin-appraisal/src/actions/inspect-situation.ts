/**
 * @fileoverview InspectSituation Action - Debugging tool for motivation flow
 *
 * =============================================================================
 * WHY THIS ACTION EXISTS
 * =============================================================================
 *
 * When debugging agent behavior, you need visibility into the decision-making
 * pipeline. This action provides a complete snapshot of the agent's situational
 * awareness across all three layers:
 *
 * 1. APPRAISALS (external situation)
 *    What domain evaluators are reporting about the world
 *
 * 2. HOMEOSTASIS (internal state)
 *    How the agent feels internally (drives, resources, physiology)
 *
 * 3. MOTIVATION (interpretation)
 *    What the agent has decided to prioritize based on 1 + 2
 *
 * =============================================================================
 * USE CASES
 * =============================================================================
 *
 * - **Debugging**: "Why is the agent behaving this way?"
 * - **Verification**: "Are evaluators publishing correctly?"
 * - **Understanding**: "What does the agent know about its situation?"
 * - **Testing**: "Did my evaluator changes take effect?"
 *
 * =============================================================================
 * DESIGN DECISIONS
 * =============================================================================
 *
 * WHY AN ACTION (not just a provider)?
 * - Actions can be triggered on-demand by users or developers
 * - Providers run automatically during composeState (overhead)
 * - This is debugging info, not always-needed context
 *
 * WHY INCLUDE ALL THREE LAYERS?
 * - Complete picture: external + internal → priorities
 * - Debugging requires seeing the full flow
 * - Missing any layer makes diagnosis harder
 *
 * WHY FORMATTED TEXT OUTPUT?
 * - Human-readable for developers and users
 * - Markdown formatting for rich display
 * - JSON blocks for structured data inspection
 */

import type {
  Action,
  ActionExample,
  ActionResult,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core';
import { APPRAISAL_SERVICE_TYPE } from '../constants.ts';
import type { AppraisalService } from '../services/appraisal-service.ts';
import type { Appraisal } from '../types.ts';

/**
 * Format an appraisal for display.
 *
 * WHY THIS FORMAT?
 * - **Bold domain name**: Easy to scan when looking for specific domains
 * - **Separate lines**: Each field gets its own line for clarity
 * - **Indented fields**: Visual hierarchy shows structure
 * - **JSON payload**: Preserves structure, shows actual data
 * - **Indented JSON**: Aligns with field indentation for consistency
 *
 * WHY NOT TABLE FORMAT?
 * Tables are compact but harder to read when payloads vary in size.
 * This format handles any payload shape gracefully.
 *
 * @param appraisal - The appraisal to format
 * @returns Formatted string with domain name, metadata, and payload
 */
function formatAppraisal(appraisal: Appraisal): string {
  const ageMs = Date.now() - appraisal.ts;
  const ageStr = formatAge(ageMs);
  const confidencePercent = Math.round(appraisal.confidence * 100);

  const lines: string[] = [];
  lines.push(`  **${appraisal.id}**`);
  lines.push(`    Confidence: ${confidencePercent}%`);
  lines.push(`    Source: ${appraisal.source}`);
  lines.push(`    Age: ${ageStr}`);
  lines.push(
    `    Payload: ${JSON.stringify(appraisal.payload, null, 2).replace(/\n/g, '\n    ')}`
  );

  return lines.join('\n');
}

/**
 * Format milliseconds as human-readable age.
 *
 * WHY HUMAN-READABLE?
 * "30s ago" is instantly understood. "30000ms ago" requires mental math.
 * This is debugging output for humans, not machines.
 *
 * WHY THESE TIME BUCKETS?
 * - "just now" (<1s): Emphasizes freshness, no precision needed
 * - "Xs ago" (<1m): Second precision for recent updates
 * - "Xm ago" (<1h): Minute precision for medium-age data
 * - "Xh ago" (≥1h): Hour precision for old data (exact minutes don't matter)
 *
 * @param ms - Age in milliseconds
 * @returns Human-readable string like "30s ago" or "2m ago"
 */
function formatAge(ms: number): string {
  if (ms < 1000) return 'just now';
  if (ms < 60000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
  return `${Math.round(ms / 3600000)}h ago`;
}

/**
 * InspectSituation Action
 *
 * Displays the current state of all situational awareness systems.
 */
export const inspectSituationAction: Action = {
  name: 'INSPECT_SITUATION',

  description:
    'Show current situational awareness - all appraisals, homeostasis, and motivation state',

  /**
   * Alternative action names for LLM matching.
   *
   * WHY THESE SIMILES?
   * Different users/developers will phrase the request differently:
   * - SHOW_APPRAISALS: Direct request for appraisal data
   * - DEBUG_SITUATION: Developer debugging terminology
   * - SITUATION_STATUS: Status check phrasing
   * - WHATS_MY_SITUATION: Natural language query
   * - MOTIVATION_DEBUG: When debugging motivation specifically
   * - APPRAISAL_DEBUG: When debugging appraisals specifically
   *
   * The LLM uses these to match user intent to this action.
   */
  similes: [
    'SHOW_APPRAISALS',
    'DEBUG_SITUATION',
    'SITUATION_STATUS',
    'WHATS_MY_SITUATION',
    'MOTIVATION_DEBUG',
    'APPRAISAL_DEBUG',
  ],

  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'What is your current situation?' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Let me check my situational awareness...',
          action: 'INSPECT_SITUATION',
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Debug your appraisals' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: "Here's my current situational snapshot:",
          action: 'INSPECT_SITUATION',
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Show me your motivation state' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Checking my internal and external state...',
          action: 'INSPECT_SITUATION',
        },
      },
    ],
  ] as ActionExample[][],

  /**
   * Validate: Always available for debugging.
   *
   * WHY ALWAYS TRUE?
   * This is a debugging/inspection action that should always be available.
   * There are no preconditions - any user or developer can inspect the
   * agent's situational awareness at any time.
   *
   * WHY NO PERMISSION CHECK?
   * Situational awareness is not sensitive data. It's the agent's view
   * of its own state, which should be transparent for debugging.
   *
   * @returns Always true - action is always available
   */
  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory
  ): Promise<boolean> => {
    return true;
  },

  /**
   * Handler: Gather and display all situational data.
   */
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const sections: string[] = [];

    // =========================================================================
    // APPRAISALS SECTION
    // =========================================================================
    // WHY FIRST?
    // Appraisals are the external situation - the foundation of the agent's
    // awareness. We show them first because they're the input to motivation.

    const appraisalService = runtime.getService(
      APPRAISAL_SERVICE_TYPE
    ) as AppraisalService | null;

    // WHY CHECK FOR NULL?
    // The service might not be available if:
    // - plugin-appraisal wasn't loaded
    // - Service failed to start
    // - Runtime hasn't fully initialized
    // We handle gracefully rather than crashing.
    if (appraisalService) {
      const appraisals = appraisalService.getAll();
      const ids = appraisalService.getIds();

      sections.push('## 📊 Appraisals (External Situation)\n');

      if (ids.length === 0) {
        sections.push('*No appraisals registered.*\n');
      } else {
        sections.push(`Registered domains: ${ids.join(', ')}\n`);

        for (const id of ids) {
          const appraisal = appraisals[id];
          if (appraisal) {
            sections.push(formatAppraisal(appraisal));
            sections.push('');
          }
        }
      }
    } else {
      sections.push('## 📊 Appraisals\n');
      sections.push('*Appraisal service not available.*\n');
    }

    // =========================================================================
    // HOMEOSTASIS SECTION (if available)
    // =========================================================================

    const homeostasisService = runtime.getService('homeostasis') as any;

    sections.push('## 🫀 Homeostasis (Internal State)\n');

    if (
      homeostasisService &&
      typeof homeostasisService.getState === 'function'
    ) {
      try {
        const state = homeostasisService.getState();
        if (state) {
          sections.push('```json');
          sections.push(JSON.stringify(state, null, 2));
          sections.push('```');
        } else {
          sections.push('*Homeostasis state not initialized.*');
        }
      } catch (error) {
        sections.push('*Error reading homeostasis state.*');
      }
    } else {
      sections.push('*Homeostasis service not available.*');
    }

    sections.push('');

    // =========================================================================
    // MOTIVATION SECTION (if available)
    // =========================================================================
    // WHY THIRD?
    // Motivation is the interpretation of appraisals + homeostasis.
    // Showing it last demonstrates the flow: external + internal → priorities.

    // WHY `as any`?
    // Same rationale as homeostasis - avoid circular dependency with
    // plugin-motivation. We check method existence before calling.
    const motivationService = runtime.getService('motivation') as any;

    sections.push('## 🎯 Motivation (Interpretation)\n');

    if (
      motivationService &&
      typeof motivationService.getCurrentMotivation === 'function'
    ) {
      try {
        const motivation = motivationService.getCurrentMotivation();
        if (motivation) {
          sections.push('```json');
          sections.push(JSON.stringify(motivation, null, 2));
          sections.push('```');
        } else {
          sections.push('*Motivation not computed yet.*');
        }
      } catch (error) {
        sections.push('*Error reading motivation state.*');
      }
    } else {
      sections.push('*Motivation service not available.*');
    }

    sections.push('');

    // =========================================================================
    // SUMMARY SECTION
    // =========================================================================
    // WHY SUMMARY?
    // After detailed sections, provide a quick overview for scanning.
    // Highlights key metrics and critical issues without requiring
    // reading through all the detailed data.

    sections.push('## 📋 Summary\n');

    const summary: string[] = [];

    // Appraisal summary
    if (appraisalService) {
      const appraisals = appraisalService.getAll();
      const ids = Object.keys(appraisals);

      if (ids.length > 0) {
        const avgConfidence =
          ids.reduce((sum, id) => sum + appraisals[id].confidence, 0) /
          ids.length;

        summary.push(`- **Appraisals:** ${ids.length} domains tracked`);
        summary.push(
          `- **Avg Confidence:** ${Math.round(avgConfidence * 100)}%`
        );

        // Find any critical/urgent appraisals
        const critical: string[] = [];
        for (const id of ids) {
          const payload = appraisals[id].payload as Record<string, unknown>;
          if (
            payload.status === 'critical' ||
            payload.status === 'vulnerable'
          ) {
            critical.push(id);
          }
        }

        if (critical.length > 0) {
          summary.push(`- **⚠️ Critical domains:** ${critical.join(', ')}`);
        }
      } else {
        summary.push('- **Appraisals:** None registered');
      }
    }

    // Homeostasis summary
    if (
      homeostasisService &&
      typeof homeostasisService.getState === 'function'
    ) {
      try {
        const state = homeostasisService.getState();
        if (state) {
          // Look for low values that might indicate issues
          const lowValues: string[] = [];
          for (const [key, value] of Object.entries(state)) {
            if (typeof value === 'number' && value < 0.3) {
              lowValues.push(`${key}: ${Math.round((value as number) * 100)}%`);
            }
          }
          if (lowValues.length > 0) {
            summary.push(
              `- **⚠️ Low internal states:** ${lowValues.join(', ')}`
            );
          } else {
            summary.push('- **Internal state:** All values normal');
          }
        }
      } catch {
        // Ignore errors
      }
    }

    sections.push(summary.join('\n'));

    // =========================================================================
    // OUTPUT
    // =========================================================================

    const output = sections.join('\n');

    runtime.logger.info(
      { src: 'plugin:appraisal', action: 'INSPECT_SITUATION' },
      'Situation inspection requested'
    );

    if (callback) {
      await callback({
        text: output,
        action: 'INSPECT_SITUATION_RESULT',
      });
    }

    return {
      success: true,
      text: output,
      data: {
        messageId: message.id,
      },
    };
  },
};

export default inspectSituationAction;
