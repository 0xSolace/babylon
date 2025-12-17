/**
 * Sign-In with Farcaster (SIWF)
 *
 * Re-exports from farcaster.ts with explicit SIWF naming.
 * Uses Farcaster custody address signatures for authentication.
 */

export {
  FarcasterAuth,
  FarcasterAuth as SIWF,
  type FarcasterAuthConfig,
  type FarcasterAuthConfig as SIWFConfig,
  type FarcasterSignInRequest,
  type FarcasterSignInRequest as SIWFMessage,
  type FarcasterSignInResult,
  type FarcasterSignInResult as SIWFVerificationResult,
} from './farcaster';

/**
 * Create a SIWF sign-in request
 */
export function createSIWFMessage(
  domain: string,
  expiresInSeconds = 300
): import('./farcaster').FarcasterSignInRequest {
  const { FarcasterAuth } = require('./farcaster') as {
    FarcasterAuth: typeof import('./farcaster').FarcasterAuth;
  };
  const siwf = new FarcasterAuth();
  return siwf.generateSignInRequest(domain, expiresInSeconds);
}

/**
 * Verify a SIWF signature
 */
export async function verifySIWF(
  request: import('./farcaster').FarcasterSignInRequest,
  signature: `0x${string}`,
  fid: number,
  neynarApiKey?: string
): Promise<import('./farcaster').FarcasterSignInResult> {
  const { FarcasterAuth } = require('./farcaster') as {
    FarcasterAuth: typeof import('./farcaster').FarcasterAuth;
  };
  const siwf = new FarcasterAuth({ neynarApiKey });
  return siwf.verifySignIn(request, signature, fid);
}
