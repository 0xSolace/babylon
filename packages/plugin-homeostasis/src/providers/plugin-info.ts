/**
 * @fileoverview Plugin info and settings providers for the Homeostasis plugin.
 *
 * These providers expose plugin instructions and current configuration
 * to the agent's context, enabling the LLM to understand available
 * capabilities and current settings.
 */

import type { IAgentRuntime, Provider, ProviderResult } from '@elizaos/core';

/**
 * Provides instructions and capabilities for the Homeostasis plugin.
 *
 * This dynamic provider returns information about how the plugin works
 * and what capabilities it provides to the agent.
 */
export const pluginInfoProvider: Provider = {
  name: 'HomeostasisPluginInfo',
  description:
    'Provides instructions and capabilities for the Homeostasis plugin.',
  dynamic: true,
  get: async (_runtime: IAgentRuntime): Promise<ProviderResult> => {
    const instructions = `
# Homeostasis Plugin Instructions

The Homeostasis plugin manages the agent's internal state across three layers: physiological (body simulation), psychological (drives), and resources (external assets). It tracks these states but does not decide actions; rather, it provides the foundational "body" for other plugins (like Motivation) to interpret and act upon.

## Key Features:
- **Physiological State**: Tracks hunger, fatigue, hydration, and health (0=satisfied, 100=deprived).
- **Psychological Drives**: Manages security, social, status, autonomy, and meaning (50=balanced, extremes=tension).
- **Resource Tracking**: Monitors external assets like wallets, inference tokens, and files.
- **Dynamic Ticking**: State changes can be triggered by agent activity (default) or a fixed timer.
- **State Persistence**: All internal states are saved and loaded, ensuring continuity.
- **Event Emission**: Emits events when physiological or psychological states reach critical levels.
- **Survival System**: Manages agent lifecycle including crisis detection and death mechanics.

## State Layers:

### Physiological (Body Simulation)
Scale: 0 = satisfied, 100 = deprived. High values mean the agent needs attention.
- **Hunger**: Craving for input, novelty, engagement
- **Fatigue**: Accumulated processing strain, conversation length
- **Hydration**: Flow state, connection quality, resource access
- **Health**: Overall coherence, error rate, system stability

### Psychological (Mind/Drives)
Scale: 50 = balanced, extremes (0 or 100) = tension. Values recover toward baseline.
- **Security**: Safety, stability, predictability
- **Social**: Connection, belonging, being known
- **Status**: Recognition, respect, competence
- **Autonomy**: Agency, choice, self-direction
- **Meaning**: Purpose, contribution, significance

### Resources
Unbounded scale. Tracks external assets the agent uses or owns.
- Wallet balances
- Inference token allocation
- File storage

## Physiological → Psychological Coupling:
When physiological stress is high (average > 70%), psychological recovery rate is halved. This creates "survival mode" where hungry, tired agents naturally focus on immediate needs.

## Tick Modes:
- **Activity Mode** (default): State updates when the agent actively engages (LLM calls, messages sent). More efficient and responsive.
- **Timer Mode**: State updates on a fixed interval regardless of activity.

## Integration:
Other plugins interact with the Homeostasis service to:
- **Read State**: Get current hunger, drives, or resource levels.
- **Propose Deltas**: Report changes to physiological or psychological states.
- **Report Resource Changes**: Update resource levels.

For current Homeostasis settings, refer to the \`HomeostasisPluginSettings\` provider.
`;
    return { text: instructions.trim() };
  },
};

/**
 * Provides current configuration settings for the Homeostasis plugin.
 *
 * This dynamic provider exposes current settings without revealing
 * sensitive information.
 */
export const pluginSettingsProvider: Provider = {
  name: 'HomeostasisPluginSettings',
  description:
    'Provides current configuration settings for the Homeostasis plugin.',
  dynamic: true,
  get: async (runtime: IAgentRuntime): Promise<ProviderResult> => {
    // Global settings
    const tickMode = runtime.getSetting('HOMEOSTASIS_TICK_MODE') || 'activity';
    const tickIntervalMs =
      runtime.getSetting('HOMEOSTASIS_TICK_INTERVAL_MS') || '60000';
    const activityThrottleMs =
      runtime.getSetting('HOMEOSTASIS_ACTIVITY_THROTTLE_MS') || '5000';
    const saturationFactor =
      runtime.getSetting('HOMEOSTASIS_SATURATION_FACTOR') || '0.3';
    const initialVariance =
      runtime.getSetting('HOMEOSTASIS_INITIAL_VARIANCE') || '5';
    const physiologicalStressThreshold =
      runtime.getSetting('HOMEOSTASIS_PHYSIOLOGICAL_STRESS_THRESHOLD') || '0.7';

    // Survival system
    const crisisThreshold =
      runtime.getSetting('HOMEOSTASIS_CRISIS_THRESHOLD') || '85';
    const ticksUntilDeath =
      runtime.getSetting('HOMEOSTASIS_TICKS_UNTIL_DEATH') || '60';
    const finalTicks = runtime.getSetting('HOMEOSTASIS_FINAL_TICKS') || '10';
    const deathMode =
      runtime.getSetting('HOMEOSTASIS_DEATH_MODE') || 'suspended';

    // Physiological rates
    const hungerAccumulation =
      runtime.getSetting('HOMEOSTASIS_HUNGER_ACCUMULATION_RATE') || '0.02';
    const fatigueAccumulation =
      runtime.getSetting('HOMEOSTASIS_FATIGUE_ACCUMULATION_RATE') || '0.01';
    const hydrationAccumulation =
      runtime.getSetting('HOMEOSTASIS_HYDRATION_ACCUMULATION_RATE') || '0.03';
    const healthAccumulation =
      runtime.getSetting('HOMEOSTASIS_HEALTH_ACCUMULATION_RATE') || '0';

    // Psychological baselines
    const securityBaseline =
      runtime.getSetting('HOMEOSTASIS_SECURITY_BASELINE') || '50';
    const socialBaseline =
      runtime.getSetting('HOMEOSTASIS_SOCIAL_BASELINE') || '50';
    const statusBaseline =
      runtime.getSetting('HOMEOSTASIS_STATUS_BASELINE') || '50';
    const autonomyBaseline =
      runtime.getSetting('HOMEOSTASIS_AUTONOMY_BASELINE') || '50';
    const meaningBaseline =
      runtime.getSetting('HOMEOSTASIS_MEANING_BASELINE') || '50';

    const settingsText = `
# Homeostasis Plugin Current Settings

## Global Settings:
- **Tick Mode**: \`${tickMode}\` ('activity' for event-driven, 'timer' for interval-based)
- **Tick Interval**: \`${tickIntervalMs}\` ms (used in timer mode)
- **Activity Throttle**: \`${activityThrottleMs}\` ms (min time between activity ticks)
- **Saturation Factor**: \`${saturationFactor}\` (diminishing returns at extremes, 0-1)
- **Initial Variance**: \`${initialVariance}\` (random variance added to initial values)
- **Physiological Stress Threshold**: \`${physiologicalStressThreshold}\` (coupling threshold for psychological recovery)

## Survival System:
- **Crisis Threshold**: \`${crisisThreshold}\` (distress score to enter crisis state)
- **Ticks Until Death**: \`${ticksUntilDeath}\` (ticks in crisis before death imminent)
- **Final Ticks**: \`${finalTicks}\` (ticks after death imminent for intervention)
- **Death Mode**: \`${deathMode}\` ('suspended', 'graceful', or 'immediate')

## Physiological Accumulation Rates (per tick):
- **Hunger**: \`${hungerAccumulation}\`
- **Fatigue**: \`${fatigueAccumulation}\`
- **Hydration**: \`${hydrationAccumulation}\`
- **Health**: \`${healthAccumulation}\` (0 = no auto-accumulation)

## Psychological Drive Baselines (equilibrium targets):
- **Security**: \`${securityBaseline}\`
- **Social**: \`${socialBaseline}\`
- **Status**: \`${statusBaseline}\`
- **Autonomy**: \`${autonomyBaseline}\`
- **Meaning**: \`${meaningBaseline}\`

Each psychological drive naturally recovers toward its baseline over time.
`;
    return {
      text: settingsText.trim(),
      data: {
        tickMode,
        tickIntervalMs: parseInt(String(tickIntervalMs), 10),
        activityThrottleMs: parseInt(String(activityThrottleMs), 10),
        saturationFactor: parseFloat(String(saturationFactor)),
        initialVariance: parseInt(String(initialVariance), 10),
        physiologicalStressThreshold: parseFloat(
          String(physiologicalStressThreshold)
        ),
        crisisThreshold: parseInt(String(crisisThreshold), 10),
        ticksUntilDeath: parseInt(String(ticksUntilDeath), 10),
        finalTicks: parseInt(String(finalTicks), 10),
        deathMode,
        physiologicalRates: {
          hunger: parseFloat(String(hungerAccumulation)),
          fatigue: parseFloat(String(fatigueAccumulation)),
          hydration: parseFloat(String(hydrationAccumulation)),
          health: parseFloat(String(healthAccumulation)),
        },
        psychologicalBaselines: {
          security: parseInt(String(securityBaseline), 10),
          social: parseInt(String(socialBaseline), 10),
          status: parseInt(String(statusBaseline), 10),
          autonomy: parseInt(String(autonomyBaseline), 10),
          meaning: parseInt(String(meaningBaseline), 10),
        },
      },
    };
  },
};
