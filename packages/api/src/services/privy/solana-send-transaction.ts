import { logger } from '@babylon/shared';
import { extractPrivyApiDiagnostics } from './error-diagnostics';
import { getPrivyOfflineConfig } from './offline-config';
import { getPrivyNodeClient } from './privy-node';
import { buildSponsoredSolanaTransactionIdempotencyKey } from './solana-idempotency';

function resolveSolanaCaip2(): string {
  const cluster = process.env.SOLANA_REGISTRY_CLUSTER ?? 'mainnet-beta';

  switch (cluster) {
    case 'devnet':
      return 'solana:devnet';
    case 'testnet':
      return 'solana:testnet';
    case 'localnet':
      return 'solana:localnet';
    case 'mainnet-beta':
    default:
      return 'solana:mainnet';
  }
}

export async function sendSponsoredSolanaTransaction({
  walletId,
  transaction,
}: {
  walletId: string;
  transaction: string;
}): Promise<{ hash: string; transactionId?: string; caip2: string }> {
  const privy = getPrivyNodeClient();
  const offlineConfig = getPrivyOfflineConfig();
  const caip2 = resolveSolanaCaip2();
  const idempotencyKey = buildSponsoredSolanaTransactionIdempotencyKey({
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
        sponsor: true,
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
      'Failed to submit sponsored Solana transaction via Privy',
      {
        walletId,
        ...extractPrivyApiDiagnostics(error),
      },
      'sendSponsoredSolanaTransaction'
    );

    throw error instanceof Error
      ? error
      : new Error('Failed to submit sponsored Solana transaction');
  }
}
