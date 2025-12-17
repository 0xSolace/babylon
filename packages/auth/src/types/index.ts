/**
 * Decentralized Auth Types
 *
 * Core type definitions for the TEE/MPC-based authentication system.
 * Replaces Privy with a fully decentralized alternative.
 */

import type { Address, Hex } from 'viem';

// ============================================================================
// DID (Decentralized Identifier)
// ============================================================================

/**
 * Decentralized Identifier for a user
 * Format: did:jeju:<network>:<publicKey>
 */
export type DID = `did:jeju:${string}:${string}`;

/**
 * DID Document containing user's public information
 */
export interface DIDDocument {
  /** The DID string */
  id: DID;
  /** Verification methods (public keys) */
  verificationMethod: VerificationMethod[];
  /** Authentication methods */
  authentication: string[];
  /** Linked accounts (social, wallet) */
  linkedAccounts: LinkedAccount[];
  /** Creation timestamp */
  created: number;
  /** Last update timestamp */
  updated: number;
}

export interface VerificationMethod {
  id: string;
  type: 'EcdsaSecp256k1VerificationKey2019';
  controller: DID;
  publicKeyHex: Hex;
}

// ============================================================================
// Authentication Methods
// ============================================================================

export type AuthMethod =
  | EmailAuth
  | WalletAuth
  | FarcasterAuth
  | TwitterAuth
  | DiscordAuth;

export interface EmailAuth {
  type: 'email';
  email: string;
  /** HMAC of verification code */
  codeHash: Hex;
}

export interface WalletAuth {
  type: 'wallet';
  address: Address;
  /** EIP-191 or EIP-712 signature */
  signature: Hex;
  /** Message that was signed */
  message: string;
  /** Timestamp to prevent replay */
  timestamp: number;
}

export interface FarcasterAuth {
  type: 'farcaster';
  fid: number;
  /** Farcaster custody address signature */
  signature: Hex;
  /** Message that was signed */
  message: string;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

export interface TwitterAuth {
  type: 'twitter';
  /** OAuth code from PKCE flow */
  code: string;
  /** PKCE code verifier */
  codeVerifier: string;
  /** State parameter for CSRF protection */
  state: string;
}

export interface DiscordAuth {
  type: 'discord';
  /** OAuth code from PKCE flow */
  code: string;
  /** PKCE code verifier */
  codeVerifier: string;
  /** State parameter for CSRF protection */
  state: string;
}

// ============================================================================
// Linked Accounts
// ============================================================================

export interface LinkedAccount {
  type: 'email' | 'wallet' | 'farcaster' | 'twitter' | 'discord';
  identifier: string;
  verifiedAt: number;
  metadata?: LinkedAccountMetadata;
}

export interface LinkedAccountMetadata {
  // Farcaster
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  // Twitter
  twitterId?: string;
  twitterUsername?: string;
  // Discord
  discordId?: string;
  discordUsername?: string;
  // Wallet
  chainId?: number;
}

// ============================================================================
// MPC Network
// ============================================================================

/**
 * MPC Node information
 */
export interface MPCNode {
  /** Node identifier */
  nodeId: string;
  /** Node's public endpoint */
  endpoint: string;
  /** TEE attestation quote */
  attestation: AttestationQuote;
  /** Node's public key for encrypted communication */
  publicKey: Hex;
  /** Whether this node is healthy */
  healthy: boolean;
  /** Last heartbeat timestamp */
  lastHeartbeat: number;
}

/**
 * TEE Attestation Quote
 */
export interface AttestationQuote {
  /** Measurement of enclave code */
  mrEnclave: Hex;
  /** Report data (includes operator address) */
  reportData: Hex;
  /** CPU attestation signature */
  cpuSignature: Hex;
  /** GPU attestation signature (if applicable) */
  gpuSignature?: Hex;
  /** Quote timestamp */
  timestamp: number;
  /** Operator address derived in TEE */
  operatorAddress: Address;
  /** Whether this is simulated (dev mode) */
  isSimulated: boolean;
}

/**
 * MPC Key Share (encrypted, stored on each node)
 */
export interface EncryptedKeyShare {
  /** Node that holds this share */
  nodeId: string;
  /** User's DID */
  userId: DID;
  /** Encrypted share data */
  ciphertext: Hex;
  /** IV for AES-GCM */
  iv: Hex;
  /** Auth tag for AES-GCM */
  authTag: Hex;
  /** Key version (for rotation) */
  version: number;
}

/**
 * Threshold signature from MPC network
 */
export interface ThresholdSignature {
  /** The signature bytes */
  signature: Hex;
  /** Which nodes participated */
  participants: string[];
  /** Threshold used (e.g., 2 of 3) */
  threshold: number;
  /** Total nodes in network */
  totalNodes: number;
  /** Recovery ID for signature */
  recoveryId: number;
}

// ============================================================================
// Authentication Tokens
// ============================================================================

/**
 * JWT claims for auth tokens
 */
export interface JejuAuthClaims {
  /** Subject - the user's DID */
  sub: DID;
  /** Issuer - the MPC network identifier */
  iss: string;
  /** Audience - the application */
  aud: string;
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
  /** User's primary wallet address */
  walletAddress?: Address;
  /** Linked account types */
  linkedTypes: string[];
}

/**
 * Session token (stored in HTTP-only cookie)
 */
export interface SessionToken {
  /** The JWT string */
  token: string;
  /** When the token expires */
  expiresAt: number;
  /** User's DID */
  userId: DID;
}

// ============================================================================
// Key Backup & Recovery
// ============================================================================

/**
 * Key backup (encrypted, user-controlled)
 */
export interface KeyBackup {
  /** Backup version */
  version: number;
  /** User's DID */
  userId: DID;
  /** Encrypted master key */
  encryptedKey: Hex;
  /** Salt for key derivation */
  salt: Hex;
  /** IV for encryption */
  iv: Hex;
  /** Key derivation iterations */
  iterations: number;
  /** Backup creation timestamp */
  createdAt: number;
}

/**
 * Recovery proof (used to recover access)
 */
export interface RecoveryProof {
  type: 'social' | 'backup' | 'oauth';
  /** Proof data depends on type */
  data: SocialRecoveryProof | BackupRecoveryProof | OAuthRecoveryProof;
}

export interface SocialRecoveryProof {
  /** Guardians who approved recovery */
  guardians: Address[];
  /** Their signatures */
  signatures: Hex[];
  /** Recovery request hash */
  requestHash: Hex;
}

export interface BackupRecoveryProof {
  /** The encrypted backup */
  backup: KeyBackup;
  /** Decrypted backup (user provides password) */
  decryptedKey: Hex;
}

export interface OAuthRecoveryProof {
  /** OAuth provider */
  provider: 'twitter' | 'discord' | 'farcaster';
  /** Fresh OAuth token */
  token: string;
  /** User's identifier on that platform */
  identifier: string;
}

// ============================================================================
// Paymaster (Gas Sponsorship)
// ============================================================================

/**
 * Paymaster decision
 */
export interface PaymasterDecision {
  /** Whether to sponsor */
  sponsor: boolean;
  /** Reason for decision */
  reason: string;
  /** Maximum gas to sponsor */
  maxGas?: bigint;
  /** Validity period (seconds) */
  validUntil?: number;
}

/**
 * User Operation (ERC-4337)
 */
export interface UserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
}

/**
 * Paymaster data for sponsored operations
 */
export interface PaymasterData {
  paymaster: Address;
  paymasterData: Hex;
  validUntil: number;
  validAfter: number;
}

// ============================================================================
// OAuth PKCE
// ============================================================================

export interface PKCEChallenge {
  /** Code verifier (random, kept client-side) */
  codeVerifier: string;
  /** Code challenge (S256 hash of verifier) */
  codeChallenge: string;
  /** State parameter */
  state: string;
  /** Nonce for additional security */
  nonce: string;
  /** When this challenge expires */
  expiresAt: number;
}

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
  scope: string;
}

// ============================================================================
// Auth State
// ============================================================================

export interface AuthState {
  /** Whether auth is ready */
  ready: boolean;
  /** Whether user is authenticated */
  authenticated: boolean;
  /** Current user's DID */
  userId: DID | null;
  /** User's primary wallet address */
  walletAddress: Address | null;
  /** Linked accounts */
  linkedAccounts: LinkedAccount[];
  /** Whether profile is loading */
  loading: boolean;
}

export interface AuthActions {
  /** Login with any supported method */
  login: (method: AuthMethod) => Promise<SessionToken>;
  /** Logout and clear session */
  logout: () => Promise<void>;
  /** Link an additional auth method */
  linkAccount: (method: AuthMethod) => Promise<void>;
  /** Unlink an auth method */
  unlinkAccount: (
    type: LinkedAccount['type'],
    identifier: string
  ) => Promise<void>;
  /** Refresh the session token */
  refreshToken: () => Promise<SessionToken>;
  /** Get current access token */
  getAccessToken: () => Promise<string | null>;
  /** Sign a message with MPC wallet */
  signMessage: (message: string) => Promise<Hex>;
  /** Sign typed data (EIP-712) */
  signTypedData: (typedData: unknown) => Promise<Hex>;
  /** Export key backup */
  exportBackup: (password: string) => Promise<KeyBackup>;
  /** Recover with backup */
  recoverWithBackup: (backup: KeyBackup, password: string) => Promise<void>;
}
