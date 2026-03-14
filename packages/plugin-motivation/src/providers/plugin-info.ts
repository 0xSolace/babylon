/**
 * @fileoverview Plugin info and settings providers for the Motivation plugin.
 *
 * These providers expose plugin instructions and current configuration
 * to the agent's context, enabling the LLM to understand available
 * capabilities and current settings.
 */

import type { IAgentRuntime, Provider, ProviderResult } from '@elizaos/core';
import { Defaults } from '../constants.ts';
import { getAllFrames } from '../frames/index.ts';

/**
 * Provides instructions and capabilities for the Motivation plugin.
 *
 * This dynamic provider returns information about how the plugin works
 * and what capabilities it provides to the agent.
 */
export const pluginInfoProvider: Provider = {
  name: 'MotivationPluginInfo',
  description:
    'Provides instructions and capabilities for the Motivation plugin.',
  dynamic: true,
  get: async (_runtime: IAgentRuntime): Promise<ProviderResult> => {
    const availableFrames = getAllFrames()
      .map((f) => `- **${f.name}**: ${f.description || 'Interpretive frame'}`)
      .join('\n');

    const instructions = `
# Motivation Plugin Instructions

The Motivation plugin interprets the agent's internal homeostasis state (physiological, psychological, resources) into actionable orientation: priorities, constraints, opportunities, and a human-readable motivational narrative. It helps the agent understand "what matters most right now."

## Key Features:
- **State Interpretation**: Translates raw homeostasis data into meaningful motivational signals and patterns.
- **Motivational Frames**: Uses different interpretive lenses to prioritize needs based on worldview.
- **Priorities & Constraints**: Identifies what the agent should focus on and what limits its actions.
- **Opportunities**: Highlights possibilities for action based on the current state.
- **Motivational Narrative**: Generates a human-readable story of the agent's current internal state and drives.
- **Event Emission**: Emits events when motivation changes, priorities shift, or frames are altered.

## How It Works:
The interpretation pipeline:
1. **Homeostasis State** (drives, physiological, resources) →
2. **Signals** (categorical buckets: low, balanced, high) →
3. **Patterns** (meaningful combinations: "survival_mode", "seeking_connection") →
4. **Frame Filter** (worldview shapes what surfaces) →
5. **Output** (priorities, constraints, opportunities, narrative)

## Motivational Frames:
${availableFrames}

The agent's current frame determines how needs are prioritized and expressed. The **Survival** frame automatically activates when physiological stress is critical, overriding other frames.

## Design Principles:
- **Recognize, Don't Calculate**: Uses pattern matching, not mathematical formulas.
- **Filter, Don't Weight**: Frames decide what surfaces, not weighted scores.
- **Express, Don't Prescribe**: Output is orientation ("restore security"), not commands.
- **Guide Rails, Not Algorithms**: Frames provide structure for the LLM, not replacement logic.

## Integration:
The Motivation plugin depends on the Homeostasis plugin for raw state data. It provides context to the agent's decision-making without directly controlling actions.

For current Motivation settings, refer to the \`MotivationPluginSettings\` provider.
`;
    return { text: instructions.trim() };
  },
};

/**
 * Provides current configuration settings for the Motivation plugin.
 *
 * This dynamic provider exposes current settings without revealing
 * sensitive information like API keys.
 */
export const pluginSettingsProvider: Provider = {
  name: 'MotivationPluginSettings',
  description:
    'Provides current configuration settings for the Motivation plugin.',
  dynamic: true,
  get: async (runtime: IAgentRuntime): Promise<ProviderResult> => {
    const defaultFrame =
      runtime.getSetting('MOTIVATION_DEFAULT_FRAME') || Defaults.DEFAULT_FRAME;
    const survivalThreshold =
      runtime.getSetting('MOTIVATION_SURVIVAL_THRESHOLD') ||
      Defaults.SURVIVAL_THRESHOLD.toString();
    const updateThrottleMs =
      runtime.getSetting('MOTIVATION_UPDATE_THROTTLE_MS') ||
      Defaults.UPDATE_THROTTLE_MS.toString();

    const availableFrames = getAllFrames()
      .map((f) => f.name)
      .join(', ');

    const settingsText = `
# Motivation Plugin Current Settings

- **Default Frame**: \`${defaultFrame}\` (The primary lens for interpreting motivation)
- **Available Frames**: ${availableFrames}
- **Survival Threshold**: \`${survivalThreshold}\` (Physiological stress level that forces 'survival' frame)
- **Update Throttle**: \`${updateThrottleMs}\` ms (Minimum time between motivation recalculations)

## Frame Behavior:
- The agent interprets its internal state through the lens of the active frame.
- When physiological stress exceeds the survival threshold, the agent automatically switches to survival mode.
- Different frames surface different priorities and opportunities.
`;
    return {
      text: settingsText.trim(),
      data: {
        defaultFrame,
        survivalThreshold: parseInt(String(survivalThreshold), 10),
        updateThrottleMs: parseInt(String(updateThrottleMs), 10),
        availableFrames: getAllFrames().map((f) => f.name),
      },
    };
  },
};
