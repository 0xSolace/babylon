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
  type PreparedTransaction,
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

function createSolanaRegistryConnection(): Connection {
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
  prepared: PreparedTransaction,
  signers: Keypair[]
): string {
  const transaction = Transaction.from(
    Buffer.from(prepared.transaction, 'base64')
  );
  transaction.partialSign(...signers);
  return transaction
    .serialize({ requireAllSignatures: false })
    .toString('base64');
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
  transaction: string;
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
    transaction: signPreparedTransaction(prepared, [asset]),
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
