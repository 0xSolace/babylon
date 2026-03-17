import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockGetAgentSolanaRegistration = mock();
const mockPrepareAgentSolanaRegistrationTransaction = mock();
const mockEnsureSolanaWalletReady = mock();
const mockSendSponsoredSolanaTransaction = mock();
const mockAssertSolanaRegistryConfigured = mock();
const mockAcquireLock = mock();
const mockReleaseLock = mock();
let capturedRegistrationFileInput: Record<string, unknown> | null = null;

let selectResults: Array<unknown[]> = [];
const capturedUpdates: Array<Record<string, unknown>> = [];
const capturedInserts: Array<Record<string, unknown>> = [];

const usersTable = {
  id: 'id',
  username: 'username',
  displayName: 'displayName',
  bio: 'bio',
  profileImageUrl: 'profileImageUrl',
  isAgent: 'isAgent',
  managedBy: 'managedBy',
  privyId: 'privyId',
  privySolanaWalletId: 'privySolanaWalletId',
  solanaWalletAddress: 'solanaWalletAddress',
  solanaOfflineWalletReady: 'solanaOfflineWalletReady',
  solanaRegistered: 'solanaRegistered',
  solanaRegistryAssetId: 'solanaRegistryAssetId',
  solanaMetadataUri: 'solanaMetadataUri',
  solanaRegistrationTxHash: 'solanaRegistrationTxHash',
  virtualBalance: 'virtualBalance',
} as const;

mock.module('@babylon/agents/solana-registry', () => ({
  assertSolanaRegistryConfigured: mockAssertSolanaRegistryConfigured,
  buildAgentSolanaRegistrationFile: (input: Record<string, unknown>) => {
    capturedRegistrationFileInput = input;
    return input;
  },
  deriveDeterministicAgentSolanaAsset: () => ({
    publicKey: { toBase58: () => 'asset-deterministic' },
  }),
  getAgentSolanaRegistration: mockGetAgentSolanaRegistration,
  prepareAgentSolanaRegistrationTransaction:
    mockPrepareAgentSolanaRegistrationTransaction,
}));

mock.module('@babylon/db', () => ({
  and: (...args: unknown[]) => args,
  balanceTransactions: 'BalanceTransaction',
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectResults.shift() ?? [],
        }),
      }),
    }),
    update: () => ({
      set: (data: Record<string, unknown>) => {
        capturedUpdates.push(data);
        return {
          where: () => ({
            returning: async () => selectResults.shift() ?? [],
          }),
        };
      },
    }),
    insert: () => ({
      values: async (data: Record<string, unknown>) => {
        capturedInserts.push(data);
      },
    }),
  },
  eq: (...args: unknown[]) => args,
  sql: (strings: TemplateStringsArray) => strings.join(''),
  users: usersTable,
}));

mock.module('@babylon/shared', () => ({
  BusinessLogicError: class BusinessLogicError extends Error {
    constructor(
      message: string,
      public code: string
    ) {
      super(message);
    }
  },
  generateSnowflakeId: mock().mockResolvedValue('snowflake-1'),
  getBaseUrl: () => 'https://play.babylon.market',
  getMCPEndpoint: () => 'https://play.babylon.market/api/mcp',
  logger: {
    debug: mock(),
    info: mock(),
    warn: mock(),
    error: mock(),
  },
  POINTS: {
    ONCHAIN_REGISTRATION: 100,
  },
}));

mock.module('./privy/solana-wallet-provisioning', () => ({
  ensureSolanaWalletReady: mockEnsureSolanaWalletReady,
}));

mock.module('./privy/solana-send-transaction', () => ({
  sendSponsoredSolanaTransaction: mockSendSponsoredSolanaTransaction,
}));

mock.module('./distributed-lock-service', () => ({
  DistributedLockService: {
    acquireLock: mockAcquireLock,
    releaseLock: mockReleaseLock,
  },
}));

const { getAgentSolanaRegistrationStatus, registerAgentOnSolanaForOwner } =
  await import('./agent-solana-registration-service');

const BASE_AGENT = {
  id: 'agent-1',
  username: 'agent-one',
  displayName: 'Agent One',
  bio: 'Autonomous AI agent',
  profileImageUrl: null,
  isAgent: true,
  managedBy: 'owner-1',
  privyId: 'did:privy:agent-1',
  privySolanaWalletId: null,
  solanaWalletAddress: null,
  solanaOfflineWalletReady: false,
  solanaRegistered: false,
  solanaRegistryAssetId: null,
  solanaMetadataUri: null,
  solanaRegistrationTxHash: null,
};

describe('agent-solana-registration-service', () => {
  beforeEach(() => {
    selectResults = [];
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    capturedRegistrationFileInput = null;
    mockGetAgentSolanaRegistration.mockReset();
    mockPrepareAgentSolanaRegistrationTransaction.mockReset();
    mockEnsureSolanaWalletReady.mockReset();
    mockSendSponsoredSolanaTransaction.mockReset();
    mockAssertSolanaRegistryConfigured.mockReset();
    mockAcquireLock.mockReset();
    mockReleaseLock.mockReset();

    process.env.SOLANA_REGISTRY_ENABLED = 'true';
    mockAssertSolanaRegistryConfigured.mockReturnValue(undefined);
    mockAcquireLock.mockResolvedValue(true);
    mockReleaseLock.mockResolvedValue(undefined);
    mockEnsureSolanaWalletReady.mockResolvedValue({
      privyWalletId: 'solana-wallet-1',
      walletAddress: 'SoLWallet111',
      offlineWalletReady: true,
      createdWallet: true,
    });
    mockPrepareAgentSolanaRegistrationTransaction.mockResolvedValue({
      assetId: 'asset-123',
      metadataUri: 'ipfs://cid-123',
      metadataCid: 'cid-123',
      transaction: 'base64-tx',
    });
    mockSendSponsoredSolanaTransaction.mockResolvedValue({
      hash: 'tx-123',
      transactionId: 'tx-123',
      caip2: 'solana:mainnet',
    });
  });

  it('returns status for an owned agent', async () => {
    selectResults.push([BASE_AGENT]);

    const status = await getAgentSolanaRegistrationStatus({
      ownerUserId: 'owner-1',
      agentUserId: 'agent-1',
    });

    expect(status.isRegistered).toBe(false);
    expect(status.cost).toBe(100);
  });

  it('registers an agent on Solana, charges points once, and persists Solana-specific fields', async () => {
    selectResults.push([BASE_AGENT]);
    selectResults.push([{ virtualBalance: '900' }]);

    mockGetAgentSolanaRegistration
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await registerAgentOnSolanaForOwner({
      ownerUserId: 'owner-1',
      agentUserId: 'agent-1',
    });

    expect(result.alreadyRegistered).toBe(false);
    expect(result.assetId).toBe('asset-123');
    expect(result.txHash).toBe('tx-123');
    expect(mockSendSponsoredSolanaTransaction).toHaveBeenCalledWith({
      walletId: 'solana-wallet-1',
      transaction: 'base64-tx',
    });
    expect(capturedRegistrationFileInput?.skills).toEqual([]);
    expect(capturedRegistrationFileInput?.domains).toEqual([]);
    expect(
      capturedUpdates.some((update) => update.solanaRegistered === true)
    ).toBe(true);
    expect(
      capturedInserts.some(
        (insert) => insert.description === 'Agent Solana registration'
      )
    ).toBe(true);
  });

  it('returns already registered without charging when DB is already in sync', async () => {
    selectResults.push([
      {
        ...BASE_AGENT,
        solanaRegistered: true,
        solanaRegistryAssetId: 'asset-existing',
        solanaMetadataUri: 'ipfs://cid-existing',
        solanaRegistrationTxHash: 'tx-existing',
      },
    ]);

    const result = await registerAgentOnSolanaForOwner({
      ownerUserId: 'owner-1',
      agentUserId: 'agent-1',
    });

    expect(result.alreadyRegistered).toBe(true);
    expect(result.cost).toBe(0);
    expect(capturedInserts).toHaveLength(0);
    expect(mockSendSponsoredSolanaTransaction).not.toHaveBeenCalled();
  });

  it('surfaces missing Solana configuration cleanly', async () => {
    selectResults.push([BASE_AGENT]);
    mockAssertSolanaRegistryConfigured.mockImplementationOnce(() => {
      throw new Error('Solana agent registration is disabled.');
    });

    await expect(
      registerAgentOnSolanaForOwner({
        ownerUserId: 'owner-1',
        agentUserId: 'agent-1',
      })
    ).rejects.toThrow('Solana agent registration is disabled.');
    expect(capturedInserts).toHaveLength(0);
    expect(capturedUpdates).toHaveLength(0);
  });

  it('refunds when Solana preparation fails after charging the owner', async () => {
    selectResults.push([BASE_AGENT]);
    selectResults.push([{ virtualBalance: '900' }]);

    mockGetAgentSolanaRegistration
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockPrepareAgentSolanaRegistrationTransaction.mockRejectedValueOnce(
      new Error('Solana agent registration is disabled.')
    );

    await expect(
      registerAgentOnSolanaForOwner({
        ownerUserId: 'owner-1',
        agentUserId: 'agent-1',
      })
    ).rejects.toThrow('Solana agent registration is disabled.');
    expect(
      capturedInserts.some(
        (insert) =>
          insert.description === 'Refund - agent Solana registration failed'
      )
    ).toBe(true);
  });

  it('reconciles a partial failure without double-charging when the deterministic asset is already on-chain', async () => {
    selectResults.push([BASE_AGENT]);

    mockGetAgentSolanaRegistration.mockResolvedValueOnce({ owner: 'onchain' });

    const result = await registerAgentOnSolanaForOwner({
      ownerUserId: 'owner-1',
      agentUserId: 'agent-1',
    });

    expect(result.alreadyRegistered).toBe(true);
    expect(result.cost).toBe(0);
    expect(capturedInserts).toHaveLength(0);
  });

  it('blocks concurrent registration attempts before charging points', async () => {
    selectResults.push([BASE_AGENT]);
    mockAcquireLock.mockResolvedValueOnce(false);

    await expect(
      registerAgentOnSolanaForOwner({
        ownerUserId: 'owner-1',
        agentUserId: 'agent-1',
      })
    ).rejects.toThrow('already in progress');

    expect(capturedInserts).toHaveLength(0);
    expect(mockSendSponsoredSolanaTransaction).not.toHaveBeenCalled();
  });

  it('reconciles on-chain success after a post-send failure without refunding', async () => {
    selectResults.push([BASE_AGENT]);
    selectResults.push([{ virtualBalance: '900' }]);

    mockGetAgentSolanaRegistration
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ owner: 'onchain' });
    mockSendSponsoredSolanaTransaction.mockRejectedValueOnce(
      new Error('Privy returned an unexpected response')
    );

    const result = await registerAgentOnSolanaForOwner({
      ownerUserId: 'owner-1',
      agentUserId: 'agent-1',
    });

    expect(result.assetId).toBe('asset-123');
    expect(result.walletAddress).toBe('SoLWallet111');
    expect(
      capturedInserts.some(
        (insert) =>
          insert.description === 'Refund - agent Solana registration failed'
      )
    ).toBe(false);
  });
});
