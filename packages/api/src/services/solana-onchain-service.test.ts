import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockPrepareSolanaRegistrationTransaction = mock();
const mockGetSolanaRegistryAgent = mock();
const mockAssertSolanaRegistryConfigured = mock();
const mockSendSponsoredSolanaTransaction = mock();

const capturedUpdates: Array<Record<string, unknown>> = [];
let selectRow: Record<string, unknown> | null = null;

const usersTable = {
  id: 'id',
  solanaRegistered: 'solanaRegistered',
  solanaRegistryAssetId: 'solanaRegistryAssetId',
  solanaMetadataUri: 'solanaMetadataUri',
  solanaRegistrationTxHash: 'solanaRegistrationTxHash',
};

mock.module('@babylon/agents', () => ({
  assertSolanaRegistryConfigured: mockAssertSolanaRegistryConfigured,
  buildSolanaRegistrationFile: (input: unknown) => input,
  getSolanaRegistryAgent: mockGetSolanaRegistryAgent,
  prepareSolanaRegistrationTransaction:
    mockPrepareSolanaRegistrationTransaction,
}));

mock.module('@babylon/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (selectRow ? [selectRow] : []),
        }),
      }),
    }),
    update: () => ({
      set: (data: Record<string, unknown>) => {
        capturedUpdates.push(data);
        return {
          where: async () => undefined,
        };
      },
    }),
  },
  eq: (...args: unknown[]) => args,
  users: usersTable,
}));

mock.module('./privy/solana-send-transaction', () => ({
  sendSponsoredSolanaTransaction: mockSendSponsoredSolanaTransaction,
}));

const { registerExistingIdentityOnSolana } = await import(
  './solana-onchain-service'
);

describe('registerExistingIdentityOnSolana', () => {
  beforeEach(() => {
    capturedUpdates.length = 0;
    selectRow = {
      id: 'user-1',
      solanaRegistered: false,
      solanaRegistryAssetId: null,
      solanaMetadataUri: null,
      solanaRegistrationTxHash: null,
    };

    mockAssertSolanaRegistryConfigured.mockReset();
    mockGetSolanaRegistryAgent.mockReset();
    mockPrepareSolanaRegistrationTransaction.mockReset();
    mockSendSponsoredSolanaTransaction.mockReset();

    process.env.SOLANA_REGISTRY_ENABLED = 'true';
    mockAssertSolanaRegistryConfigured.mockReturnValue(undefined);
    mockGetSolanaRegistryAgent.mockResolvedValue(null);
    mockPrepareSolanaRegistrationTransaction.mockResolvedValue({
      asset: { toBase58: () => 'asset-123' },
      metadataUri: 'ipfs://cid-123',
      metadataCid: 'cid-123',
      transaction: 'base64-tx',
    });
    mockSendSponsoredSolanaTransaction.mockResolvedValue({
      hash: 'tx-123',
      caip2: 'solana:mainnet',
    });
  });

  it('registers a fresh Solana identity and persists dedicated Solana fields', async () => {
    const result = await registerExistingIdentityOnSolana({
      userId: 'user-1',
      privyId: 'did:privy:user-1',
      privyWalletId: 'wallet-solana-1',
      solanaWalletAddress: 'SoLAddre55',
      username: 'alice',
      displayName: 'Alice',
      bio: 'Babylon user',
      entityType: 'user',
    });

    expect(result.alreadyRegistered).toBe(false);
    expect(result.assetId).toBe('asset-123');
    expect(result.txHash).toBe('tx-123');
    expect(mockSendSponsoredSolanaTransaction).toHaveBeenCalledWith({
      walletId: 'wallet-solana-1',
      transaction: 'base64-tx',
      idempotencyKey: 'solana-registration:user-1',
    });
    expect(capturedUpdates.at(-1)).toMatchObject({
      privySolanaWalletId: 'wallet-solana-1',
      solanaWalletAddress: 'SoLAddre55',
      solanaRegistered: true,
      solanaRegistryAssetId: 'asset-123',
      solanaMetadataUri: 'ipfs://cid-123',
      solanaRegistrationTxHash: 'tx-123',
    });
  });

  it('short-circuits when Solana registration is already persisted in DB', async () => {
    selectRow = {
      id: 'user-1',
      solanaRegistered: true,
      solanaRegistryAssetId: 'asset-existing',
      solanaMetadataUri: 'ipfs://cid-existing',
      solanaRegistrationTxHash: 'tx-existing',
    };

    const result = await registerExistingIdentityOnSolana({
      userId: 'user-1',
      privyId: 'did:privy:user-1',
      privyWalletId: 'wallet-solana-1',
      solanaWalletAddress: 'SoLAddre55',
      entityType: 'user',
    });

    expect(result.alreadyRegistered).toBe(true);
    expect(result.assetId).toBe('asset-existing');
    expect(mockPrepareSolanaRegistrationTransaction).not.toHaveBeenCalled();
    expect(mockSendSponsoredSolanaTransaction).not.toHaveBeenCalled();
  });

  it('surfaces missing Solana env/config cleanly', async () => {
    mockAssertSolanaRegistryConfigured.mockImplementation(() => {
      throw new Error('Solana agent registry is disabled.');
    });

    await expect(
      registerExistingIdentityOnSolana({
        userId: 'user-1',
        privyId: 'did:privy:user-1',
        privyWalletId: 'wallet-solana-1',
        solanaWalletAddress: 'SoLAddre55',
        entityType: 'user',
      })
    ).rejects.toThrow('Solana agent registry is disabled.');
  });

  it('recovers from DB partial failure by reconciling a deterministic on-chain asset on retry', async () => {
    mockGetSolanaRegistryAgent.mockResolvedValue({ owner: 'onchain' });

    const result = await registerExistingIdentityOnSolana({
      userId: 'user-1',
      privyId: 'did:privy:user-1',
      privyWalletId: 'wallet-solana-1',
      solanaWalletAddress: 'SoLAddre55',
      entityType: 'agent',
      username: 'agent-alpha',
    });

    expect(result.alreadyRegistered).toBe(true);
    expect(result.assetId).toBe('asset-123');
    expect(mockSendSponsoredSolanaTransaction).not.toHaveBeenCalled();
    expect(capturedUpdates.at(-1)).toMatchObject({
      solanaRegistered: true,
      solanaRegistryAssetId: 'asset-123',
      solanaMetadataUri: 'ipfs://cid-123',
    });
  });
});
