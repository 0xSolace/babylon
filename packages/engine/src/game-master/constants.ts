export const GAME_MASTER_NAME = 'Game Master Halliday';
export const GAME_MASTER_SENDER_ID = 'game-master-halliday';

export const GAME_MASTER_CONTROL_CHAT_IDS = {
  timeline: 'gm:system:timeline',
  actions: 'gm:system:actions',
} as const;

export const GAME_MASTER_DEFAULTS = {
  pulseChance: 0.35,
  minQuietMinutes: 10,
  maxSilenceMinutes: 60,
  maxAutoActionsPerHour: 6,
  maxLowRiskBatchSize: 2,
  pulseCronMinutes: 5,
  maxAutoActorTargets: 3,
  maxAutoOrgTargets: 2,
} as const;
