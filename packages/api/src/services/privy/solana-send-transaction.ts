import { logger } from '@babylon/shared';
import { extractPrivyApiDiagnostics } from './error-diagnostics';
import { getPrivyOfflineConfig } from './offline-config';
import { getPrivyNodeClient } from './privy-node';
import { buildSolanaTransactionIdempotencyKey } from './solana-idempotency';

function resolveSolanaCaip2(): string {
  const cluster = process.env.SOLANA_CLUSTER ?? 'mainnet-beta';

  switch (cluster) {
    case 'devnet':
      return 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
    case 'testnet':
      return 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z';
    case 'localnet':
      return 'solana:localnet';
    case 'mainnet-beta':
    default:
      return 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
  }
}

export async function sendSolanaTransaction({
  walletId,
  transaction,
}: {
  walletId: string;
  transaction: string;
}): Promise<{ hash: string; transactionId?: string; caip2: string }> {
  const privy = getPrivyNodeClient();
  const offlineConfig = getPrivyOfflineConfig();
  const caip2 = resolveSolanaCaip2();
  const idempotencyKey = buildSolanaTransactionIdempotencyKey({
    walletId,
    transaction,
    caip2,
  });

  try {
    const response = await privy
      .wallets()
      .solana()
      .signAndSendTransaction(walletId, {
        caip2,
        transaction,
        authorization_context: {
          authorization_private_keys: [offlineConfig.authorizationPrivateKey],
        },
        idempotency_key: idempotencyKey,
      });

    return {
      hash: response.hash,
      transactionId: response.transaction_id,
      caip2: response.caip2,
    };
  } catch (error) {
    logger.error(
      'Failed to submit Solana transaction via Privy',
      {
        walletId,
        ...extractPrivyApiDiagnostics(error),
      },
      'sendSolanaTransaction'
    );

    throw error instanceof Error
      ? error
      : new Error('Failed to submit Solana transaction');
  }
}
