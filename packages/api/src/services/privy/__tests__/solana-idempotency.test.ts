import { describe, expect, it } from 'bun:test';
import { buildSponsoredSolanaTransactionIdempotencyKey } from '../solana-idempotency';

describe('buildSponsoredSolanaTransactionIdempotencyKey', () => {
  it('is stable for the same sponsored request payload', () => {
    const keyA = buildSponsoredSolanaTransactionIdempotencyKey({
      walletId: 'wallet-1',
      transaction: 'tx-body-1',
      caip2: 'solana:mainnet',
    });
    const keyB = buildSponsoredSolanaTransactionIdempotencyKey({
      walletId: 'wallet-1',
      transaction: 'tx-body-1',
      caip2: 'solana:mainnet',
    });

    expect(keyA).toBe(keyB);
    expect(keyA.startsWith('solana-sponsored-tx:v1:')).toBe(true);
  });

  it('changes when the sponsored request body changes', () => {
    const keyA = buildSponsoredSolanaTransactionIdempotencyKey({
      walletId: 'wallet-1',
      transaction: 'tx-body-1',
      caip2: 'solana:mainnet',
    });
    const keyB = buildSponsoredSolanaTransactionIdempotencyKey({
      walletId: 'wallet-1',
      transaction: 'tx-body-2',
      caip2: 'solana:mainnet',
    });

    expect(keyA).not.toBe(keyB);
  });
});
