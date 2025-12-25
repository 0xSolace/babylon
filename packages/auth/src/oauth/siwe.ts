/**
 * SIWE (Sign-In with Ethereum) - EIP-4361
 *
 * Implementation of the Sign-In with Ethereum standard.
 */

import { type Hex, recoverMessageAddress } from 'viem'

export interface SIWEConfig {
  /** Domain for the SIWE message */
  domain?: string
  /** URI for the SIWE message */
  uri?: string
}

export interface SIWEMessage {
  domain: string
  address: string
  statement: string
  uri: string
  version: string
  chainId: number
  nonce: string
  issuedAt: string
  expirationTime?: string
  notBefore?: string
  requestId?: string
  resources?: string[]
}

export interface SIWEVerificationResult {
  valid: boolean
  address?: string
  error?: string
}

/**
 * Generate a random nonce
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Create a SIWE message
 */
export function createSIWEMessage(
  address: string,
  domain: string,
  options: {
    statement?: string
    uri?: string
    chainId?: number
    nonce?: string
    expiresInSeconds?: number
    notBefore?: Date
    requestId?: string
    resources?: string[]
  } = {},
): SIWEMessage {
  const now = new Date()
  const expiresAt = options.expiresInSeconds
    ? new Date(now.getTime() + options.expiresInSeconds * 1000)
    : undefined

  return {
    domain,
    address,
    statement: options.statement ?? 'Sign in with Ethereum',
    uri: options.uri ?? `https://${domain}`,
    version: '1',
    chainId: options.chainId ?? 1,
    nonce: options.nonce ?? generateNonce(),
    issuedAt: now.toISOString(),
    expirationTime: expiresAt?.toISOString(),
    notBefore: options.notBefore?.toISOString(),
    requestId: options.requestId,
    resources: options.resources,
  }
}

/**
 * Convert SIWE message to string for signing
 */
export function siweMessageToString(message: SIWEMessage): string {
  const lines = [
    `${message.domain} wants you to sign in with your Ethereum account:`,
    message.address,
    '',
    message.statement,
    '',
    `URI: ${message.uri}`,
    `Version: ${message.version}`,
    `Chain ID: ${message.chainId}`,
    `Nonce: ${message.nonce}`,
    `Issued At: ${message.issuedAt}`,
  ]

  if (message.expirationTime) {
    lines.push(`Expiration Time: ${message.expirationTime}`)
  }
  if (message.notBefore) {
    lines.push(`Not Before: ${message.notBefore}`)
  }
  if (message.requestId) {
    lines.push(`Request ID: ${message.requestId}`)
  }
  if (message.resources?.length) {
    lines.push('Resources:')
    for (const resource of message.resources) {
      lines.push(`- ${resource}`)
    }
  }

  return lines.join('\n')
}

/**
 * Verify a SIWE signature
 */
export async function verifySIWE(
  message: SIWEMessage,
  signature: Hex,
): Promise<SIWEVerificationResult> {
  const messageString = siweMessageToString(message)

  // Check expiration
  if (message.expirationTime) {
    const expiresAt = new Date(message.expirationTime)
    if (expiresAt < new Date()) {
      return { valid: false, error: 'Message has expired' }
    }
  }

  // Check not before
  if (message.notBefore) {
    const notBefore = new Date(message.notBefore)
    if (notBefore > new Date()) {
      return { valid: false, error: 'Message is not yet valid' }
    }
  }

  // Verify signature
  const recoveredAddress = await recoverMessageAddress({
    message: messageString,
    signature,
  })

  if (recoveredAddress.toLowerCase() !== message.address.toLowerCase()) {
    return { valid: false, error: 'Invalid signature' }
  }

  return { valid: true, address: recoveredAddress }
}

/**
 * SIWE class for object-oriented usage
 */
export class SIWE {
  private config: SIWEConfig

  constructor(config: SIWEConfig = {}) {
    this.config = config
  }

  createMessage(
    address: string,
    options: {
      statement?: string
      chainId?: number
      nonce?: string
      expiresInSeconds?: number
    } = {},
  ): SIWEMessage {
    return createSIWEMessage(address, this.config.domain ?? 'localhost', {
      ...options,
      uri: this.config.uri,
    })
  }

  async verify(
    message: SIWEMessage,
    signature: Hex,
  ): Promise<SIWEVerificationResult> {
    return verifySIWE(message, signature)
  }

  toString(message: SIWEMessage): string {
    return siweMessageToString(message)
  }
}
