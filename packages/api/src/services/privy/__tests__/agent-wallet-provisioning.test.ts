import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockUsersCreate = mock();
const mockGetByCustomAuthID = mock();
const mockEnsureOfflineWalletReady = mock();

mock.module('@babylon/shared', () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

mock.module('../privy-node', () => ({
  getPrivyNodeClient: () => ({
    users: () => ({
      create: mockUsersCreate,
      getByCustomAuthID: mockGetByCustomAuthID,
    }),
  }),
}));

mock.module('../offline-wallet-provisioning', () => ({
  ensureOfflineWalletReady: mockEnsureOfflineWalletReady,
}));

const { provisionAgentPrivyWallet, isPrivyNotFoundError } = await import(
  '../agent-wallet-provisioning'
);

describe('provisionAgentPrivyWallet', () => {
  beforeEach(() => {
    mockUsersCreate.mockReset();
    mockGetByCustomAuthID.mockReset();
    mockEnsureOfflineWalletReady.mockReset();
    mockGetByCustomAuthID.mockRejectedValue(new Error('404 not found'));

    process.env.PRIVY_APP_ID = 'test-app-id';
    process.env.PRIVY_APP_SECRET = 'test-secret';
    process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY = 'test-authorization-key';
    process.env.PRIVY_OFFLINE_SIGNER_ID = 'offline-signer-id';
    process.env.PRIVY_OFFLINE_POLICY_ID = 'offline-policy-id';
  });

  it('reuses an existing Privy user when provided', async () => {
    mockEnsureOfflineWalletReady.mockResolvedValue({
      privyWalletId: 'wallet-1',
      walletAddress: '0x0000000000000000000000000000000000000001',
      offlineWalletReady: true,
      createdWallet: false,
      updatedSigner: false,
    });

    const result = await provisionAgentPrivyWallet({
      agentUserId: 'agent-123',
      existingPrivyId: 'did:privy:agent-123',
    });

    expect(mockUsersCreate).not.toHaveBeenCalled();
    expect(mockEnsureOfflineWalletReady).toHaveBeenCalledWith({
      privyId: 'did:privy:agent-123',
    });
    expect(result).toEqual({
      privyId: 'did:privy:agent-123',
      privyWalletId: 'wallet-1',
      walletAddress: '0x0000000000000000000000000000000000000001',
      offlineWalletReady: true,
      createdPrivyUser: false,
      createdWallet: false,
      updatedSigner: false,
    });
  });

  it('creates a server-managed Privy user and validates wallet readiness', async () => {
    mockUsersCreate.mockResolvedValue({
      id: 'did:privy:new-agent',
      wallet: {
        id: 'wallet-created',
        address: '0x00000000000000000000000000000000000000aa',
        chain_type: 'ethereum',
      },
      linked_accounts: [],
    });
    mockEnsureOfflineWalletReady.mockResolvedValue({
      privyWalletId: 'wallet-created',
      walletAddress: '0x00000000000000000000000000000000000000aa',
      offlineWalletReady: true,
      createdWallet: false,
      updatedSigner: false,
    });

    const result = await provisionAgentPrivyWallet({
      agentUserId: 'agent-456',
    });

    expect(mockUsersCreate).toHaveBeenCalledTimes(1);
    expect(mockGetByCustomAuthID).toHaveBeenCalledWith({
      custom_user_id: 'babylon-agent:agent-456',
    });
    expect(mockUsersCreate).toHaveBeenCalledWith({
      linked_accounts: [
        {
          type: 'custom_auth',
          custom_user_id: 'babylon-agent:agent-456',
        },
      ],
      custom_metadata: {
        babylon_agent_user_id: 'agent-456',
        babylon_user_type: 'agent',
      },
      wallets: [
        {
          chain_type: 'ethereum',
          additional_signers: [
            {
              signer_id: 'offline-signer-id',
              override_policy_ids: ['offline-policy-id'],
            },
          ],
          policy_ids: [],
        },
      ],
    });
    expect(mockEnsureOfflineWalletReady).toHaveBeenCalledWith({
      privyId: 'did:privy:new-agent',
    });
    expect(result.createdPrivyUser).toBe(true);
    expect(result.privyId).toBe('did:privy:new-agent');
    expect(result.privyWalletId).toBe('wallet-created');
  });

  it('reuses an existing custom-auth Privy user before creating a new one', async () => {
    mockGetByCustomAuthID.mockResolvedValue({
      id: 'did:privy:existing-agent',
      wallet: {
        id: 'wallet-existing',
        address: '0x00000000000000000000000000000000000000bb',
        chain_type: 'ethereum',
      },
      linked_accounts: [],
    });
    mockEnsureOfflineWalletReady.mockResolvedValue({
      privyWalletId: 'wallet-existing',
      walletAddress: '0x00000000000000000000000000000000000000bb',
      offlineWalletReady: true,
      createdWallet: false,
      updatedSigner: false,
    });

    const result = await provisionAgentPrivyWallet({
      agentUserId: 'agent-999',
    });

    expect(mockUsersCreate).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      privyId: 'did:privy:existing-agent',
      createdPrivyUser: false,
    });
  });

  it('fails when Privy user creation does not return an id', async () => {
    mockUsersCreate.mockResolvedValue({
      id: null,
      linked_accounts: [],
    });

    await expect(
      provisionAgentPrivyWallet({
        agentUserId: 'agent-789',
      })
    ).rejects.toThrow('Failed to create Privy user for agent');

    expect(mockEnsureOfflineWalletReady).not.toHaveBeenCalled();
  });
});

describe('isPrivyNotFoundError', () => {
  it('returns true for an error containing "404"', () => {
    expect(
      isPrivyNotFoundError(new Error('Request failed with status 404'))
    ).toBe(true);
  });

  it('returns true for an error containing "not found" (lowercase)', () => {
    expect(isPrivyNotFoundError(new Error('user not found'))).toBe(true);
  });

  it('returns true for an error containing "Not Found" (mixed case)', () => {
    expect(isPrivyNotFoundError(new Error('Not Found'))).toBe(true);
  });

  it('returns false for an error with an unrelated message', () => {
    expect(isPrivyNotFoundError(new Error('internal server error'))).toBe(
      false
    );
  });

  it('returns false for a non-Error thrown value', () => {
    expect(isPrivyNotFoundError('404 not found')).toBe(false);
    expect(isPrivyNotFoundError({ message: 'not found' })).toBe(false);
    expect(isPrivyNotFoundError(null)).toBe(false);
  });
});
