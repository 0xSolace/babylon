import { describe, expect, it } from 'bun:test';
import { assessAgentWalletState } from '../identity/agent-wallet-state';

describe('assessAgentWalletState', () => {
  it('classifies a fully ready wallet state as ready', () => {
    const result = assessAgentWalletState({
      privyId: 'did:privy:agent-1',
      privyWalletId: 'wallet-1',
      walletAddress: '0x0000000000000000000000000000000000000001',
      offlineWalletReady: true,
    });

    expect(result.classification).toBe('ready');
    expect(result.remediationAction).toBe('none');
    expect(result.isReady).toBe(true);
  });

  it('classifies an empty state as requiring a new Privy user', () => {
    const result = assessAgentWalletState({
      privyId: null,
      privyWalletId: null,
      walletAddress: null,
      offlineWalletReady: false,
    });

    expect(result.classification).toBe('empty');
    expect(result.remediationAction).toBe('provision_with_new_privy_user');
  });

  it('reuses a real Privy user id when wallet readiness is missing', () => {
    const result = assessAgentWalletState({
      privyId: 'did:privy:agent-2',
      privyWalletId: null,
      walletAddress: null,
      offlineWalletReady: false,
    });

    expect(result.classification).toBe('recover_with_existing_privy_user');
    expect(result.remediationAction).toBe('provision_with_existing_privy_user');
  });

  it('forces recreation when legacy synthetic ids are present', () => {
    const result = assessAgentWalletState({
      privyId: 'dev_agent-3',
      privyWalletId: 'dev_wallet_agent-3',
      walletAddress: '0x0000000000000000000000000000000000000003',
      offlineWalletReady: false,
    });

    expect(result.classification).toBe('recreate_privy_user');
    expect(result.remediationAction).toBe('provision_with_new_privy_user');
    expect(result.hasSyntheticPrivyId).toBe(true);
    expect(result.hasSyntheticPrivyWalletId).toBe(true);
  });

  it('treats wallet-address-only state as requiring a new Privy user', () => {
    const result = assessAgentWalletState({
      privyId: null,
      privyWalletId: null,
      walletAddress: '0x0000000000000000000000000000000000000004',
      offlineWalletReady: false,
    });

    expect(result.classification).toBe('recreate_privy_user');
    expect(result.remediationAction).toBe('provision_with_new_privy_user');
  });
});
