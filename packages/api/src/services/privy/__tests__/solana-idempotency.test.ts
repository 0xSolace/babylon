import { describe, expect, it } from 'bun:test';
import { buildSolanaTransactionIdempotencyKey } from '../solana-idempotency';

const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

describe('buildSolanaTransactionIdempotencyKey', () => {
  it('is stable for the same transaction payload', () => {
    const keyA = buildSolanaTransactionIdempotencyKey({
      walletId: 'wallet-1',
      transaction: 'tx-body-1',
      caip2: SOLANA_MAINNET_CAIP2,
    });
    const keyB = buildSolanaTransactionIdempotencyKey({
      walletId: 'wallet-1',
      transaction: 'tx-body-1',
      caip2: SOLANA_MAINNET_CAIP2,
    });

    expect(keyA).toBe(keyB);
    expect(keyA.startsWith('solana-tx:v1:')).toBe(true);
  });

  it('changes when the request body changes', () => {
    const keyA = buildSolanaTransactionIdempotencyKey({
      walletId: 'wallet-1',
      transaction: 'tx-body-1',
      caip2: SOLANA_MAINNET_CAIP2,
    });
    const keyB = buildSolanaTransactionIdempotencyKey({
      walletId: 'wallet-1',
      transaction: 'tx-body-2',
      caip2: SOLANA_MAINNET_CAIP2,
    });

    expect(keyA).not.toBe(keyB);
  });
});
