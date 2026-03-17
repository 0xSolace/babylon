import { createHash } from 'node:crypto';

export function buildSponsoredSolanaTransactionIdempotencyKey({
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
        sponsor: true,
      })
    )
    .digest('hex');

  return `solana-sponsored-tx:v1:${digest}`;
}
