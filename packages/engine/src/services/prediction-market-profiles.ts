export interface PredictionMarketProfile {
  horizonBucket: 'short' | 'medium' | 'long';
  initialLiquidity: number;
  initialYesProbability: number;
  signalSensitivity: number;
  autoAmmNudgeMultiplier: number;
  neutralReversionMultiplier: number;
}

export interface PredictionMarketInitialization {
  initialLiquidity: number;
  initialYesProbability: number;
}

const HORIZON_PRESETS: Record<
  PredictionMarketProfile['horizonBucket'],
  Omit<PredictionMarketProfile, 'horizonBucket' | 'initialYesProbability'>
> = {
  short: {
    initialLiquidity: 12_000,
    signalSensitivity: 1.18,
    autoAmmNudgeMultiplier: 1.12,
    neutralReversionMultiplier: 0.82,
  },
  medium: {
    initialLiquidity: 18_000,
    signalSensitivity: 1,
    autoAmmNudgeMultiplier: 1,
    neutralReversionMultiplier: 1,
  },
  long: {
    initialLiquidity: 24_000,
    signalSensitivity: 0.86,
    autoAmmNudgeMultiplier: 0.88,
    neutralReversionMultiplier: 1.16,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stableUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function getHorizonBucket(
  endDate: Date,
  now: Date
): PredictionMarketProfile['horizonBucket'] {
  const daysToResolution = Math.max(
    0,
    (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysToResolution <= 2) return 'short';
  if (daysToResolution <= 5) return 'medium';
  return 'long';
}

export function buildPredictionMarketProfile(input: {
  marketId: string;
  question: string;
  endDate: Date;
  now?: Date;
}): PredictionMarketProfile {
  const now = input.now ?? new Date();
  const horizonBucket = getHorizonBucket(input.endDate, now);
  const preset = HORIZON_PRESETS[horizonBucket];
  const seedBase = `${input.marketId}:${input.question.toLowerCase()}`;

  const liquidityJitter = 0.9 + stableUnit(`${seedBase}:liq`) * 0.24;
  const sensitivityJitter = 0.92 + stableUnit(`${seedBase}:signal`) * 0.16;
  const nudgeJitter = 0.92 + stableUnit(`${seedBase}:nudge`) * 0.16;
  const reversionJitter = 0.92 + stableUnit(`${seedBase}:revert`) * 0.16;

  return {
    horizonBucket,
    initialLiquidity: Math.round(preset.initialLiquidity * liquidityJitter),
    initialYesProbability: 0.5,
    signalSensitivity: clamp(
      preset.signalSensitivity * sensitivityJitter,
      0.7,
      1.35
    ),
    autoAmmNudgeMultiplier: clamp(
      preset.autoAmmNudgeMultiplier * nudgeJitter,
      0.75,
      1.3
    ),
    neutralReversionMultiplier: clamp(
      preset.neutralReversionMultiplier * reversionJitter,
      0.75,
      1.35
    ),
  };
}

export function getPredictionMarketInitialization(input: {
  marketId: string;
  question: string;
  endDate: Date;
  now?: Date;
}): PredictionMarketInitialization {
  const profile = buildPredictionMarketProfile(input);
  return {
    initialLiquidity: profile.initialLiquidity,
    initialYesProbability: profile.initialYesProbability,
  };
}
