/**
 * Server-Side Auth Module (Permissionless)
 *
 * Wallet-signed session tokens. No shared secrets needed.
 */

export {
  type AuthMiddlewareConfig,
  createAuthMiddleware,
} from './middleware';

// Permissionless sessions (wallet-signed, no shared secret)
export {
  createSessionMessage,
  type SessionClaims,
  SessionManager,
  type SessionToken,
} from './session-manager';

export {
  toAuthClaims,
  type VerifyOptions,
  type VerifyResult,
  verifyToken,
} from './verify-token';
