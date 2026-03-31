export type PerpSettlementMode = 'simulation' | 'onchain' | 'hybrid';

function normalizeValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isTruthy(value: string | undefined): boolean {
  const normalized = normalizeValue(value);
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on' ||
    normalized === 'enabled'
  );
}

export function getPerpSettlementMode(
  env: Record<string, string | undefined> = process.env
): PerpSettlementMode {
  const configuredMode = normalizeValue(
    env.NEXT_PUBLIC_PERP_SETTLEMENT_MODE ?? env.PERP_SETTLEMENT_MODE
  );

  if (configuredMode === 'simulation') {
    return 'simulation';
  }

  if (configuredMode === 'onchain' || configuredMode === 'hybrid') {
    return configuredMode;
  }

  if (isTruthy(env.NEXT_PUBLIC_ENABLE_ONCHAIN_PERPS)) {
    return 'onchain';
  }

  const chainId = normalizeValue(env.NEXT_PUBLIC_CHAIN_ID ?? env.CHAIN_ID);
  const nodeEnv = normalizeValue(env.NODE_ENV);
  if (chainId === '31337' && nodeEnv === 'development') {
    return 'onchain';
  }

  return 'simulation';
}

export function isOnchainPerpSettlementMode(
  env: Record<string, string | undefined> = process.env
): boolean {
  const mode = getPerpSettlementMode(env);
  return mode === 'onchain' || mode === 'hybrid';
}
