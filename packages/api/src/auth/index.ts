/**
 * Server-Side Auth Module (Permissionless)
 *
 * Wallet-signed session tokens. No shared secrets needed.
 */

// Session management
export {
  createSessionMessage,
  type SessionClaims,
  SessionManager,
  type SessionToken,
} from './session-manager'

// Token verification
export {
  extractTokenFromCookie,
  extractTokenFromHeader,
  toAuthClaims,
  type VerifyOptions,
  type VerifyResult,
  verifyFromRequest,
  verifyToken,
} from './verify-token'

// Wallet auth middleware
export {
  createWalletAuthMiddleware,
  isWalletAuthenticated,
  optionalWalletAuth,
  requireWalletAuth,
  type WalletAuthClaims,
  type WalletAuthenticatedRequest,
  type WalletAuthMiddlewareConfig,
  type WalletDID,
} from './wallet-auth-middleware'
