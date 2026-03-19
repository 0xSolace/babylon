import { describe, expect, it } from 'bun:test';
import { buildSolanaTransactionIdempotencyKey } from '../solana-idempotency';

describe('buildSolanaTransactionIdempotencyKey', () => {
  it('is stable for the same transaction payload', () => {
    const keyA = buildSolanaTransactionIdempotencyKey({
      walletId: 'wallet-1',
      transaction: 'tx-body-1',
      caip2: 'solana:mainnet',
    });
    const keyB = buildSolanaTransactionIdempotencyKey({
      walletId: 'wallet-1',
      transaction: 'tx-body-1',
      caip2: 'solana:mainnet',
    });

    expect(keyA).toBe(keyB);
    expect(keyA.startsWith('solana-tx:v1:')).toBe(true);
  });

  it('changes when the request body changes', () => {
    const keyA = buildSolanaTransactionIdempotencyKey({
      walletId: 'wallet-1',
      transaction: 'tx-body-1',
      caip2: 'solana:mainnet',
    });
    const keyB = buildSolanaTransactionIdempotencyKey({
      walletId: 'wallet-1',
      transaction: 'tx-body-2',
      caip2: 'solana:mainnet',
    });

    expect(keyA).not.toBe(keyB);
  });
});
