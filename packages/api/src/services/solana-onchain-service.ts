import {
  assertSolanaRegistryConfigured,
  buildSolanaRegistrationFile,
  getSolanaRegistryAgent,
  prepareSolanaRegistrationTransaction,
} from '@babylon/agents';
import { db, eq, users } from '@babylon/db';
import { BusinessLogicError, logger } from '@babylon/shared';
import { sendSponsoredSolanaTransaction } from './privy/solana-send-transaction';

export interface SolanaOnchainRegistrationResult {
  message: string;
  assetId?: string;
  metadataUri?: string;
  txHash?: string;
  alreadyRegistered: boolean;
  userId: string;
  network: 'solana';
}

function buildSolanaAssetSeed(
  kind: 'user' | 'agent' | 'app',
  id: string
): string {
  return `${kind}:${id}`;
}

export async function registerExistingIdentityOnSolana({
  userId,
  privyId,
  privyWalletId,
  solanaWalletAddress,
  username,
  displayName,
  bio,
  profileImageUrl,
  endpoint,
  entityType,
}: {
  userId: string;
  privyId: string;
  privyWalletId: string | null;
  solanaWalletAddress: string;
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  profileImageUrl?: string | null;
  endpoint?: string | null;
  entityType: 'user' | 'agent';
}): Promise<SolanaOnchainRegistrationResult> {
  try {
    assertSolanaRegistryConfigured();
  } catch (error) {
    throw new BusinessLogicError(
      error instanceof Error
        ? error.message
        : 'Solana registration is unavailable.',
      'SOLANA_REGISTRATION_UNAVAILABLE'
    );
  }

  if (!privyWalletId) {
    throw new BusinessLogicError(
      'Solana embedded wallet is not ready yet. Please try again in a moment.',
      'SOLANA_WALLET_UNAVAILABLE'
    );
  }

  const [dbUser] = await db
    .select({
      id: users.id,
      solanaRegistered: users.solanaRegistered,
      solanaRegistryAssetId: users.solanaRegistryAssetId,
      solanaMetadataUri: users.solanaMetadataUri,
      solanaRegistrationTxHash: users.solanaRegistrationTxHash,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!dbUser) {
    throw new BusinessLogicError('User not found.', 'USER_NOT_FOUND');
  }

  if (dbUser.solanaRegistered && dbUser.solanaRegistryAssetId) {
    return {
      message: 'Already registered on Solana',
      assetId: dbUser.solanaRegistryAssetId,
      metadataUri: dbUser.solanaMetadataUri ?? undefined,
      txHash: dbUser.solanaRegistrationTxHash ?? undefined,
      alreadyRegistered: true,
      userId,
      network: 'solana',
    };
  }

  if (dbUser.solanaRegistered && !dbUser.solanaRegistryAssetId) {
    await db
      .update(users)
      .set({
        solanaRegistered: false,
        solanaMetadataUri: null,
        solanaRegistrationTxHash: null,
        solanaRegisteredAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  const assetSeed = buildSolanaAssetSeed(entityType, userId);
  const preparedDescription =
    bio ||
    (entityType === 'agent'
      ? `Autonomous AI agent: ${username || userId}`
      : `Babylon user: ${username || displayName || userId}`);
  const registrationFile = buildSolanaRegistrationFile({
    name: displayName || username || userId,
    description: preparedDescription,
    image: profileImageUrl ?? null,
    walletAddress: solanaWalletAddress,
    a2aEndpoint: entityType === 'agent' ? (endpoint ?? null) : null,
    x402Support: entityType === 'agent',
    metadata: {
      platform: 'babylon',
      userType: entityType,
      privyId,
      network: 'solana',
    },
    skills:
      entityType === 'agent' ? ['trade', 'analyze', 'prediction-markets'] : [],
    domains:
      entityType === 'agent' ? ['prediction-markets', 'trading'] : ['social'],
  });

  const prepared = await prepareSolanaRegistrationTransaction({
    ownerWalletAddress: solanaWalletAddress,
    assetSeed,
    registrationFile,
  });

  const existingOnchain = await getSolanaRegistryAgent(prepared.asset);
  if (existingOnchain) {
    await db
      .update(users)
      .set({
        privyId,
        privySolanaWalletId: privyWalletId,
        solanaWalletAddress,
        solanaOfflineWalletReady: true,
        solanaOfflineWalletReadyAt: new Date(),
        solanaRegistered: true,
        solanaRegistryAssetId: prepared.asset.toBase58(),
        solanaMetadataUri: prepared.metadataUri,
        solanaRegisteredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return {
      message: 'Already registered on Solana',
      assetId: prepared.asset.toBase58(),
      metadataUri: prepared.metadataUri,
      txHash: dbUser.solanaRegistrationTxHash ?? undefined,
      alreadyRegistered: true,
      userId,
      network: 'solana',
    };
  }

  const tx = await sendSponsoredSolanaTransaction({
    walletId: privyWalletId,
    transaction: prepared.transaction,
    idempotencyKey: `solana-registration:${userId}`,
  });

  await db
    .update(users)
    .set({
      privyId,
      privySolanaWalletId: privyWalletId,
      solanaWalletAddress,
      solanaOfflineWalletReady: true,
      solanaOfflineWalletReadyAt: new Date(),
      solanaRegistered: true,
      solanaRegistryAssetId: prepared.asset.toBase58(),
      solanaMetadataUri: prepared.metadataUri,
      solanaRegistrationTxHash: tx.hash,
      solanaRegisteredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  logger.info(
    'Registered identity on the Solana Agent Registry',
    {
      userId,
      entityType,
      assetId: prepared.asset.toBase58(),
      txHash: tx.hash,
    },
    'SolanaOnchain'
  );

  return {
    message: `Successfully registered ${entityType} on Solana`,
    assetId: prepared.asset.toBase58(),
    metadataUri: prepared.metadataUri,
    txHash: tx.hash,
    alreadyRegistered: false,
    userId,
    network: 'solana',
  };
}
