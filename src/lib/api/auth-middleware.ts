/**
 * API Authentication Middleware
 *
 * Re-exports from @babylon/api for backwards compatibility.
 * All authentication is handled via OAuth3 (Jeju's decentralized auth).
 */

export {
  type AuthenticatedUser,
  AuthenticationError,
  authErrorResponse,
  authenticate,
  authenticateUser,
  authenticateWithDbUser,
  extractErrorMessage,
  getAuthClient,
  isAuthenticationError,
  optionalAuth,
  optionalAuthFromHeaders,
} from '@babylon/api';
