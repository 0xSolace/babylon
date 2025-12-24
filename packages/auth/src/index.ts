/**
 * @babylon/auth
 *
 * Client-side authentication for Babylon using Jeju's decentralized auth.
 *
 * Features:
 * - Web2 login (email, Twitter, Discord, Farcaster)
 * - Web3 login (wallet connect)
 * - MPC threshold signatures (no single point of failure)
 * - DID-based identity
 * - Key backup and recovery
 * - Gas sponsorship via treasury
 *
 * @example
 * ```tsx
 * import { JejuAuthProvider, useJejuAuth } from '@babylon/auth';
 *
 * function App() {
 *   return (
 *     <JejuAuthProvider config={{ network: 'mainnet' }}>
 *       <MyApp />
 *     </JejuAuthProvider>
 *   );
 * }
 *
 * function MyApp() {
 *   const { authenticated, loginWithWallet, logout } = useJejuAuth();
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
// React Components and Hooks (Client-side)
// =============================================================================

export { LoginButton } from './client/login-button'
export { JejuAuthProvider, useJejuAuthContext } from './client/provider'
export type { JejuAuthConfig } from './client/types'
export { useJejuAuth } from './client/use-jeju-auth'
export { useJejuWallet } from './client/use-jeju-wallet'

// =============================================================================
// OAuth types from @jejunetwork/oauth3
// =============================================================================

export type {
  FarcasterCast,
  FarcasterFrameContext,
  FarcasterProfile,
  FarcasterSigner,
  OAuthConfig,
  OAuthProfile,
  OAuthState,
  OAuthToken,
} from '@jejunetwork/oauth3'

// =============================================================================
// DID utilities
// =============================================================================

export {
  createDID,
  createDIDFromAddress,
  DIDManager,
  type DIDManagerConfig,
  didEquals,
  extractAddressFromDid,
  generateRandomDID,
  getNetwork,
  isLocalnet,
  isMainnet,
  isTestnet,
  parseDID,
  validateDID,
} from './did/index'

// =============================================================================
// MPC network (browser-safe stubs for client)
// =============================================================================

export {
  DEFAULT_MPC_CONFIG,
  getMPCConfig,
  getMPCCoordinator,
  type KeyRotationParams,
  type KeyRotationResult,
  type KeyVersion,
  MPCCoordinator,
  type MPCCoordinatorConfig,
  type MPCKeyGenParams,
  type MPCKeyGenResult,
  type MPCParty,
  type MPCSignatureResult,
  type MPCSignRequest,
  type MPCSignSession,
  resetMPCCoordinator,
  type SignResult,
  ThresholdSigner,
  type ThresholdSignerConfig,
} from './mpc/index'

export type {
  KeyGenRequest,
  KeyGenResponse,
  SigningRequest,
  SigningResponse,
} from './mpc/types'

// =============================================================================
// OAuth providers
// =============================================================================

export type {
  OAuthCallbackResult,
  OAuthProvider,
  OAuthTokens,
  OAuthUserInfo,
} from './oauth/index'

export {
  // SIWE (Sign-In with Ethereum - EIP-4361)
  createSIWEMessage,
  // SIWF (Sign-In with Farcaster)
  createSIWFMessage,
  // OAuth2 providers
  DiscordOAuth,
  DiscordProvider,
  FarcasterAuth,
  type FarcasterAuthConfig,
  type FarcasterSignInRequest,
  type FarcasterSignInResult,
  farcasterProvider,
  // PKCE utilities
  generatePKCE,
  PKCEUtils,
  SIWE,
  type SIWEConfig,
  type SIWEMessage,
  type SIWEVerificationResult,
  SIWF,
  type SIWFConfig,
  type SIWFMessage,
  type SIWFVerificationResult,
  TwitterOAuth,
  TwitterProvider,
  verifySIWE,
  verifySIWF,
} from './oauth/index'

// =============================================================================
// OAuth3 (Jeju Decentralized Auth)
// =============================================================================

export {
  AuthProvider,
  type AuthResult,
  getOAuth3Client,
  type IdentityMetadata,
  initializeOAuth3,
  type LinkedProvider,
  OAuth3Client,
  type OAuth3Config,
  type OAuth3Identity,
  type OAuth3Session,
  resetOAuth3Client,
} from './oauth3/index'

// =============================================================================
// Paymaster (Gas sponsorship)
// =============================================================================

export { GasEstimator, TreasuryPaymaster } from './paymaster/index'
export type { SponsorshipPolicy } from './paymaster/types'

// =============================================================================
// Recovery
// =============================================================================

export {
  KeyBackupManager,
  RecoveryManager,
  SocialRecovery,
} from './recovery/index'

// =============================================================================
// Validation schemas
// =============================================================================

export type {
  DiscordUserResponseInput,
  KeyBackupInput,
  OAuthTokenResponseInput,
  PKCEParamsInput,
  SessionClaimsInput,
  SessionDataInput,
  SessionTokenDataInput,
  TwitterUserResponseInput,
} from './schemas/index'

export {
  AddressSchema,
  DIDSchema,
  DiscordUserResponseSchema,
  HexSchema,
  KeyBackupSchema,
  OAuthTokenResponseSchema,
  PKCEParamsSchema,
  SessionClaimsSchema,
  SessionDataSchema,
  SessionTokenDataSchema,
  TwitterUserResponseSchema,
} from './schemas/index'

// =============================================================================
// Core types
// =============================================================================

export * from './types/index'
