import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

const ORIGINAL_ENV = { ...process.env };

const {
  getPrivyOfflineConfig,
  getPrivySolanaOfflineConfig,
} = await import('../offline-config');

describe('offline-config', () => {
  beforeEach(() => {
    process.env.PRIVY_APP_ID = 'test-app-id';
    process.env.PRIVY_APP_SECRET = 'test-secret';
    process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY = 'test-authorization-key';
    process.env.PRIVY_OFFLINE_SIGNER_ID = 'offline-signer-id';
    process.env.PRIVY_OFFLINE_POLICY_ID = 'evm-policy-id';
    process.env.PRIVY_SOLANA_OFFLINE_POLICY_ID = 'solana-policy-id';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('keeps the existing EVM policy wiring unchanged', () => {
    const config = getPrivyOfflineConfig();

    expect(config.offlinePolicyId).toBe('evm-policy-id');
    expect(config.offlineSignerId).toBe('offline-signer-id');
  });

  it('uses the dedicated Solana policy env for Solana flows', () => {
    const config = getPrivySolanaOfflineConfig();

    expect(config.offlinePolicyId).toBe('solana-policy-id');
    expect(config.offlineSignerId).toBe('offline-signer-id');
  });

  it('fails clearly when the Solana policy env is missing', () => {
    delete process.env.PRIVY_SOLANA_OFFLINE_POLICY_ID;

    expect(() => getPrivySolanaOfflineConfig()).toThrow(
      'PRIVY_SOLANA_OFFLINE_POLICY_ID'
    );
  });
});
