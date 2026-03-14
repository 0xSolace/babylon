/**
 * @fileoverview MotivationProvider - Injects motivation context into LLM prompts
 *
 * WHY THIS PROVIDER?
 * ------------------
 * The motivation service calculates priorities, constraints, and opportunities.
 * But that data needs to reach the LLM so it can inform response generation.
 *
 * Providers are elizaOS's mechanism for injecting context into prompts.
 * This provider formats motivation state into readable text that gives the
 * LLM understanding of what matters to the agent.
 *
 * WHAT THE LLM SEES:
 * ------------------
 * ```
 * ## Motivation
 *
 * **Frame**: maslow - Hierarchical needs
 *
 * **Priorities**:
 * - restore security (80%) [security]
 * - seek connection (50%) [social]
 *
 * **Constraints**:
 * - risk_averse: Avoid high-variance actions
 *
 * **Opportunities**:
 * - growth available (70% potential)
 *
 * **Current Orientation**:
 * My foundation needs attention. Security feels unstable...
 * ```
 *
 * WHY THIS FORMAT?
 * ----------------
 * 1. STRUCTURED: Clear sections help LLM parse the information
 * 2. READABLE: Natural language, not JSON dumps
 * 3. PRIORITIZED: Most important info first
 * 4. NARRATIVE: The orientation section gives emotional context
 *
 * PROVIDER POSITION
 * -----------------
 * Position 50 places us between homeostasis (~40) and actions (~60-80).
 * This gives the LLM: raw state → interpreted motivation → available actions
 */

import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { addHeader } from '@elizaos/core';
import type { MotivationService } from '../services/motivation-service.ts';

/**
 * Motivation Provider
 *
 * Injects current motivation state into LLM context.
 */
export const motivationProvider: Provider = {
  name: 'MOTIVATION',
  description: 'Agent motivation - priorities, constraints, and opportunities',

  /**
   * Position in provider order.
   *
   * WHY 50?
   * Provider ordering affects what the LLM sees first. We want:
   * - Homeostasis (raw state) at ~40 — foundational data
   * - Motivation (interpreted state) at 50 — meaning of that data
   * - Actions/capabilities at ~60-80 — what can be done about it
   *
   * This builds understanding: "Here's my state. Here's what it means.
   * Here's what I can do about it."
   */
  position: 50,
  dynamic: true,

  /**
   * Get motivation context for the current message.
   *
   * WHY RETURN THREE THINGS?
   * - text: Human-readable context for the LLM prompt
   * - data: Structured data for programmatic access
   * - values: Template variables for string substitution
   *
   * Different consumers use different formats. The text goes into the
   * prompt; data/values are available for custom templates or actions.
   */
  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    // Get the motivation service
    const service = runtime.getService(
      'motivation'
    ) as MotivationService | null;

    // If service isn't available, return empty
    // WHY CHECK? Plugin may not be loaded, or service may have failed to start.
    if (!service) {
      return {
        text: '',
        data: {},
        values: {},
      };
    }

    // Get current motivation state
    const motivationState = service.getState();
    const formattedContext = service.getFormattedContext();

    // Format for LLM with header
    // WHY addHeader? Adds consistent section formatting for the prompt.
    const text = addHeader('', formattedContext);

    // -------------------------------------------------------------------------
    // Provide structured data for programmatic access
    //
    // WHY STRUCTURED DATA?
    // Some consumers (actions, evaluators) may want to inspect motivation
    // programmatically, not parse text. This gives them clean access.
    // -------------------------------------------------------------------------
    const data = {
      frame: motivationState.dominantFrame,
      priorities: motivationState.priorities,
      constraints: motivationState.constraints,
      opportunities: motivationState.opportunities,
      narrative: motivationState.narrative,
      timestamp: motivationState.timestamp,
    };

    // -------------------------------------------------------------------------
    // Provide values for template substitution
    //
    // WHY FLAT VALUES?
    // Template systems often work with flat key-value pairs. These values
    // can be substituted into templates like:
    // "The agent is focused on {{topNeed}} with {{topIntensity}}% intensity."
    //
    // SITUATIONAL VALUES:
    // We also include flags for situational patterns to enable conditional
    // template logic like:
    // "{{#if hasExternalPressure}}External factors constrain me.{{/if}}"
    // -------------------------------------------------------------------------
    const topPriority = motivationState.priorities[0];

    // Detect situational patterns in current state
    // WHY? Templates may want to conditionally show situational content
    const hasSituationalConstraint = motivationState.constraints.some(
      (c) =>
        c.type === 'budget_conscious' ||
        c.type === 'reputation_careful' ||
        c.type === 'external_caution'
    );
    const hasSituationalOpportunity = motivationState.opportunities.some(
      (o) =>
        o.type.includes('leverage') ||
        o.type.includes('momentum') ||
        o.type.includes('decisive')
    );

    const values = {
      // Frame
      motivationFrame: motivationState.dominantFrame,

      // Top priority (most common thing consumers want)
      topNeed: topPriority?.need || 'balanced',
      topIntensity: topPriority?.intensity || 0,
      topDrivers: topPriority?.drivers.join(', ') || '',

      // Counts (for conditional logic)
      priorityCount: motivationState.priorities.length,
      constraintCount: motivationState.constraints.length,
      opportunityCount: motivationState.opportunities.length,

      // Full narrative
      motivationNarrative: motivationState.narrative,

      // Complete formatted context (for templates that want everything)
      motivationContext: formattedContext,

      // Situational flags (for conditional template logic)
      // WHY SEPARATE FLAGS? Templates can't easily parse array contents.
      // Boolean flags enable simple {{#if hasSituationalConstraint}} logic.
      hasSituationalConstraint,
      hasSituationalOpportunity,
    };

    return { text, data, values };
  },
};
