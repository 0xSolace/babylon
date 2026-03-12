import { createHash } from 'node:crypto';
import {
  type Commitment,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  IPFSClient,
  type PreparedTransaction,
  type RegistrationFile,
  ServiceType,
  SOLANA_DEVNET_RPC,
  SOLANA_MAINNET_RPC,
  SolanaSDK,
  type SolanaSDKConfig,
} from '8004-solana';
import bs58 from 'bs58';
import { logger } from '../shared/logger';

const DEFAULT_COMMITMENT: Commitment = 'confirmed';

function resolveSolanaRegistryCluster(): SolanaSDKConfig['cluster'] {
  const cluster = process.env.SOLANA_REGISTRY_CLUSTER ?? 'mainnet-beta';
  if (
    cluster === 'devnet' ||
    cluster === 'testnet' ||
    cluster === 'mainnet-beta' ||
    cluster === 'localnet'
  ) {
    return cluster;
  }

  throw new Error(
    `Unsupported SOLANA_REGISTRY_CLUSTER value: ${cluster}. Expected devnet, testnet, mainnet-beta, or localnet.`
  );
}

function resolveSolanaRegistryRpcUrl(): string {
  const cluster = resolveSolanaRegistryCluster();
  if (process.env.SOLANA_REGISTRY_RPC_URL) {
    return process.env.SOLANA_REGISTRY_RPC_URL;
  }

  return cluster === 'devnet' ? SOLANA_DEVNET_RPC : SOLANA_MAINNET_RPC;
}

export function isSolanaRegistryEnabled(): boolean {
  return process.env.SOLANA_REGISTRY_ENABLED === 'true';
}

export function assertSolanaRegistryConfigured(): void {
  if (!isSolanaRegistryEnabled()) {
    throw new Error(
      'Solana agent registry is disabled. Set SOLANA_REGISTRY_ENABLED=true to enable it.'
    );
  }

  resolveSolanaRegistryRpcUrl();
  createSolanaRegistryIpfsClient();
}

export function createSolanaRegistryIpfsClient(): IPFSClient {
  const pinataJwt = process.env.PINATA_JWT;
  const filecoinPrivateKey = process.env.FILECOIN_PRIVATE_KEY;
  const nodeUrl = process.env.AGENT0_IPFS_API;

  if (pinataJwt) {
    return new IPFSClient({
      pinataEnabled: true,
      pinataJwt,
    });
  }

  if (filecoinPrivateKey) {
    return new IPFSClient({
      filecoinPinEnabled: true,
      filecoinPrivateKey,
    });
  }

  if (nodeUrl) {
    return new IPFSClient({ url: nodeUrl });
  }

  throw new Error(
    'Solana registry metadata upload is not configured. Set PINATA_JWT, FILECOIN_PRIVATE_KEY, or AGENT0_IPFS_API.'
  );
}

export function createSolanaRegistrySdk(
  config: Pick<SolanaSDKConfig, 'signer'> = {}
): SolanaSDK {
  return new SolanaSDK({
    cluster: resolveSolanaRegistryCluster(),
    rpcUrl: resolveSolanaRegistryRpcUrl(),
    signer: config.signer,
    ipfsClient: createSolanaRegistryIpfsClient(),
  });
}

export function createSolanaRegistryConnection(): Connection {
  return new Connection(resolveSolanaRegistryRpcUrl(), DEFAULT_COMMITMENT);
}

export function deriveDeterministicSolanaRegistryAsset(seed: string): Keypair {
  const digest = createHash('sha256')
    .update(`babylon:solana-registry:${seed}`)
    .digest();
  return Keypair.fromSeed(digest);
}

export function decodeSolanaSecretKey(secret: string): Keypair {
  const trimmed = secret.trim();

  if (trimmed.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)));
  }

  if (trimmed.includes(',')) {
    return Keypair.fromSecretKey(
      Uint8Array.from(
        trimmed
          .split(',')
          .map((part) => Number.parseInt(part.trim(), 10))
          .filter((part) => Number.isFinite(part))
      )
    );
  }

  try {
    return Keypair.fromSecretKey(bs58.decode(trimmed));
  } catch {
    return Keypair.fromSecretKey(Buffer.from(trimmed, 'base64'));
  }
}

export function buildSolanaRegistrationFile({
  name,
  description,
  image,
  walletAddress,
  a2aEndpoint,
  mcpEndpoint,
  x402Support = false,
  active = true,
  metadata,
  skills,
  domains,
}: {
  name: string;
  description: string;
  image?: string | null;
  walletAddress: string;
  a2aEndpoint?: string | null;
  mcpEndpoint?: string | null;
  x402Support?: boolean;
  active?: boolean;
  metadata?: Record<string, unknown>;
  skills?: string[];
  domains?: string[];
}): RegistrationFile {
  const services: RegistrationFile['services'] = [
    { type: ServiceType.WALLET, value: walletAddress },
  ];

  if (a2aEndpoint) {
    services.push({ type: ServiceType.A2A, value: a2aEndpoint });
  }

  if (mcpEndpoint) {
    services.push({ type: ServiceType.MCP, value: mcpEndpoint });
  }

  return {
    name,
    description,
    image: image ?? undefined,
    walletAddress,
    services,
    active,
    x402Support,
    metadata,
    skills,
    domains,
    updatedAt: Date.now(),
  };
}

export async function uploadSolanaRegistrationFile(
  file: RegistrationFile
): Promise<{ cid: string; uri: string }> {
  const ipfs = createSolanaRegistryIpfsClient();
  const cid = await ipfs.addRegistrationFile(file);
  return {
    cid,
    uri: `ipfs://${cid}`,
  };
}

function signPreparedTransaction(
  prepared: PreparedTransaction,
  signers: Keypair[]
): string {
  const transaction = Transaction.from(
    Buffer.from(prepared.transaction, 'base64')
  );
  if (signers.length > 0) {
    transaction.partialSign(...signers);
  }
  return transaction
    .serialize({ requireAllSignatures: false })
    .toString('base64');
}

export async function prepareSolanaRegistrationTransaction({
  ownerWalletAddress,
  assetSeed,
  registrationFile,
}: {
  ownerWalletAddress: string;
  assetSeed: string;
  registrationFile: RegistrationFile;
}): Promise<{
  asset: PublicKey;
  metadataUri: string;
  metadataCid: string;
  transaction: string;
}> {
  assertSolanaRegistryConfigured();

  const sdk = createSolanaRegistrySdk();
  const asset = deriveDeterministicSolanaRegistryAsset(assetSeed);
  const { cid, uri } = await uploadSolanaRegistrationFile(registrationFile);
  const prepared = await sdk.registerAgent(uri, {
    skipSend: true,
    signer: new PublicKey(ownerWalletAddress),
    assetPubkey: asset.publicKey,
  });

  if (!('transaction' in prepared)) {
    throw new Error('Expected a prepared Solana registration transaction');
  }

  return {
    asset: prepared.asset,
    metadataCid: cid,
    metadataUri: uri,
    transaction: signPreparedTransaction(prepared, [asset]),
  };
}

export async function sendSignedSolanaRegistrationTransaction({
  transaction,
  signers,
}: {
  transaction: string;
  signers: Keypair[];
}): Promise<string> {
  const connection = createSolanaRegistryConnection();
  const tx = Transaction.from(Buffer.from(transaction, 'base64'));
  if (signers.length > 0) {
    tx.partialSign(...signers);
  }
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: DEFAULT_COMMITMENT,
  });
  await connection.confirmTransaction(signature, DEFAULT_COMMITMENT);
  return signature;
}

export async function getSolanaRegistryAgent(
  asset: string | PublicKey
): Promise<Awaited<ReturnType<SolanaSDK['getAgent']>>> {
  const sdk = createSolanaRegistrySdk();
  return sdk.getAgent(typeof asset === 'string' ? new PublicKey(asset) : asset);
}

export function logSolanaRegistrySkip(
  message: string,
  context: Record<string, unknown>
): void {
  logger.info(message, context, 'SolanaRegistry');
}
