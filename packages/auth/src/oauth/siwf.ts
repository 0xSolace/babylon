/**
 * Sign-In with Farcaster (SIWF)
 *
 * Uses @jejunetwork/oauth3's FarcasterProvider for authentication.
 * Uses Farcaster custody address signatures for authentication.
 */

import { type FarcasterProfile, FarcasterProvider } from '@jejunetwork/oauth3'

export interface SIWFConfig {
  neynarApiKey?: string
  hubUrl?: string
}

export interface SIWFMessage {
  message: string
  nonce: string
  domain: string
  expiresAt: number
}

/**
 * Create a SIWF sign-in request
 */
export function createSIWFMessage(
  domain: string,
  expiresInSeconds = 300,
): SIWFMessage {
  const randomBytes = crypto.getRandomValues(new Uint8Array(16))
  const nonce = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const expiresAt = Date.now() + expiresInSeconds * 1000

  const expirationDate = new Date(expiresAt).toISOString()

  const message = `${domain} wants you to sign in with your Farcaster account.

Nonce: ${nonce}
Expires: ${expirationDate}

This request will not trigger a blockchain transaction or cost any gas fees.`

  return {
    message,
    nonce,
    domain,
    expiresAt,
  }
}

/**
 * Verify a SIWF signature
 */
export async function verifySIWF(
  request: SIWFMessage,
  signature: `0x${string}`,
  fid: number,
  neynarApiKey?: string,
): Promise<FarcasterProfile> {
  // Check expiration
  if (Date.now() > request.expiresAt) {
    throw new Error('Sign-in request expired')
  }

  const config = {
    apiKey: neynarApiKey,
  }

  const siwf = new FarcasterProvider(config)
  const profile = await siwf.getProfileByFid(fid)

  // Verify the signature matches the custody address
  const verifyResult = await siwf.verifySignInMessage(
    request.message,
    signature,
    fid,
  )

  if (!verifyResult.valid) {
    throw new Error('Invalid Farcaster signature')
  }

  return profile
}
