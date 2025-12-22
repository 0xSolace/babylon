/**
 * @babylon/auth
 *
 * Decentralized authentication for Babylon using TEE and MPC.
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
 * import { JejuAuthProvider, useJejuAuth } from '@babylon/auth/client';
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

// DID management
export {
  createDID,
  DIDManager,
  DIDResolver,
  parseDID,
  validateDID,
} from './did/index';
// MPC network
export { createMPCClient, MPCClient, ThresholdSigner } from './mpc/index';
export type {
  KeyGenRequest,
  KeyGenResponse,
  MPCClientConfig,
  SigningRequest,
  SigningResponse,
} from './mpc/types';
export type {
  // SIWF types
  FarcasterAuthConfig,
  FarcasterSignInRequest,
  FarcasterSignInResult,
  // OAuth types
  OAuthCallbackResult,
  OAuthProvider,
  OAuthTokens,
  OAuthUserInfo,
  // SIWE types
  SIWEConfig,
  SIWEMessage,
  SIWEVerificationResult,
  SIWFConfig,
  SIWFMessage,
  SIWFVerificationResult,
} from './oauth/index';
// OAuth providers (including SIWE/SIWF)
export {
  // SIWE (Sign-In with Ethereum - EIP-4361)
  createSIWEMessage,
  // SIWF (Sign-In with Farcaster)
  createSIWFMessage,
  // OAuth2 providers
  DiscordOAuth,
  FarcasterAuth,
  // PKCE utilities
  generatePKCE,
  PKCEUtils,
  SIWE,
  SIWF,
  TwitterOAuth,
  verifySIWE,
  verifySIWF,
} from './oauth/index';
// OAuth3 (Jeju Decentralized Auth)
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
} from './oauth3/index';
// Paymaster
export { GasEstimator, TreasuryPaymaster } from './paymaster/index';
export type { SponsorshipPolicy } from './paymaster/types';
// Recovery
export {
  KeyBackupManager,
  RecoveryManager,
  SocialRecovery,
} from './recovery/index';
export type {
  DiscordUserResponseInput,
  KeyBackupInput,
  OAuthTokenResponseInput,
  PKCEParamsInput,
  SessionClaimsInput,
  SessionDataInput,
  SessionTokenDataInput,
  TwitterUserResponseInput,
} from './schemas/index';
// Validation schemas
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
} from './schemas/index';
// Core types
export * from './types/index';
