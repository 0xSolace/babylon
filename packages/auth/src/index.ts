/**
 * @babylon/auth
 *
 * Babylon-specific authentication layer built on @jejunetwork/auth.
 *
 * This package provides:
 * - Pre-configured defaults for Babylon apps
 * - Babylon-specific React hooks with sensible defaults
 * - Re-exports all @jejunetwork/auth functionality
 *
 * For most use cases, import directly from @jejunetwork/auth.
 * Use @babylon/auth when you need Babylon-specific defaults.
 *
 * @example
 * ```tsx
 * import { BabylonAuthProvider, useBabylonAuth } from '@babylon/auth';
 *
 * function App() {
 *   return (
 *     <BabylonAuthProvider>
 *       <MyApp />
 *     </BabylonAuthProvider>
 *   );
 * }
 *
 * function MyApp() {
 *   const { authenticated, loginWithWallet, logout } = useBabylonAuth();
 *
 *   if (!authenticated) {
 *     return <button onClick={loginWithWallet}>Connect</button>;
 *   }
 *
 *   return <button onClick={logout}>Sign Out</button>;
 * }
 * ```
 */

// =============================================================================
// Re-export all @jejunetwork/auth types and functions
// =============================================================================

// DID utilities
// Paymaster (Gas Sponsorship)
// MPC/FROST Signing
// OAuth Providers
// Farcaster
// Email/Phone Providers
// MFA
// Verifiable Credentials
// Infrastructure
// React SDK
// SDK Client
// Core types
export {
  AppleProvider,
  type AuthMethod,
  AuthProvider,
  addressFromDid,
  aggregateSignatures,
  type BackupCode,
  BackupCodesManager,
  type BackupCodesSet,
  ChainId,
  ConnectedAccount,
  type ConnectedAccountProps,
  type CouncilConfig,
  CouncilType,
  type CreateIdentityResult,
  type CredentialIssuanceParams,
  type CredentialIssuer,
  type CredentialPresentation,
  type CredentialProof,
  type CredentialSubject,
  CredentialType,
  type CredentialVerificationResult,
  type CrossChainIdentity,
  type CrossChainIntent,
  createBackupCodesManager,
  createCredentialHash,
  createDecentralizedDiscovery,
  createDID,
  createDIDFromAddress,
  createEmailProvider,
  createGasEstimator,
  createOAuth3Client,
  createOAuth3JNSService,
  createOAuth3StorageService,
  createOAuthProvider,
  createPasskeyManager,
  createPhoneProvider,
  createThresholdEncryption,
  createTOTPManager,
  createTreasuryPaymaster,
  createX402PaymentClient,
  credentialToOnChainAttestation,
  type DID,
  type DIDDocument,
  DIDManager,
  type DIDManagerConfig,
  DIDNetwork,
  DiscordProvider,
  didEquals,
  didFromAddress,
  type EmailAuthConfig,
  type EmailAuthResult,
  EmailProvider,
  type EmailUser,
  extractAddressFromDID,
  type FarcasterCast,
  type FarcasterFrameContext,
  type FarcasterIdentity,
  type FarcasterProfile,
  FarcasterProvider,
  type FarcasterSigner,
  type FarcasterSignerRequest,
  type FROSTCluster,
  FROSTCoordinator,
  type FROSTKeyShare,
  type FROSTSignature,
  type FROSTSignatureShare,
  type FROSTSigningCommitment,
  farcasterProvider,
  type GasEstimate,
  GasEstimator,
  type GasEstimatorConfig,
  GitHubProvider,
  GoogleProvider,
  generateKeyShares,
  generateRandomDID,
  generateSignatureShare,
  generateSigningCommitment,
  getNetwork,
  type IdentityIntent,
  IdentityIntentAction,
  type IdentityMetadata,
  type IntentSolution,
  IntentStatus,
  isLocalnet,
  isMainnet,
  isTestnet,
  type LinkedProvider,
  type LinkOptions,
  LoginButton,
  type LoginButtonProps,
  LoginModal,
  type LoginModalProps,
  type LoginOptions,
  type MagicLinkToken,
  type MFAChallenge,
  type MFAChallengeMetadata,
  MFAMethod,
  MFASetup,
  type MFASetupProps,
  type MFAStatus,
  type MPCCluster,
  type MPCNode,
  type MPCSignatureRequest,
  type MPCSignatureResult,
  MPCSignatureStatus,
  type OAuth3App,
  type OAuth3AppCredentials,
  type OAuth3AppMetadata,
  OAuth3Client,
  type OAuth3Config,
  type OAuth3ContextValue,
  OAuth3DecentralizedDiscovery,
  OAuth3Error,
  OAuth3ErrorCode,
  type OAuth3ErrorDetails,
  type OAuth3Event,
  type OAuth3EventHandler,
  type OAuth3EventType,
  type OAuth3Identity,
  type OAuth3InternalSession,
  OAuth3JNSService,
  OAuth3Provider,
  type OAuth3ProviderProps,
  type OAuth3Session,
  OAuth3StorageService,
  type OAuthConfig,
  type OAuthProfile,
  type OAuthState,
  type OAuthToken,
  type OTPToken,
  type ParsedDID,
  type PasskeyAuthenticationOptions,
  type PasskeyAuthResult,
  type PasskeyChallenge,
  type PasskeyCredential,
  PasskeyManager,
  type PasskeyRegistrationOptions,
  type PaymasterConfig,
  type PaymasterData,
  type PaymasterDecision,
  type PhoneAuthConfig,
  type PhoneAuthResult,
  type PhoneOTP,
  PhoneProvider,
  type PhoneUser,
  parseDID,
  publicKeyToAddress,
  SessionCapability,
  type SessionKeyInfo,
  type SessionPermission,
  type SignMessageOptions,
  type SmartAccountInfo,
  type SponsorshipPolicy,
  type SponsorshipResult,
  type TEEAttestation,
  type TEENodeInfo,
  TEEProvider,
  ThresholdEncryptionService,
  TOTPManager,
  type TOTPSecret,
  type TOTPSetupResult,
  type TOTPVerifyResult,
  type TransactionOptions,
  TreasuryPaymaster,
  TwitterProvider,
  type UseCredentialsReturn,
  type UseLoginOptions,
  type UseLoginReturn,
  type UseMFAOptions,
  type UseMFAReturn,
  type UserOperation,
  type UserSponsorshipState,
  type UseSessionReturn,
  useCredentials,
  useLogin,
  useMFA,
  useOAuth3,
  useOAuth3Client,
  useSession,
  type VerifiableCredential,
  VerifiableCredentialIssuer,
  VerifiableCredentialVerifier,
  type VerificationMethod,
  validateDID,
  verifySignature,
  X402PaymentClient,
} from '@jejunetwork/auth'
// Threshold Signing (from local module)
export { ThresholdSigner, type ThresholdSignerConfig } from './mpc'
// OAuth PKCE utilities (from local module)
export { generatePKCE, PKCEUtils } from './oauth/pkce'
export type { PKCEParams } from './oauth/types'
// Key Backup/Recovery (from local module)
export { type BackupOptions, KeyBackupManager } from './recovery'

// =============================================================================
// Babylon-specific Configuration
// =============================================================================

import type { OAuth3Config, SponsorshipPolicy } from '@jejunetwork/auth'
import type { Address, Hex } from 'viem'

/**
 * OAuth provider client IDs configuration
 */
export interface OAuthProvidersConfig {
  twitter?: string
  discord?: string
  google?: string
  github?: string
  apple?: string
}

/**
 * Farcaster provider configuration
 */
export interface FarcasterProviderConfig {
  neynarApiKey?: string
  hubUrl?: string
}

/**
 * Babylon auth configuration with sensible defaults
 */
export interface BabylonAuthConfig extends Partial<OAuth3Config> {
  /** Network: mainnet, testnet, or localnet (default: testnet) */
  network?: 'mainnet' | 'testnet' | 'localnet'
  /** Babylon-specific app ID override */
  appId?: string
  /** Babylon treasury address for gas sponsorship */
  treasuryAddress?: Address
  /** Operator key for paymaster (if gas sponsorship enabled) */
  operatorKey?: Hex
  /** Custom sponsorship policy */
  sponsorshipPolicy?: Partial<SponsorshipPolicy>
  /** MPC endpoints for threshold signing (optional) */
  mpcEndpoints?: string[]
  /** OAuth provider client IDs */
  oauth?: OAuthProvidersConfig
  /** Farcaster provider configuration */
  farcaster?: FarcasterProviderConfig
}

/**
 * Default Babylon auth configuration
 */
export const BABYLON_AUTH_DEFAULTS: BabylonAuthConfig = {
  network: 'testnet',
  appId: 'babylon.apps.jeju',
}

/**
 * Chain IDs for Babylon deployment
 */
export const BABYLON_CHAIN_IDS = {
  localnet: 420691,
  testnet: 420690,
  mainnet: 420692,
} as const

/**
 * Get chain ID for Babylon network
 */
export function getBabylonChainId(
  network: 'mainnet' | 'testnet' | 'localnet',
): number {
  return BABYLON_CHAIN_IDS[network]
}

/**
 * Merge Babylon defaults with user config
 */
export function createBabylonAuthConfig(
  config: BabylonAuthConfig = {},
): OAuth3Config {
  const network = config.network ?? 'testnet'
  const chainId = getBabylonChainId(network)

  return {
    appId: config.appId ?? BABYLON_AUTH_DEFAULTS.appId ?? 'babylon.apps.jeju',
    chainId,
    redirectUri: config.redirectUri ?? '',
    ...config,
  }
}

// =============================================================================
// Babylon OAuth3 Client Factory
// =============================================================================

import { createOAuth3Client as createBaseClient } from '@jejunetwork/auth'

// Singleton OAuth3 client instance
let oauth3ClientInstance: ReturnType<typeof createBaseClient> | null = null

/**
 * Get a singleton OAuth3 client configured for Babylon.
 * Uses lazy initialization - client is created on first call.
 *
 * @param config Optional config overrides
 * @returns Configured OAuth3Client instance
 */
export function getOAuth3Client(
  config: BabylonAuthConfig = {},
): ReturnType<typeof createBaseClient> {
  if (!oauth3ClientInstance) {
    const oauth3Config = createBabylonAuthConfig(config)
    oauth3ClientInstance = createBaseClient(oauth3Config)
  }
  return oauth3ClientInstance
}

/**
 * Reset the OAuth3 client singleton (for testing)
 */
export function resetOAuth3Client(): void {
  oauth3ClientInstance = null
}

// =============================================================================
// Babylon-specific React Hooks (Convenience Wrappers)
// =============================================================================

export {
  BabylonAuthProvider,
  JejuAuthProvider,
  type UseWalletReturn,
  useBabylonAuth,
  useBabylonWallet,
  useJejuAuth,
  useJejuWallet,
} from './react/babylon-provider'
