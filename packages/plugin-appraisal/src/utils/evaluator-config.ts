/**
 * @fileoverview Evaluator Configuration Utilities
 *
 * =============================================================================
 * WHY THIS FILE EXISTS
 * =============================================================================
 *
 * Not all characters need all domain evaluators. Character archetypes have
 * different situational awareness needs:
 *
 * - **Vendor character (Maple)**: Shouldn't evaluate money for survival
 *   (has stable income), might care about reputation instead
 *
 * - **Power-broker character**: Cares deeply about power dynamics,
 *   might disable notoriety (prefers to work behind the scenes)
 *
 * - **Fame-focused character**: Cares about notoriety and relationships,
 *   might disable power evaluator (doesn't seek control)
 *
 * This utility provides consistent enable/disable logic across all evaluators.
 *
 * =============================================================================
 * CONFIGURATION PATTERNS
 * =============================================================================
 *
 * Characters can specify enabled/disabled evaluators in settings:
 *
 * ```typescript
 * settings: {
 *   // Option 1: Whitelist - only enable specific evaluators
 *   APPRAISAL_ENABLED_EVALUATORS: 'money,relationship',
 *
 *   // Option 2: Blacklist - disable specific evaluators
 *   APPRAISAL_DISABLED_EVALUATORS: 'power,notoriety',
 *
 *   // Option 3: Disable all appraisal evaluators
 *   APPRAISAL_EVALUATORS_ENABLED: 'false',
 * }
 * ```
 *
 * =============================================================================
 * PRIORITY ORDER
 * =============================================================================
 *
 * When multiple settings are present, they're checked in this order:
 *
 * 1. APPRAISAL_EVALUATORS_ENABLED=false → disables ALL evaluators
 *    WHY FIRST? Global disable should override everything else.
 *
 * 2. APPRAISAL_ENABLED_EVALUATORS → whitelist (if set, ONLY these run)
 *    WHY SECOND? Explicit whitelist is more specific than blacklist.
 *
 * 3. APPRAISAL_DISABLED_EVALUATORS → blacklist (if set, these DON'T run)
 *    WHY THIRD? Blacklist is less restrictive than whitelist.
 *
 * 4. Default: all evaluators enabled
 *    WHY DEFAULT ENABLED? Most characters benefit from full awareness.
 *
 * =============================================================================
 * USAGE EXAMPLES
 * =============================================================================
 *
 * In a domain evaluator plugin:
 *
 * ```typescript
 * import { isEvaluatorEnabled } from '@elizaos/plugin-appraisal';
 *
 * // In evaluator handler
 * if (!isEvaluatorEnabled(runtime, 'money')) {
 *   return; // Skip evaluation for this character
 * }
 *
 * // Proceed with evaluation...
 * ```
 */

import type { IAgentRuntime } from '@elizaos/core';

/**
 * Check if a domain evaluator is enabled for the current character.
 *
 * WHY THIS FUNCTION?
 * Provides centralized enable/disable logic. Domain evaluators call this
 * before running to respect character configuration.
 *
 * WHY RETURN BOOLEAN?
 * Simple yes/no decision. Evaluators can short-circuit with:
 *   if (!isEvaluatorEnabled(runtime, 'money')) return;
 *
 * @param runtime - Agent runtime (for accessing settings)
 * @param domainId - Domain identifier (e.g., 'money', 'power', 'notoriety')
 * @returns true if the evaluator should run, false if disabled
 *
 * @example
 * ```typescript
 * // In money evaluator
 * if (!isEvaluatorEnabled(runtime, 'money')) {
 *   return; // Skip evaluation for this character
 * }
 * ```
 */
export function isEvaluatorEnabled(
  runtime: IAgentRuntime,
  domainId: string
): boolean {
  // Check for global disable
  // WHY CHECK BOTH STRING AND BOOLEAN?
  // Settings can come from .env (strings) or character JSON (booleans).
  // Checking both ensures consistent behavior regardless of source.
  const globalEnabled = runtime.getSetting('APPRAISAL_EVALUATORS_ENABLED');
  if (globalEnabled === 'false' || globalEnabled === false) {
    return false;
  }

  // Check whitelist (if set, only these evaluators are enabled)
  // WHY WHITELIST BEFORE BLACKLIST?
  // Whitelist is more restrictive. If present, it defines the complete
  // set of enabled evaluators. Blacklist is ignored when whitelist exists.
  const whitelist = runtime.getSetting('APPRAISAL_ENABLED_EVALUATORS');
  if (whitelist && typeof whitelist === 'string') {
    // WHY toLowerCase()?
    // Case-insensitive matching prevents configuration errors.
    // 'Money', 'money', and 'MONEY' should all match.
    const enabled = whitelist.split(',').map((s) => s.trim().toLowerCase());
    return enabled.includes(domainId.toLowerCase());
  }

  // Check blacklist
  // WHY BLACKLIST?
  // More flexible than whitelist. "Enable all except these" is a common
  // pattern when most evaluators are useful but a few aren't.
  const blacklist = runtime.getSetting('APPRAISAL_DISABLED_EVALUATORS');
  if (blacklist && typeof blacklist === 'string') {
    const disabled = blacklist.split(',').map((s) => s.trim().toLowerCase());
    return !disabled.includes(domainId.toLowerCase());
  }

  // Default: enabled
  // WHY DEFAULT ENABLED?
  // Most characters benefit from full situational awareness. Opt-out
  // (disable specific evaluators) is easier than opt-in (enable each one).
  return true;
}

/**
 * Get list of enabled evaluator domains for the current character.
 *
 * WHY THIS FUNCTION?
 * Useful for logging, debugging, and initialization. Shows which evaluators
 * will actually run for this character.
 *
 * @param runtime - Agent runtime
 * @param allDomains - List of all possible domain IDs
 * @returns Array of enabled domain IDs
 *
 * @example
 * ```typescript
 * const allDomains = ['money', 'power', 'notoriety', 'relationships'];
 * const enabled = getEnabledEvaluators(runtime, allDomains);
 * console.log(`Enabled evaluators: ${enabled.join(', ')}`);
 * // Output: "Enabled evaluators: money, relationships"
 * ```
 */
export function getEnabledEvaluators(
  runtime: IAgentRuntime,
  allDomains: string[]
): string[] {
  return allDomains.filter((domain) => isEvaluatorEnabled(runtime, domain));
}

/**
 * Get evaluator configuration summary for logging/debugging.
 *
 * WHY THIS FUNCTION?
 * Provides human-readable summary of the configuration for logs and debugging.
 * When troubleshooting "why isn't this evaluator running?", check this output.
 *
 * @param runtime - Agent runtime
 * @returns Configuration summary string
 *
 * @example
 * ```typescript
 * const summary = getEvaluatorConfigSummary(runtime);
 * console.log(summary);
 * // Output: "Whitelist mode: only [money,relationships] enabled"
 * ```
 */
export function getEvaluatorConfigSummary(runtime: IAgentRuntime): string {
  const globalEnabled = runtime.getSetting('APPRAISAL_EVALUATORS_ENABLED');
  const whitelist = runtime.getSetting('APPRAISAL_ENABLED_EVALUATORS');
  const blacklist = runtime.getSetting('APPRAISAL_DISABLED_EVALUATORS');

  if (globalEnabled === 'false' || globalEnabled === false) {
    return 'All evaluators disabled (APPRAISAL_EVALUATORS_ENABLED=false)';
  }

  if (whitelist && typeof whitelist === 'string') {
    return `Whitelist mode: only [${whitelist}] enabled`;
  }

  if (blacklist && typeof blacklist === 'string') {
    return `Blacklist mode: [${blacklist}] disabled`;
  }

  return 'Default: all evaluators enabled';
}
