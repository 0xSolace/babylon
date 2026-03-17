import { getPrivyAppIdFromEnv, getTrimmedEnv } from '../../env';

export type PrivyOfflineConfig = {
  appId: string;
  appSecret: string;
  authorizationPrivateKey: string;
  offlineSignerId: string;
  offlinePolicyId: string;
};

function formatMissingFields(missing: string[]): string {
  return missing.join(', ');
}

export function getPrivyOfflineConfig(): PrivyOfflineConfig {
  return getPrivyOfflineConfigForPolicyEnv('PRIVY_OFFLINE_POLICY_ID');
}

export function getPrivySolanaOfflineConfig(): PrivyOfflineConfig {
  return getPrivyOfflineConfigForPolicyEnv('PRIVY_SOLANA_OFFLINE_POLICY_ID');
}

function getPrivyOfflineConfigForPolicyEnv(
  policyEnvName: 'PRIVY_OFFLINE_POLICY_ID' | 'PRIVY_SOLANA_OFFLINE_POLICY_ID'
): PrivyOfflineConfig {
  const appId = getPrivyAppIdFromEnv();
  const appSecret = getTrimmedEnv('PRIVY_APP_SECRET');
  const authorizationPrivateKey = getTrimmedEnv(
    'PRIVY_AUTHORIZATION_PRIVATE_KEY'
  );
  const offlineSignerId = getTrimmedEnv('PRIVY_OFFLINE_SIGNER_ID');
  const offlinePolicyId = getTrimmedEnv(policyEnvName);

  const missing: string[] = [];
  if (!appId) missing.push('PRIVY_APP_ID (or NEXT_PUBLIC_PRIVY_APP_ID)');
  if (!appSecret) missing.push('PRIVY_APP_SECRET');
  if (!authorizationPrivateKey) missing.push('PRIVY_AUTHORIZATION_PRIVATE_KEY');
  if (!offlineSignerId) missing.push('PRIVY_OFFLINE_SIGNER_ID');
  if (!offlinePolicyId) missing.push(policyEnvName);

  if (missing.length > 0) {
    throw new Error(
      `Privy offline configuration is incomplete: missing ${formatMissingFields(missing)}`
    );
  }

  return {
    appId: appId!,
    appSecret: appSecret!,
    authorizationPrivateKey: authorizationPrivateKey!,
    offlineSignerId: offlineSignerId!,
    offlinePolicyId: offlinePolicyId!,
  };
}

export function assertPrivyOfflineConfig(): void {
  getPrivyOfflineConfig();
}
