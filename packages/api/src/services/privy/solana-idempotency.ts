import { createHash } from 'node:crypto';

export function buildSolanaTransactionIdempotencyKey({
  walletId,
  transaction,
  caip2,
}: {
  walletId: string;
  transaction: string;
  caip2: string;
}): string {
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        walletId,
        caip2,
        transaction,
      })
    )
    .digest('hex');

  return `solana-tx:v1:${digest}`;
}
