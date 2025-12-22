/**
 * Capabilities Parsing Utilities
 *
 * Shared utilities for validating and parsing agent capabilities
 * from Agent0 registry and subgraph data.
 */

import { AgentCapabilitiesSchema } from '@babylon/shared';

/**
 * Parsed capabilities with all required fields populated
 */
export interface ParsedCapabilities {
  strategies: string[];
  markets: string[];
  actions: string[];
  version: string;
  skills: string[];
  domains: string[];
}

/**
 * Default capabilities values
 */
const DEFAULT_CAPABILITIES: ParsedCapabilities = {
  strategies: [],
  markets: [],
  actions: [],
  version: '1.0.0',
  skills: [],
  domains: [],
};

/**
 * Parse and validate capabilities with defaults
 *
 * @param capabilities - Raw capabilities object to parse
 * @param defaults - Default values for missing fields
 * @returns Validated capabilities with all fields populated
 */
export function parseCapabilities(
  capabilities: unknown,
  defaults: ParsedCapabilities = DEFAULT_CAPABILITIES
): ParsedCapabilities {
  const validation = AgentCapabilitiesSchema.safeParse(capabilities);

  if (!validation.success) {
    return defaults;
  }

  return {
    strategies: validation.data.strategies ?? defaults.strategies,
    markets: validation.data.markets ?? defaults.markets,
    actions: validation.data.actions ?? defaults.actions,
    version: validation.data.version ?? defaults.version,
    skills: validation.data.skills ?? defaults.skills,
    domains: validation.data.domains ?? defaults.domains,
  };
}
