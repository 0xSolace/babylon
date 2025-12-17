/**
 * Client Types
 *
 * Types for the client-side auth SDK.
 */

import type { Address, Hex } from 'viem';
import type {
  AuthActions,
  AuthMethod,
  AuthState,
  DID,
  LinkedAccount,
} from '../types/index';

export interface PaymasterConfig {
  /** Treasury contract address */
  treasuryAddress: Address;
  /** Paymaster operator private key */
  operatorPrivateKey: Hex;
  /** RPC URL */
  rpcUrl: string;
  /** Chain ID */
  chainId: number;
  /** Default gas amount to fund (in wei) */
  defaultGasAmount?: string;
  /** Sponsorship policy overrides */
  policy?: {
    maxGasPerTx?: bigint;
    maxGasPerUserPerDay?: bigint;
    whitelistedContracts?: Address[];
    blacklistedContracts?: Address[];
    newUsersOnly?: boolean;
    minReputation?: number;
  };
}

export interface JejuAuthConfig {
  /** MPC network endpoints */
  mpcEndpoints?: string[];
  /** Network to use */
  network: 'mainnet' | 'testnet' | 'localnet';
  /** Redirect URI for OAuth */
  redirectUri?: string;
  /** OAuth client IDs */
  oauth?: {
    twitter?: string;
    discord?: string;
  };
  /** Farcaster config */
  farcaster?: {
    neynarApiKey?: string;
  };
  /** Paymaster configuration for gas sponsorship */
  paymasterConfig?: PaymasterConfig;
  /** RPC URL (shortcut, also in paymasterConfig) */
  rpcUrl?: string;
  /** Chain ID (shortcut, also in paymasterConfig) */
  chainId?: number;
}

export interface JejuAuthState extends AuthState {
  /** Configuration */
  config: JejuAuthConfig;
  /** Error if any */
  error: string | null;
}

export interface JejuAuthContextValue extends JejuAuthState, AuthActions {
  /** Initiate login with specific method */
  loginWithEmail: (email: string) => Promise<void>;
  loginWithWallet: () => Promise<void>;
  loginWithFarcaster: () => Promise<void>;
  loginWithTwitter: () => Promise<void>;
  loginWithDiscord: () => Promise<void>;
  /** Verify email code */
  verifyEmailCode: (code: string) => Promise<void>;
  /** Get current session */
  getSession: () => SessionData | null;
  /** Check if user has gas */
  hasGas: () => Promise<boolean>;
  /** Request gas from treasury */
  requestGas: () => Promise<boolean>;
}

export interface SessionData {
  /** User's DID */
  userId: DID;
  /** Session token (JWT) */
  token: string;
  /** Token expiration */
  expiresAt: number;
  /** Wallet address */
  walletAddress: Address;
  /** Linked accounts */
  linkedAccounts: LinkedAccount[];
}

export interface LoginState {
  /** Current step in login flow */
  step:
    | 'idle'
    | 'method-select'
    | 'email-input'
    | 'email-verify'
    | 'wallet-connect'
    | 'oauth-redirect'
    | 'farcaster-sign'
    | 'complete';
  /** Selected method */
  method: AuthMethod['type'] | null;
  /** Email for email flow */
  email?: string;
  /** Error message */
  error?: string;
}
