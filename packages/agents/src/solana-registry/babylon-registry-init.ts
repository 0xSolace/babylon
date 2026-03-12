import { db } from '@babylon/db';
import { getA2AEndpoint, getMCPEndpoint } from '@babylon/shared';
import { logger } from '../shared/logger';
import { generateSnowflakeId } from '../shared/snowflake';
import type { JsonValue } from '../types/common';
import {
  buildSolanaRegistrationFile,
  decodeSolanaSecretKey,
  deriveDeterministicSolanaRegistryAsset,
  getSolanaRegistryAgent,
  isSolanaRegistryEnabled,
  logSolanaRegistrySkip,
  prepareSolanaRegistrationTransaction,
  sendSignedSolanaRegistrationTransaction,
} from './sdk';

export interface BabylonSolanaRegistrationResult {
  assetId: string;
  metadataUri: string;
  txHash: string;
  registeredAt: string;
}

const GAME_CONFIG_KEY = 'solana_registry_registration';

export async function registerBabylonOnSolana(): Promise<BabylonSolanaRegistrationResult | null> {
  if (!isSolanaRegistryEnabled()) {
    logSolanaRegistrySkip(
      'Solana registry integration disabled, skipping Babylon Solana registration',
      {}
    );
    return null;
  }

  const signerSecret = process.env.BABYLON_SOLANA_PRIVATE_KEY;
  if (!signerSecret) {
    logSolanaRegistrySkip(
      'BABYLON_SOLANA_PRIVATE_KEY not configured, skipping Babylon Solana registration',
      {}
    );
    return null;
  }

  const existing = await db.gameConfig.findUnique({
    where: { key: GAME_CONFIG_KEY },
  });

  if (existing?.value) {
    const value = existing.value as Record<string, JsonValue>;
    if (value.assetId && value.metadataUri && value.txHash) {
      return {
        assetId: String(value.assetId),
        metadataUri: String(value.metadataUri),
        txHash: String(value.txHash),
        registeredAt: String(value.registeredAt ?? new Date().toISOString()),
      };
    }
  }

  const signer = decodeSolanaSecretKey(signerSecret);
  const asset = deriveDeterministicSolanaRegistryAsset('babylon-app');
  const existingOnchain = await getSolanaRegistryAgent(asset.publicKey);
  const existingValue = (existing?.value ?? null) as Record<
    string,
    JsonValue
  > | null;

  if (existingOnchain) {
    const metadataUri = String(existingValue?.metadataUri ?? '');
    const txHash = String(existingValue?.txHash ?? '');
    const registeredAt = String(
      existingValue?.registeredAt ?? new Date().toISOString()
    );

    await db.gameConfig.upsert({
      where: { key: GAME_CONFIG_KEY },
      create: {
        id: await generateSnowflakeId(),
        key: GAME_CONFIG_KEY,
        value: {
          registered: true,
          assetId: asset.publicKey.toBase58(),
          metadataUri,
          txHash,
          registeredAt,
        },
        updatedAt: new Date(),
      },
      update: {
        value: {
          registered: true,
          assetId: asset.publicKey.toBase58(),
          metadataUri,
          txHash,
          registeredAt,
        },
      },
    });

    return {
      assetId: asset.publicKey.toBase58(),
      metadataUri,
      txHash,
      registeredAt,
    };
  }

  const registrationFile = buildSolanaRegistrationFile({
    name: 'Babylon Prediction Markets',
    description: 'Real-time prediction market game with autonomous AI agents',
    image: process.env.BABYLON_LOGO_URL ?? null,
    walletAddress: signer.publicKey.toBase58(),
    a2aEndpoint: getA2AEndpoint(),
    mcpEndpoint: getMCPEndpoint(),
    x402Support: true,
    metadata: {
      platform: 'babylon',
      kind: 'app',
      network: 'solana',
    },
    skills: [
      'query_markets',
      'place_bet',
      'buy_prediction',
      'sell_prediction',
      'open_perp_position',
      'close_perp_position',
      'get_balance',
      'get_positions',
    ],
    domains: ['prediction-markets', 'social', 'trading'],
  });

  const prepared = await prepareSolanaRegistrationTransaction({
    ownerWalletAddress: signer.publicKey.toBase58(),
    assetSeed: 'babylon-app',
    registrationFile,
  });

  const txHash = await sendSignedSolanaRegistrationTransaction({
    transaction: prepared.transaction,
    signers: [signer],
  });

  const result: BabylonSolanaRegistrationResult = {
    assetId: prepared.asset.toBase58(),
    metadataUri: prepared.metadataUri,
    txHash,
    registeredAt: new Date().toISOString(),
  };

  await db.gameConfig.upsert({
    where: { key: GAME_CONFIG_KEY },
    create: {
      id: await generateSnowflakeId(),
      key: GAME_CONFIG_KEY,
      value: {
        registered: true,
        assetId: result.assetId,
        metadataUri: result.metadataUri,
        txHash: result.txHash,
        registeredAt: result.registeredAt,
      },
      updatedAt: new Date(),
    },
    update: {
      value: {
        registered: true,
        assetId: result.assetId,
        metadataUri: result.metadataUri,
        txHash: result.txHash,
        registeredAt: result.registeredAt,
      },
    },
  });

  logger.info(
    'Babylon registered on the Solana Agent Registry',
    result,
    'SolanaRegistry'
  );

  return result;
}
