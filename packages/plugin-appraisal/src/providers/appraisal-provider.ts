/**
 * @fileoverview AppraisalProvider - Injects appraisals into LLM context
 *
 * =============================================================================
 * WHY THIS PROVIDER EXISTS
 * =============================================================================
 *
 * The appraisal service holds domain evaluator outputs, but that data needs
 * to reach two consumers:
 *
 * 1. THE LLM
 *    The LLM needs to know the agent's situational awareness to generate
 *    appropriate responses. "I see you're in a cautious financial position..."
 *
 * 2. MOTIVATION PLUGIN
 *    Motivation reads appraisals during composeState() to determine priorities.
 *    It accesses the structured `data` field, not the text.
 *
 * Providers are elizaOS's mechanism for injecting context into prompts.
 * This is THE correct way to get data from services into the LLM context.
 *
 * =============================================================================
 * WHY NOT EVENTS?
 * =============================================================================
 *
 * Q: "Why not have motivation subscribe to APPRAISAL_UPDATED events?"
 * A: Provider-based reads are synchronous and consistent.
 *
 * EVENTS are for notification (fire-and-forget). If motivation subscribed
 * to events, it would need to maintain cached state, handle race conditions,
 * and deal with startup ordering (what if motivation starts before evaluators?).
 *
 * PROVIDERS are called during composeState(), ensuring:
 * - Fresh data at the moment of use
 * - No caching/stale data issues
 * - Consistent ordering (providers run in sequence by position)
 *
 * =============================================================================
 * PROVIDER OUTPUT FORMAT
 * =============================================================================
 *
 * Providers return three fields:
 *
 * 1. TEXT
 *    Human-readable string injected into the LLM prompt.
 *    ```
 *    ## Situational Appraisals
 *
 *    **money** (confidence: 85%, source: plugin-money, 30s ago)
 *    Data: {"status":"cautious","reserves":"low"}
 *    ```
 *
 * 2. DATA
 *    Structured data for programmatic access. Other plugins (motivation)
 *    read this during their own provider execution.
 *    ```typescript
 *    {
 *      appraisals: { money: {...}, power: {...} },
 *      appraisalCount: 2,
 *      appraisalIds: ['money', 'power']
 *    }
 *    ```
 *
 * 3. VALUES
 *    Template variables for string substitution in prompts.
 *    ```typescript
 *    {
 *      appraisalCount: 2,
 *      hasAppraisals: true,
 *      appraisalIds: 'money, power'
 *    }
 *    ```
 *
 * =============================================================================
 * PROVIDER POSITION
 * =============================================================================
 *
 * Position determines order in which providers run during composeState().
 * We use position 45 because:
 *
 *   40: Homeostasis (internal state)
 *   45: Appraisals (external situation) ← THIS PROVIDER
 *   50: Motivation (interpreted priorities)
 *
 * This ordering ensures:
 * - Homeostasis data is available when appraisals render
 * - Appraisal data is available when motivation runs
 * - The LLM sees: internal → external → priorities (logical flow)
 *
 * =============================================================================
 * WHAT THE LLM SEES
 * =============================================================================
 *
 * When appraisals exist:
 * ```
 * ## Situational Appraisals
 *
 * **money** (confidence: 85%, source: plugin-money, 30s ago)
 * Data: {"status":"cautious","reserves":"low"}
 *
 * **power** (confidence: 72%, source: plugin-power, 2m ago)
 * Data: {"influence":"moderate","control":"stable"}
 * ```
 *
 * When no appraisals:
 * (empty string - no section appears)
 *
 * WHY THIS FORMAT?
 * - Domain name is prominent (**bold**)
 * - Confidence shows uncertainty (LLM can weight accordingly)
 * - Age shows freshness (LLM knows if data might be stale)
 * - Source aids debugging (where did this come from?)
 * - Payload is JSON (structured, parseable by LLM)
 */

import type {
  IAgentRuntime,
  Memory,
  Provider,
  ProviderResult,
  ProviderValue,
  State,
} from '@elizaos/core';
import {
  APPRAISAL_PROVIDER_NAME,
  APPRAISAL_SERVICE_TYPE,
} from '../constants.ts';
import type { AppraisalService } from '../services/appraisal-service.ts';
import type { Appraisal } from '../types.ts';

/**
 * Format appraisals for LLM consumption.
 *
 * WHY A SEPARATE FUNCTION?
 * Separates formatting logic from provider mechanics. Easier to:
 * - Test formatting in isolation
 * - Change format without touching provider structure
 * - Understand what the LLM sees
 *
 * FORMAT DECISIONS:
 * - Markdown headers for structure
 * - Bold domain names for scanning
 * - Metadata in parentheses (doesn't dominate)
 * - JSON payload (parseable, compact)
 * - Blank line between domains (visual separation)
 *
 * @param appraisals - Record of id → appraisal
 * @returns Formatted string for LLM context (empty if no appraisals)
 */
function formatAppraisalsForLLM(appraisals: Record<string, Appraisal>): string {
  const ids = Object.keys(appraisals);

  // WHY RETURN EMPTY STRING?
  // No appraisals = no section in prompt. Don't waste tokens on
  // "No appraisals available" - absence is clear.
  if (ids.length === 0) {
    return '';
  }

  // WHY ARRAY + JOIN?
  // More efficient than string concatenation. Clearer structure.
  const lines: string[] = ['## Situational Appraisals\n'];

  for (const [id, appraisal] of Object.entries(appraisals)) {
    // Calculate age for freshness indication
    // WHY SHOW AGE?
    // LLMs can factor in staleness. "Money was cautious 2 hours ago" is
    // different from "Money was cautious 5 seconds ago".
    const ageMs = Date.now() - appraisal.ts;
    const ageStr = formatAge(ageMs);

    // Header line with metadata
    // WHY PERCENTAGE?
    // "85%" is more intuitive than "0.85". LLMs understand percentages.
    const confidencePercent = Math.round(appraisal.confidence * 100);
    lines.push(
      `**${id}** (confidence: ${confidencePercent}%, source: ${appraisal.source}, ${ageStr})`
    );

    // Payload as JSON
    // WHY JSON?
    // - Structured: LLM can parse key-value pairs
    // - Compact: Single line, no wasted space
    // - Universal: Any payload shape works
    // WHY CHECK LENGTH?
    // Empty payloads ({}) don't add value. Skip them.
    if (appraisal.payload && Object.keys(appraisal.payload).length > 0) {
      lines.push(`Data: ${JSON.stringify(appraisal.payload)}`);
    }

    // Blank line between domains
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format milliseconds as human-readable age.
 *
 * WHY HUMAN-READABLE?
 * "30s ago" is instantly understood. "30000ms ago" requires mental math.
 * LLMs also parse natural language better than raw numbers.
 *
 * WHY THESE BUCKETS?
 * - "just now" (< 1s): Fresh, no precision needed
 * - "Xs ago" (< 1m): Second-level precision for recent
 * - "Xm ago" (< 1h): Minute-level for medium-age
 * - "Xh ago" (≥ 1h): Hour-level for old (precise minutes don't matter)
 *
 * @param ms - Age in milliseconds
 * @returns Human-readable string like "30s ago" or "2m ago"
 */
function formatAge(ms: number): string {
  if (ms < 1000) {
    return 'just now';
  }
  if (ms < 60000) {
    const secs = Math.round(ms / 1000);
    return `${secs}s ago`;
  }
  if (ms < 3600000) {
    const mins = Math.round(ms / 60000);
    return `${mins}m ago`;
  }
  const hours = Math.round(ms / 3600000);
  return `${hours}h ago`;
}

/**
 * Appraisal Provider
 *
 * Injects current situational appraisals into LLM context.
 * Primary interface for consumers (motivation, etc.) to read appraisals.
 *
 * CONSUMPTION PATTERNS:
 *
 * 1. LLM (via text):
 *    The formatted text is injected into the prompt. The LLM reads it
 *    as part of the context and can reference it in responses.
 *
 * 2. Motivation (via data):
 *    ```typescript
 *    // In motivation provider's get() function
 *    const appraisalData = state?.data?.providers?.[APPRAISAL_PROVIDER_NAME];
 *    const snapshot = appraisalData?.appraisals || {};
 *    ```
 *
 * 3. Templates (via values):
 *    ```
 *    You are aware of {{appraisalCount}} situational factors: {{appraisalIds}}.
 *    ```
 */
export const appraisalProvider: Provider = {
  /**
   * Provider name.
   *
   * WHY CONSTANT?
   * Consumers reference this name to access the provider's data.
   * Using a constant ensures consistency and enables type checking.
   */
  name: APPRAISAL_PROVIDER_NAME,

  /**
   * Human-readable description.
   *
   * WHY?
   * Documentation for developers. May also be exposed in debugging tools
   * or LLM reasoning about available providers.
   */
  description: 'Current situational appraisals from domain evaluators',

  /**
   * Position in provider execution order.
   *
   * WHY 45?
   * Between homeostasis (40) and motivation (50). This ordering ensures:
   * - Homeostasis context is available (we might reference internal state)
   * - Our data is available for motivation's interpretation
   *
   * The flow is: internal state → external situation → interpreted priorities
   */
  position: 45,

  /**
   * Whether this provider's output can change between calls.
   *
   * WHY TRUE?
   * Appraisals can be published at any time by evaluator plugins.
   * The provider must refresh on each composeState() call to get
   * the latest data.
   *
   * If this were false, the system might cache our output and serve
   * stale appraisals.
   */
  dynamic: true,

  /**
   * Get appraisal context for the current message.
   *
   * This function is called during runtime.composeState(). It:
   * 1. Retrieves the AppraisalService
   * 2. Gets all current appraisals
   * 3. Formats them for text, data, and values
   *
   * WHY ASYNC?
   * elizaOS providers are async to support database queries, API calls,
   * etc. Our implementation is synchronous but we follow the pattern.
   *
   * @param runtime - Agent runtime (for accessing services)
   * @param _message - Current message (unused, but required by interface)
   * @param _state - Current state (unused, but could access other providers)
   * @returns Provider result with text, data, and values
   */
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<ProviderResult> => {
    // Get the appraisal service from runtime
    // WHY CAST?
    // getService returns Service | null. We know the type if it exists.
    const service = runtime.getService(
      APPRAISAL_SERVICE_TYPE
    ) as AppraisalService | null;

    // WHY CHECK FOR NULL?
    // Service might not be registered (plugin not loaded) or might have
    // failed to start. Return empty rather than crash.
    if (!service) {
      return {
        text: '',
        data: {},
        values: {},
      };
    }

    // Get current appraisals from service
    // WHY CALL BOTH getAll() AND getIds()?
    // getAll() returns the full appraisals (for data field)
    // getIds() returns just the keys (more efficient for values field)
    // Could derive ids from Object.keys(appraisals), but this is clearer.
    const appraisals = service.getAll();
    const ids = service.getIds();

    // Format for LLM prompt
    // WHY SEPARATE FUNCTION?
    // Formatting is complex enough to warrant extraction. Also makes
    // it easier to test the formatting logic independently.
    const text = formatAppraisalsForLLM(appraisals);

    // Structured data for programmatic access
    // WHY THIS STRUCTURE?
    // - appraisals: The full snapshot for plugins that need everything
    // - appraisalCount: Quick check "are there any?"
    // - appraisalIds: List domains without loading payloads
    const data: Record<string, ProviderValue> = {
      appraisals,
      appraisalCount: ids.length,
      appraisalIds: ids,
    };

    // Template values for string substitution
    // WHY DIFFERENT FROM DATA?
    // Values are for template strings: "{{appraisalCount}} appraisals".
    // They need to be primitive types (string, number, boolean).
    // Data can be complex objects for programmatic access.
    const values: Record<string, ProviderValue> = {
      appraisalCount: ids.length,
      hasAppraisals: ids.length > 0,
      appraisalIds: ids.join(', '), // String for template substitution
    };

    return { text, data, values };
  },
};
