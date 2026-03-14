/**
 * @fileoverview Plugin info providers for the Appraisal plugin.
 *
 * =============================================================================
 * WHY THESE PROVIDERS EXIST
 * =============================================================================
 *
 * These providers serve a different purpose than appraisalProvider:
 *
 * - appraisalProvider: DATA - The actual appraisal snapshot
 * - appraisalInstructionsProvider: DOCUMENTATION - How the system works
 * - appraisalSettingsProvider: STATUS - Current plugin state
 *
 * WHY SEPARATE PROVIDERS?
 *
 * 1. SEPARATION OF CONCERNS
 *    Data, documentation, and status are different things. Separating them
 *    allows selective inclusion in prompts.
 *
 * 2. TOKEN EFFICIENCY
 *    If an agent doesn't need instructions (already in system prompt),
 *    it can exclude this provider and save tokens.
 *
 * 3. DEBUGGING
 *    The status provider helps diagnose issues: "Are there any appraisals?
 *    What domains are registered?" without needing external tools.
 *
 * =============================================================================
 * WHY DOCUMENTATION IN LLM CONTEXT?
 * =============================================================================
 *
 * LLMs don't have inherent knowledge of plugin-appraisal. They need to be
 * told what appraisals are and how to interpret them.
 *
 * OPTION A: Put in system prompt (external to plugin)
 * OPTION B: Have the plugin inject its own docs (this approach)
 *
 * We chose B because:
 * - Self-contained: Plugin brings its own documentation
 * - Up-to-date: Docs change when plugin changes
 * - Consistent: Same explanation across all agents using this plugin
 */

import type { IAgentRuntime, Provider, ProviderResult } from '@elizaos/core';
import { APPRAISAL_SERVICE_TYPE } from '../constants.ts';
import type { AppraisalService } from '../services/appraisal-service.ts';

/**
 * Provides instructions and capabilities for the Appraisal plugin.
 *
 * WHY THIS PROVIDER?
 * The LLM needs to understand what appraisals are and how they fit into
 * the agent's decision-making. This provider injects that knowledge.
 *
 * WHEN TO INCLUDE:
 * - First interaction with a user (LLM doesn't know what appraisals are)
 * - When appraisal-related reasoning is needed
 *
 * WHEN TO EXCLUDE:
 * - System prompt already covers this
 * - Token budget is tight and LLM already knows
 *
 * WHY STATIC (dynamic: false)?
 * Instructions don't change at runtime. The documentation is the same
 * every time. This allows caching and saves computation.
 */
export const appraisalInstructionsProvider: Provider = {
  /**
   * Provider name.
   *
   * WHY 'AppraisalPluginInfo'?
   * - Clear: It's info about the appraisal plugin
   * - Different from 'APPRAISALS' (the data provider)
   * - Discoverable: Easy to find in provider lists
   */
  name: 'AppraisalPluginInfo',

  /**
   * Human-readable description.
   *
   * WHY?
   * Helps developers and debugging tools understand what this provider does.
   */
  description:
    'Provides instructions and capabilities for the Appraisal plugin.',

  /**
   * Whether this provider's output changes between calls.
   *
   * WHY FALSE?
   * Instructions are static documentation. They don't change based on
   * current appraisals or runtime state. Marking as static allows
   * the system to cache this output.
   */
  dynamic: false,

  /**
   * Get the instructions.
   *
   * @param _runtime - Unused, but required by interface
   * @returns Provider result with instruction text
   */
  get: async (_runtime: IAgentRuntime): Promise<ProviderResult> => {
    // WHY INLINE TEXT?
    // The documentation is short enough to include inline. For longer
    // docs, we might load from a markdown file, but this is simpler.
    //
    // WHY THIS STRUCTURE?
    // - Header explains the purpose
    // - Key Concepts define terms
    // - Architecture shows the relationship
    // - What Appraisals Provide explains the value
    // - Design Principles help the LLM reason correctly
    const instructions = `
# Appraisal Plugin Instructions

The Appraisal plugin maintains a registry of situational appraisals - domain evaluator outputs that describe your external circumstances (money situation, power dynamics, reputation, etc.).

## Key Concepts:

- **Appraisal**: A domain evaluator's assessment of an external factor.
- **Domain**: A specific area (e.g., 'money', 'power', 'notoriety').
- **Confidence**: How certain the evaluator is about the assessment (0-1).

## Architecture:

\`\`\`
homeostasis (internal state) + appraisal (external situation) → motivation (priorities)
\`\`\`

- **Homeostasis**: How you feel inside (hunger, fatigue, drives).
- **Appraisal**: What's happening outside (financial position, influence, reputation).
- **Motivation**: What to do about it (priorities, constraints, opportunities).

## What Appraisals Provide:

Appraisals give you situational awareness without interpretation. They tell you:
- Current assessment of each domain
- Confidence in that assessment
- When it was last updated

The Motivation plugin reads appraisals to determine priorities. Actions and behaviors are informed by both internal state (homeostasis) and external situation (appraisals).

## Design Principles:

- **Appraisals are facts, not directives**: They describe the situation, not what to do.
- **Latest wins**: When a domain updates, the new assessment replaces the old.
- **Confidence matters**: Low confidence means uncertain assessment.
- **No expiry**: Appraisals stay until replaced or explicitly cleared.
`;
    return { text: instructions.trim() };
  },
};

/**
 * Provides current status of the Appraisal plugin.
 *
 * WHY THIS PROVIDER?
 * Debugging and self-awareness. The agent (or developer) can check:
 * - Is the service running?
 * - What domains are registered?
 * - What's the confidence of each?
 *
 * WHEN TO INCLUDE:
 * - Debugging issues ("Why doesn't the agent know about money?")
 * - Agent self-reflection ("What do I know about my situation?")
 *
 * WHY DYNAMIC?
 * The status changes as appraisals are published/cleared.
 * Each call should reflect current state.
 */
export const appraisalSettingsProvider: Provider = {
  /**
   * Provider name.
   *
   * WHY 'AppraisalPluginSettings'?
   * Follows the pattern of other plugins (MotivationPluginSettings, etc.)
   * "Settings" is a bit of a misnomer (we show status), but it's consistent
   * with the convention.
   */
  name: 'AppraisalPluginSettings',

  /**
   * Human-readable description.
   */
  description: 'Provides current status of the Appraisal plugin.',

  /**
   * Whether this provider's output changes between calls.
   *
   * WHY TRUE?
   * The status (which domains, what confidence) changes as evaluators
   * publish appraisals. Must be fresh each time.
   */
  dynamic: true,

  /**
   * Get the current plugin status.
   *
   * @param runtime - For accessing the appraisal service
   * @returns Provider result with status text and data
   */
  get: async (runtime: IAgentRuntime): Promise<ProviderResult> => {
    // Get the appraisal service
    const service = runtime.getService(
      APPRAISAL_SERVICE_TYPE
    ) as AppraisalService | null;

    // WHY CHECK FOR NULL?
    // Service might not be available (plugin not loaded, start failed).
    // Return a helpful message rather than crashing.
    if (!service) {
      return {
        text: '# Appraisal Plugin Status\n\nService not available.',
        data: { available: false },
      };
    }

    // Get current state
    const ids = service.getIds();
    const appraisals = service.getAll();

    // Format the domain list
    // WHY THIS FORMAT?
    // - Markdown list for readability
    // - Bold domain name for scanning
    // - Confidence as percentage (intuitive)
    // - Source in parentheses (secondary info)
    const domainList =
      ids.length > 0
        ? ids
            .map((id) => {
              const a = appraisals[id];
              // WHY ROUND?
              // "85%" is cleaner than "85.4783%"
              return `- **${id}**: confidence ${Math.round(a.confidence * 100)}% (${a.source})`;
            })
            .join('\n')
        : '- No appraisals registered yet.';

    // Build the status text
    // WHY INCLUDE COUNT?
    // Quick overview without reading the full list
    const settingsText = `
# Appraisal Plugin Status

## Registered Appraisals (${ids.length}):
${domainList}

## How to Update:
Domain evaluator plugins publish appraisals when they assess situations.
Appraisals update automatically as new information arrives.
`;

    // Return both text and structured data
    // WHY DATA FIELD?
    // Programmatic access. Other code might want to check:
    // `if (status.data.appraisalCount > 0) { ... }`
    return {
      text: settingsText.trim(),
      data: {
        available: true,
        appraisalCount: ids.length,
        appraisalIds: ids,
        appraisals,
      },
    };
  },
};
