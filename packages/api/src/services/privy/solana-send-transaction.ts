import { broadcastSignedSolanaTransaction } from '@babylon/agents/solana-registry';
import { logger } from '@babylon/shared';
import { extractPrivyApiDiagnostics } from './error-diagnostics';
import { getPrivySolanaOfflineConfig } from './offline-config';
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

export type SolanaConfirmationStrategy = {
  blockhash: string;
  lastValidBlockHeight: number;
};

export async function signSolanaTransaction({
  walletId,
  transaction,
}: {
  walletId: string;
  transaction: string;
}): Promise<{ signedTransaction: string; caip2: string }> {
  const privy = getPrivyNodeClient();
  const offlineConfig = getPrivySolanaOfflineConfig();
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
      .signTransaction(walletId, {
        transaction,
        authorization_context: {
          authorization_private_keys: [offlineConfig.authorizationPrivateKey],
        },
        idempotency_key: idempotencyKey,
      });

    return {
      signedTransaction: response.signed_transaction,
      caip2,
    };
  } catch (error) {
    const diagnostics = extractPrivyApiDiagnostics(error);
    logger.error(
      'Failed to sign Solana transaction via Privy',
      {
        walletId,
        ...diagnostics,
      },
      'sendSolanaTransaction'
    );

    if (diagnostics.providerCode === 'policy_violation') {
      throw new Error(
        'Privy Solana policy violation: the configured Solana offline policy must allow signTransaction for agent registration.'
      );
    }

    throw error instanceof Error
      ? error
      : new Error('Failed to submit Solana transaction');
  }
}

export async function sendSolanaTransaction({
  walletId,
  transaction,
  confirmationStrategy,
}: {
  walletId: string;
  transaction: string;
  confirmationStrategy?: SolanaConfirmationStrategy;
}): Promise<{ hash: string; transactionId?: string; caip2: string }> {
  const signed = await signSolanaTransaction({
    walletId,
    transaction,
  });

  const broadcast = await broadcastSignedSolanaTransaction({
    transaction: signed.signedTransaction,
    confirmationStrategy,
  });

  return {
    hash: broadcast.hash,
    caip2: signed.caip2,
  };
}

export function isSolanaBlockhashNotFoundError(error: unknown): boolean {
  const diagnostics = extractPrivyApiDiagnostics(error);
  const combinedMessage = [
    diagnostics.errorMessage,
    diagnostics.providerMessage,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  return combinedMessage.includes('blockhash not found');
}
