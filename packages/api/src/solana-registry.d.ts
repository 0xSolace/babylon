declare module '@babylon/agents/solana-registry' {
  import type { Keypair } from '@solana/web3.js';
  import type { RegistrationFile, SolanaSDK } from '8004-solana';

  export const SOLANA_REGISTRATION_MIN_BALANCE_LAMPORTS: bigint;

  export function assertSolanaRegistryConfigured(): void;

  export function buildAgentSolanaRegistrationFile(params: {
    name: string;
    description: string;
    image?: string | null;
    walletAddress: string;
    a2aEndpoint: string;
    mcpEndpoint: string;
    metadata?: Record<string, unknown>;
    skills?: string[];
    domains?: string[];
  }): RegistrationFile;

  export function deriveDeterministicAgentSolanaAsset(
    agentUserId: string
  ): Keypair;

  export function signAgentSolanaRegistrationTransaction(params: {
    agentUserId: string;
    transaction: string;
    recentBlockhash: string;
  }): string;

  export function finalizeAgentSolanaRegistrationTransaction(params: {
    agentUserId: string;
    transaction: string;
  }): Promise<{
    transaction: string;
    blockhash: string;
    lastValidBlockHeight: number;
  }>;

  export function broadcastSignedSolanaTransaction(params: {
    transaction: string;
    confirmationStrategy?: {
      blockhash: string;
      lastValidBlockHeight: number;
    };
  }): Promise<{ hash: string }>;

  export function prepareAgentSolanaRegistrationTransaction(params: {
    agentUserId: string;
    ownerWalletAddress: string;
    registrationFile: RegistrationFile;
  }): Promise<{
    assetId: string;
    metadataUri: string;
    metadataCid: string;
    transactionTemplate: string;
  }>;

  export function getAgentSolanaRegistration(
    assetId: string
  ): Promise<Awaited<ReturnType<SolanaSDK['getAgent']>>>;

  export function getSolanaWalletBalanceLamports(
    walletAddress: string
  ): Promise<bigint>;

  export function formatLamportsAsSol(lamports: bigint): string;
}
