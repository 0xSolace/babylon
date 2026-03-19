import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockSignTransaction = mock();
const mockBroadcastSignedSolanaTransaction = mock();

mock.module('@babylon/agents/solana-registry', () => ({
  broadcastSignedSolanaTransaction: mockBroadcastSignedSolanaTransaction,
}));

mock.module('@babylon/shared', () => ({
  logger: {
    error: mock(),
    warn: mock(),
    info: mock(),
    debug: mock(),
  },
}));

mock.module('../offline-config', () => ({
  getPrivyOfflineConfig: () => ({
    appId: 'test-app-id',
    appSecret: 'test-secret',
    authorizationPrivateKey: 'test-authorization-key',
  }),
}));

mock.module('../privy-node', () => ({
  getPrivyNodeClient: () => ({
    wallets: () => ({
      solana: () => ({
        signTransaction: mockSignTransaction,
      }),
    }),
  }),
}));

const { isSolanaBlockhashNotFoundError, sendSolanaTransaction } = await import(
  '../solana-send-transaction'
);

describe('sendSolanaTransaction', () => {
  beforeEach(() => {
    mockSignTransaction.mockReset();
    mockBroadcastSignedSolanaTransaction.mockReset();
    process.env.SOLANA_CLUSTER = 'mainnet-beta';
  });

  it('signs with Privy and broadcasts via the configured Solana RPC', async () => {
    mockSignTransaction.mockResolvedValue({
      signed_transaction: 'signed-base64-tx',
      encoding: 'base64',
    });
    mockBroadcastSignedSolanaTransaction.mockResolvedValue({
      hash: 'solana-signature-1',
    });

    const result = await sendSolanaTransaction({
      walletId: 'wallet-1',
      transaction: 'unsigned-base64-tx',
    });

    expect(mockSignTransaction).toHaveBeenCalledWith('wallet-1', {
      transaction: 'unsigned-base64-tx',
      authorization_context: {
        authorization_private_keys: ['test-authorization-key'],
      },
      idempotency_key: expect.stringContaining('solana-tx:v1:'),
    });
    expect(mockBroadcastSignedSolanaTransaction).toHaveBeenCalledWith({
      transaction: 'signed-base64-tx',
    });
    expect(result).toEqual({
      hash: 'solana-signature-1',
      caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    });
  });
});

describe('isSolanaBlockhashNotFoundError', () => {
  it('matches plain RPC errors without Privy provider metadata', () => {
    expect(
      isSolanaBlockhashNotFoundError(
        new Error('Transaction simulation failed: Blockhash not found')
      )
    ).toBe(true);
  });
});
