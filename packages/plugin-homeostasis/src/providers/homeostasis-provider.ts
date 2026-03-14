/**
 * @fileoverview Homeostasis Provider - Injects internal state into LLM context
 *
 * WHAT THIS PROVIDER DOES
 * =======================
 * Formats the agent's current internal state into text that gets
 * injected into the LLM's prompt. The output varies based on which
 * DOMAIN BODY is currently active:
 *
 * DEFAULT BODY (chat, Discord, etc.):
 * - Physiological: hunger, fatigue, hydration, health (simulated)
 * - Resources: real wallets, tokens, files
 *
 * DOMAIN BODY (e.g., Hyperscape game):
 * - Body State: healthPercent, inCombat, threatCount (from game)
 * - Resources: game gold, inventory (from game)
 *
 * PSYCHOLOGICAL (always unified):
 * - security, social, status, autonomy, meaning
 * - These persist across domain switches (emotional residue)
 *
 * WHY CONTEXT-AWARE OUTPUT?
 * =========================
 * The LLM needs to know the agent's CURRENT body state to make good decisions.
 * When playing a game, showing simulated hunger is confusing - show game health.
 * When chatting, showing game health is irrelevant - show simulated state.
 *
 * WHY A PROVIDER?
 * ===============
 * Providers are elizaOS's mechanism for injecting dynamic context into
 * prompts. By exposing internal state via a provider, every message
 * the agent processes has visibility into how it's "feeling".
 *
 * INTERPRETATION
 * ==============
 * This provider does NOT interpret what the numbers mean. It just formats
 * them clearly. The LLM naturally understands:
 * - "Health=25" → agent's game character is hurt
 * - "security=25" → agent feels psychologically insecure
 * - "fatigue=90" → agent is exhausted (default body)
 *
 * More sophisticated interpretation belongs in plugin-motivation.
 *
 * EXAMPLE OUTPUT (Default Body)
 * =============================
 * ```
 * ## Internal State
 *
 * **Current Body**: Default (real world)
 * **Condition**: content (distress=12/100)
 * **Physiological** (0=satisfied, 100=deprived): hunger=15, fatigue=42, hydration=8, health=5
 * **Psychological** (50=balanced): security=72, social=45, status=58, autonomy=63, meaning=41
 * **Resources**: wallets.sol=2.5, inference.tokens=45000
 * ```
 *
 * EXAMPLE OUTPUT (Hyperscape Body)
 * ================================
 * ```
 * ## Internal State
 *
 * **Current Body**: hyperscape (context: hyperscape:server-1)
 * **Condition**: strained (distress=55/100)
 * **Body State**: Health=45, In Combat=1, Threats=2 (distress contribution: 55%)
 * **Psychological** (50=balanced): security=38, social=45, status=52, autonomy=63, meaning=41
 * **Resources**: gold=1250
 * ```
 */

import type {
  IAgentRuntime,
  Memory,
  Provider,
  ProviderResult,
  ProviderValue,
  State,
} from '@elizaos/core';
import { addHeader } from '@elizaos/core';
import type { HomeostasisService } from '../services/homeostasis-service.ts';
import type {
  DistressBracket,
  DomainPhysiological,
  Drives,
  LifecycleState,
  Physiological,
  ResourceConfig,
  Resources,
} from '../types.ts';

/**
 * Homeostasis Provider
 *
 * Injects current internal state (drives + resources) into LLM context.
 * The LLM interprets the raw numbers naturally.
 *
 * POSITION: 40 (after character, before actions)
 * This ensures the agent knows its internal state before deciding actions.
 */
export const homeostasisProvider: Provider = {
  name: 'HOMEOSTASIS',
  description: 'Agent internal drives and resources',

  /**
   * Position in the provider order.
   *
   * WHY 40?
   * - Character providers run first (~10-20)
   * - We run in the middle (~40)
   * - Actions and capabilities run later (~60-80)
   *
   * This gives the LLM the "who am I, how am I feeling, what can I do" order.
   */
  position: 40,
  dynamic: true,

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<ProviderResult> => {
    // Get the homeostasis service
    const service = runtime.getService(
      'homeostasis'
    ) as HomeostasisService | null;

    // If service isn't available, return empty (plugin not loaded)
    if (!service) {
      return {
        text: '',
        data: {} as Record<string, ProviderValue>,
        values: {} as Record<string, ProviderValue>,
      };
    }

    // Check if a domain body is active
    const activeBody = service.getActiveBody();
    const currentContext = service.getCurrentWorldContext();
    const isDefaultBody = service.isDefaultBodyActive();

    // Get psychological state (unified across all bodies)
    const drives = service.getDrives();

    // Get survival system state
    const distressScore = isDefaultBody
      ? service.getDistressScore()
      : service.getActiveDistress();
    const distressBracket = service.getDistressBracket();
    const lifecycle = service.getLifecycleState();

    // Format condition and psychological (same for all bodies)
    const conditionText = formatCondition(
      distressScore,
      distressBracket,
      lifecycle
    );
    const drivesText = formatDrives(drives);

    // Format physiological and resources based on active body
    let bodyHeaderText: string;
    let physiologicalText: string;
    let resourcesText: string;
    let physiological: Physiological | DomainPhysiological;
    let resources: Resources;
    let stress: number;

    if (activeBody) {
      // Domain body is active - show domain-specific state
      const domainPhysio = activeBody.getPhysiological();
      const domainResources = activeBody.getResources();

      bodyHeaderText = `**Current Body**: ${activeBody.domain} (context: ${currentContext})`;
      physiologicalText = formatDomainPhysiological(domainPhysio);
      resourcesText = formatResources(domainResources);
      physiological = domainPhysio;
      resources = domainResources;
      stress = domainPhysio.distressContribution / 100;
    } else {
      // Default body - show built-in state
      const defaultPhysio = service.getPhysiological();
      const defaultResources = service.getResources();

      bodyHeaderText = '**Current Body**: Default (real world)';
      physiologicalText = formatPhysiological(defaultPhysio);
      resourcesText = formatResources(defaultResources);
      physiological = defaultPhysio;
      resources = defaultResources;
      stress = service.getPhysiologicalStress();
    }

    // Combine into readable text for LLM
    const sections = [
      bodyHeaderText,
      conditionText,
      physiologicalText,
      drivesText,
      resourcesText,
    ].filter(Boolean);
    const text = addHeader('## Internal State', sections.join('\n\n'));

    // Provide structured data for programmatic access
    const data = {
      activeBody: activeBody ? activeBody.domain : 'default',
      worldContext: currentContext,
      condition: {
        distressScore,
        distressBracket,
        lifecycle,
      },
      physiological,
      drives,
      resources: simplifyResources(resources),
      physiologicalStress: stress,
    };

    // Provide values for template substitution
    const values: Record<string, unknown> = {
      // Body context
      activeBody: activeBody ? activeBody.domain : 'default',
      worldContext: currentContext,
      isDefaultBody,

      // Overall condition
      distressScore,
      distressBracket,
      lifecycleStatus: lifecycle.status,
      ticksInCrisis: lifecycle.ticksInCrisis,
      physiologicalStress: stress,

      // Psychological drive values (always available)
      security: drives.security,
      social: drives.social,
      status: drives.status,
      autonomy: drives.autonomy,
      meaning: drives.meaning,

      // Formatted strings for block inclusion
      bodyHeaderText,
      conditionText,
      physiologicalText,
      drivesText,
      resourcesText,
    };

    // Add default body physiological values if default is active
    if (isDefaultBody && 'hunger' in physiological) {
      const defaultPhysio = physiological as Physiological;
      values.hunger = defaultPhysio.hunger;
      values.fatigue = defaultPhysio.fatigue;
      values.hydration = defaultPhysio.hydration;
      values.health = defaultPhysio.health;
    }

    return {
      text,
      data: data as Record<string, ProviderValue>,
      values: values as Record<string, ProviderValue>,
    };
  },
};

/**
 * Format overall condition (distress + lifecycle) as readable text.
 *
 * OUTPUT varies based on lifecycle status:
 * - Normal: "**Condition**: content (distress=12/100)"
 * - Crisis: "⚠️ **CRISIS**: desperate (distress=88/100) - 45 ticks until death imminent"
 * - Dying: "🚨 **DEATH IMMINENT**: terminal (distress=96/100)"
 * - Suspended: "💤 **SUSPENDED**: Agent is hibernating"
 *
 * WHY THIS FORMAT?
 * - Emoji prefixes for immediate visual recognition
 * - Distress bracket provides human-readable condition
 * - Numeric distress for precision
 * - Crisis info shows urgency
 */
function formatCondition(
  distressScore: number,
  bracket: DistressBracket,
  lifecycle: LifecycleState
): string {
  const distressRounded = Math.round(distressScore);

  switch (lifecycle.status) {
    case 'suspended':
      return '💤 **SUSPENDED**: Agent is hibernating and cannot respond until revived.';

    case 'dead':
      return '💀 **DEAD**: Agent has ceased.';

    case 'dying':
      return `🚨 **DEATH IMMINENT**: ${bracket} (distress=${distressRounded}/100) - Final moments remaining`;

    case 'crisis':
      return `⚠️ **CRISIS**: ${bracket} (distress=${distressRounded}/100) - ${lifecycle.ticksInCrisis} ticks in crisis`;

    default: // alive
      return `**Condition**: ${bracket} (distress=${distressRounded}/100)`;
  }
}

/**
 * Format physiological state as readable text.
 *
 * OUTPUT: "**Physiological** (0=satisfied, 100=deprived): hunger=15, fatigue=42, hydration=8, health=5"
 *
 * WHY THIS FORMAT?
 * - Markdown bold for visual separation
 * - Scale note clarifies that LOW is GOOD for physiological
 * - Compact single-line format for efficiency
 * - Rounded integers for readability
 */
function formatPhysiological(physiological: Physiological): string {
  const formatted = Object.entries(physiological)
    .map(([id, value]) => `${id}=${Math.round(value)}`)
    .join(', ');

  return `**Physiological** (0=satisfied, 100=deprived): ${formatted}`;
}

/**
 * Format domain physiological state as readable text.
 *
 * OUTPUT: "**Body State**: Health=85, In Combat=1, Threats=2 (distress contribution: 15%)"
 *
 * Uses labels if provided, otherwise uses raw variable names.
 */
function formatDomainPhysiological(physio: DomainPhysiological): string {
  const formatted = Object.entries(physio.variables)
    .map(([id, value]) => {
      const label = physio.labels?.[id] ?? id;
      return `${label}=${Math.round(value)}`;
    })
    .join(', ');

  return `**Body State**: ${formatted} (distress contribution: ${Math.round(physio.distressContribution)}%)`;
}

/**
 * Format drives (psychological) as readable text.
 *
 * OUTPUT: "**Psychological** (50=balanced): security=72, social=45, status=58, autonomy=63, meaning=41"
 *
 * WHY THIS FORMAT?
 * - Markdown bold for visual separation
 * - "(50=balanced)" reminds LLM that CENTER is good
 * - Compact single-line format for efficiency
 * - Rounded integers for readability
 */
function formatDrives(drives: Drives): string {
  const formatted = Object.entries(drives)
    .map(([id, value]) => `${id}=${Math.round(value)}`)
    .join(', ');

  return `**Psychological** (50=balanced): ${formatted}`;
}

/**
 * Format resources as readable text.
 *
 * OUTPUT: "**Resources**: wallets.sol=2.5, inference.tokens=45000"
 *
 * WHY SMART FORMATTING?
 * - Large numbers (≥100): rounded to integers
 * - Medium numbers (1-100): one decimal place
 * - Small numbers (<1): two decimal places
 *
 * This keeps output compact while preserving precision where it matters.
 */
function formatResources(resources: Resources): string {
  if (Object.keys(resources).length === 0) {
    return '';
  }

  const formatted = Object.entries(resources)
    .map(([id, value]) => {
      if (typeof value === 'number') {
        return `${id}=${formatNumber(value)}`;
      } else if (typeof value === 'object' && 'value' in value) {
        return `${id}=${formatNumber(value.value)}`;
      }
      return null;
    })
    .filter(Boolean)
    .join(', ');

  return formatted ? `**Resources**: ${formatted}` : '';
}

/**
 * Format number for display.
 *
 * Adapts precision based on magnitude:
 * - 1000.456 → "1000"
 * - 50.456 → "50.5"
 * - 0.123 → "0.12"
 */
function formatNumber(value: number): string {
  if (Math.abs(value) >= 100) {
    return Math.round(value).toString();
  } else if (Math.abs(value) >= 1) {
    return value.toFixed(1);
  } else {
    return value.toFixed(2);
  }
}

/**
 * Simplify resources to just numeric values for data access.
 *
 * Unwraps ResourceConfig objects so consumers don't need to
 * handle both forms.
 */
function simplifyResources(resources: Resources): Record<string, number> {
  const simplified: Record<string, number> = {};

  for (const [key, value] of Object.entries(resources)) {
    if (typeof value === 'number') {
      simplified[key] = value;
    } else if (typeof value === 'object' && 'value' in value) {
      simplified[key] = value.value;
    }
  }

  return simplified;
}
