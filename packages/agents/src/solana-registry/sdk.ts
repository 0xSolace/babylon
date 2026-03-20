import { createHash } from 'node:crypto';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  IPFSClient,
  type RegistrationFile,
  ServiceType,
  SOLANA_DEVNET_RPC,
  SOLANA_MAINNET_RPC,
  SolanaSDK,
  type SolanaSDKConfig,
} from '8004-solana';

function resolveSolanaCluster(): SolanaSDKConfig['cluster'] {
  const cluster = process.env.SOLANA_CLUSTER ?? 'mainnet-beta';

  if (
    cluster === 'devnet' ||
    cluster === 'testnet' ||
    cluster === 'mainnet-beta' ||
    cluster === 'localnet'
  ) {
    return cluster;
  }

  throw new Error(
    `Unsupported SOLANA_CLUSTER value: ${cluster}. Expected devnet, testnet, mainnet-beta, or localnet.`
  );
}

function resolveSolanaRpcUrl(): string {
  const cluster = resolveSolanaCluster();

  if (process.env.SOLANA_RPC_URL) {
    return process.env.SOLANA_RPC_URL;
  }

  return cluster === 'devnet' ? SOLANA_DEVNET_RPC : SOLANA_MAINNET_RPC;
}

// Empirically derived from mainnet registration simulations:
// 0.01 SOL passes the legacy app-level check but still fails rent during the
// actual CreateV2-based registry transaction. Keep a small buffer above the
// observed rent + fee floor and revalidate with the standalone debug harness
// if the registry transaction shape changes.
export const SOLANA_REGISTRATION_MIN_BALANCE_LAMPORTS = 21_000_000n;

export function assertSolanaRegistryConfigured(): void {
  if (process.env.SOLANA_REGISTRY_ENABLED !== 'true') {
    throw new Error(
      'Solana agent registration is disabled. Set SOLANA_REGISTRY_ENABLED=true to enable it.'
    );
  }

  resolveSolanaRpcUrl();
  createSolanaRegistryIpfsClient();
}

function createSolanaRegistryIpfsClient(): IPFSClient {
  const pinataJwt = process.env.PINATA_JWT?.trim();
  const filecoinPrivateKey = process.env.FILECOIN_PRIVATE_KEY?.trim();
  const nodeUrl = process.env.AGENT0_IPFS_API?.trim();

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
    'Solana agent metadata upload is not configured. Set PINATA_JWT, FILECOIN_PRIVATE_KEY, or AGENT0_IPFS_API.'
  );
}

function createSolanaRegistrySdk(
  config: Pick<SolanaSDKConfig, 'signer'> = {}
): SolanaSDK {
  return new SolanaSDK({
    cluster: resolveSolanaCluster(),
    rpcUrl: resolveSolanaRpcUrl(),
    signer: config.signer,
    ipfsClient: createSolanaRegistryIpfsClient(),
  });
}

export function getSolanaRegistryCluster(): SolanaSDKConfig['cluster'] {
  return resolveSolanaCluster();
}

export function getSolanaRegistryRpcUrl(): string {
  return resolveSolanaRpcUrl();
}

export function createSolanaRegistryConnection(): Connection {
  return new Connection(resolveSolanaRpcUrl(), 'confirmed');
}

export function buildAgentSolanaRegistrationFile({
  name,
  description,
  image,
  walletAddress,
  a2aEndpoint,
  mcpEndpoint,
  metadata,
  skills,
  domains,
}: {
  name: string;
  description: string;
  image?: string | null;
  walletAddress: string;
  a2aEndpoint: string;
  mcpEndpoint: string;
  metadata?: Record<string, unknown>;
  skills?: string[];
  domains?: string[];
}): RegistrationFile {
  return {
    name,
    description,
    image: image ?? undefined,
    walletAddress,
    services: [
      { type: ServiceType.WALLET, value: walletAddress },
      { type: ServiceType.A2A, value: a2aEndpoint },
      { type: ServiceType.MCP, value: mcpEndpoint },
    ],
    active: true,
    x402Support: true,
    metadata,
    skills,
    domains,
    updatedAt: Date.now(),
  };
}

async function uploadRegistrationFile(
  file: RegistrationFile
): Promise<{ cid: string; uri: string }> {
  const ipfs = createSolanaRegistryIpfsClient();
  const cid = await ipfs.addRegistrationFile(file);

  return {
    cid,
    uri: `ipfs://${cid}`,
  };
}

export function deriveDeterministicAgentSolanaAsset(
  agentUserId: string
): Keypair {
  // The asset keypair is intentionally deterministic so retries and
  // reconciliation always target the same registry asset. Treat this as a
  // stable infrastructure identity, not a secret seed: anyone with the agent
  // user id can derive the same asset public key.
  const digest = createHash('sha256')
    .update(`babylon:agent-solana:${agentUserId}`)
    .digest();

  return Keypair.fromSeed(digest);
}

function signPreparedTransaction(
  transactionBase64: string,
  signers: Keypair[],
  recentBlockhash?: string
): string {
  const transaction = Transaction.from(
    Buffer.from(transactionBase64, 'base64')
  );
  if (recentBlockhash) {
    transaction.recentBlockhash = recentBlockhash;
  }
  transaction.partialSign(...signers);
  return transaction
    .serialize({ requireAllSignatures: false })
    .toString('base64');
}

export function signAgentSolanaRegistrationTransaction({
  agentUserId,
  transaction,
  recentBlockhash,
}: {
  agentUserId: string;
  transaction: string;
  recentBlockhash: string;
}): string {
  const asset = deriveDeterministicAgentSolanaAsset(agentUserId);

  return signPreparedTransaction(transaction, [asset], recentBlockhash);
}

export async function finalizeAgentSolanaRegistrationTransaction({
  agentUserId,
  transaction,
}: {
  agentUserId: string;
  transaction: string;
}): Promise<{
  transaction: string;
  blockhash: string;
  lastValidBlockHeight: number;
}> {
  const connection = createSolanaRegistryConnection();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');

  return {
    transaction: signAgentSolanaRegistrationTransaction({
      agentUserId,
      transaction,
      recentBlockhash: blockhash,
    }),
    blockhash,
    lastValidBlockHeight,
  };
}

export async function broadcastSignedSolanaTransaction({
  transaction,
  confirmationStrategy,
}: {
  transaction: string;
  confirmationStrategy?: {
    blockhash: string;
    lastValidBlockHeight: number;
  };
}): Promise<{ hash: string }> {
  const connection = createSolanaRegistryConnection();
  const rawTransaction = Buffer.from(transaction, 'base64');
  const hash = await connection.sendRawTransaction(rawTransaction, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  });

  if (confirmationStrategy) {
    const confirmation = await connection.confirmTransaction(
      {
        signature: hash,
        blockhash: confirmationStrategy.blockhash,
        lastValidBlockHeight: confirmationStrategy.lastValidBlockHeight,
      },
      'confirmed'
    );

    if (confirmation.value.err) {
      throw new Error(
        `Solana transaction confirmation failed: ${JSON.stringify(confirmation.value.err)}`
      );
    }
  }

  return { hash };
}

export async function prepareAgentSolanaRegistrationTransaction({
  agentUserId,
  ownerWalletAddress,
  registrationFile,
}: {
  agentUserId: string;
  ownerWalletAddress: string;
  registrationFile: RegistrationFile;
}): Promise<{
  assetId: string;
  metadataUri: string;
  metadataCid: string;
  transactionTemplate: string;
}> {
  assertSolanaRegistryConfigured();

  const sdk = createSolanaRegistrySdk();
  const asset = deriveDeterministicAgentSolanaAsset(agentUserId);
  const { cid, uri } = await uploadRegistrationFile(registrationFile);

  const prepared = await sdk.registerAgent(uri, {
    skipSend: true,
    signer: new PublicKey(ownerWalletAddress),
    assetPubkey: asset.publicKey,
  });

  if (!('transaction' in prepared)) {
    throw new Error('Expected a prepared Solana registration transaction');
  }

  return {
    assetId: prepared.asset.toBase58(),
    metadataUri: uri,
    metadataCid: cid,
    transactionTemplate: prepared.transaction,
  };
}

export async function getAgentSolanaRegistration(
  assetId: string
): Promise<Awaited<ReturnType<SolanaSDK['getAgent']>>> {
  const sdk = createSolanaRegistrySdk();
  return sdk.getAgent(new PublicKey(assetId));
}

export async function getSolanaWalletBalanceLamports(
  walletAddress: string
): Promise<bigint> {
  const connection = createSolanaRegistryConnection();
  const balance = await connection.getBalance(new PublicKey(walletAddress));
  return BigInt(balance);
}

export function formatLamportsAsSol(lamports: bigint): string {
  const divisor = BigInt(LAMPORTS_PER_SOL);
  const whole = lamports / divisor;
  const fractional = (lamports % divisor).toString().padStart(9, '0');
  const trimmedFractional = fractional.replace(/0+$/, '');

  return trimmedFractional.length > 0
    ? `${whole}.${trimmedFractional}`
    : whole.toString();
}
