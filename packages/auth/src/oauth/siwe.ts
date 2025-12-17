/**
 * Sign-In with Ethereum (SIWE)
 *
 * EIP-4361 compliant authentication using Ethereum wallet signatures.
 * https://eips.ethereum.org/EIPS/eip-4361
 */

import { type Address, type Hex, verifyMessage } from 'viem';

export interface SIWEConfig {
  /** Domain making the request (e.g., "babylon.game") */
  domain: string;
  /** URI of the requesting service */
  uri?: string;
  /** Statement explaining what the user is signing for */
  statement?: string;
  /** Expiration time in seconds (default: 300 = 5 minutes) */
  expiresIn?: number;
  /** Chain ID (default: 1 for Ethereum mainnet) */
  chainId?: number;
}

export interface SIWEMessage {
  /** The formatted message to sign */
  message: string;
  /** Domain making the request */
  domain: string;
  /** Address of the signer */
  address: Address;
  /** Statement explaining the request */
  statement: string;
  /** URI of the requesting service */
  uri: string;
  /** EIP-155 Chain ID */
  chainId: number;
  /** Unique nonce */
  nonce: string;
  /** When the message was issued (ISO 8601) */
  issuedAt: string;
  /** When the message expires (ISO 8601) */
  expirationTime: string;
  /** Version of the SIWE message */
  version: string;
  /** Optional request ID */
  requestId?: string;
  /** Optional resources the user is requesting access to */
  resources?: string[];
}

export interface SIWEVerificationResult {
  /** Whether the signature is valid */
  valid: boolean;
  /** The address that signed (recovered from signature) */
  address: Address;
  /** The parsed message fields */
  message: SIWEMessage;
  /** Reason for failure (if not valid) */
  error?: string;
}

/**
 * Sign-In with Ethereum (SIWE) Handler
 *
 * Implements EIP-4361 for wallet-based authentication.
 */
export class SIWE {
  private config: Required<SIWEConfig>;

  constructor(config: SIWEConfig) {
    this.config = {
      domain: config.domain,
      uri: config.uri ?? `https://${config.domain}`,
      statement: config.statement ?? 'Sign in with Ethereum to the app.',
      expiresIn: config.expiresIn ?? 300,
      chainId: config.chainId ?? 1,
    };
  }

  /**
   * Generate a unique nonce for the SIWE message
   */
  generateNonce(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Create a SIWE message for signing
   * Follows EIP-4361 message format exactly
   */
  createMessage(
    address: Address,
    options?: {
      nonce?: string;
      statement?: string;
      chainId?: number;
      expiresIn?: number;
      resources?: string[];
      requestId?: string;
    }
  ): SIWEMessage {
    const now = new Date();
    const nonce = options?.nonce ?? this.generateNonce();
    const expiresIn = options?.expiresIn ?? this.config.expiresIn;
    const expirationTime = new Date(now.getTime() + expiresIn * 1000);
    const chainId = options?.chainId ?? this.config.chainId;

    const siweMessage: SIWEMessage = {
      domain: this.config.domain,
      address,
      statement: options?.statement ?? this.config.statement,
      uri: this.config.uri,
      version: '1',
      chainId,
      nonce,
      issuedAt: now.toISOString(),
      expirationTime: expirationTime.toISOString(),
      message: '', // Will be set below
      requestId: options?.requestId,
      resources: options?.resources,
    };

    // Build the EIP-4361 formatted message
    siweMessage.message = this.formatMessage(siweMessage);

    return siweMessage;
  }

  /**
   * Format the SIWE message according to EIP-4361
   */
  private formatMessage(msg: SIWEMessage): string {
    const lines: string[] = [
      `${msg.domain} wants you to sign in with your Ethereum account:`,
      msg.address,
      '',
      msg.statement,
      '',
      `URI: ${msg.uri}`,
      `Version: ${msg.version}`,
      `Chain ID: ${msg.chainId}`,
      `Nonce: ${msg.nonce}`,
      `Issued At: ${msg.issuedAt}`,
      `Expiration Time: ${msg.expirationTime}`,
    ];

    if (msg.requestId) {
      lines.push(`Request ID: ${msg.requestId}`);
    }

    if (msg.resources && msg.resources.length > 0) {
      lines.push('Resources:');
      for (const resource of msg.resources) {
        lines.push(`- ${resource}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Parse a SIWE message string back into structured form
   */
  parseMessage(message: string): SIWEMessage {
    const lines = message.split('\n');

    // Parse domain from first line
    const domainMatch = lines[0]?.match(
      /^(.+) wants you to sign in with your Ethereum account:$/
    );
    if (!domainMatch?.[1]) {
      throw new Error('Invalid SIWE message: missing domain');
    }
    const domain = domainMatch[1];

    // Address is on second line
    const address = lines[1] as Address;
    if (!address?.startsWith('0x')) {
      throw new Error('Invalid SIWE message: missing address');
    }

    // Statement is between blank lines
    const blankIndex1 = lines.indexOf('', 2);
    const blankIndex2 = lines.indexOf('', blankIndex1 + 1);
    const statement = lines.slice(blankIndex1 + 1, blankIndex2).join('\n');

    // Parse the key-value fields
    const fields: Record<string, string> = {};
    const resources: string[] = [];
    let inResources = false;

    for (let i = blankIndex2 + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      if (line === 'Resources:') {
        inResources = true;
        continue;
      }

      if (inResources && line.startsWith('- ')) {
        resources.push(line.slice(2));
        continue;
      }

      const colonIndex = line.indexOf(': ');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex);
        const value = line.slice(colonIndex + 2);
        fields[key] = value;
      }
    }

    return {
      message,
      domain,
      address,
      statement,
      uri: fields['URI'] ?? '',
      version: fields['Version'] ?? '1',
      chainId: parseInt(fields['Chain ID'] ?? '1', 10),
      nonce: fields['Nonce'] ?? '',
      issuedAt: fields['Issued At'] ?? '',
      expirationTime: fields['Expiration Time'] ?? '',
      requestId: fields['Request ID'],
      resources: resources.length > 0 ? resources : undefined,
    };
  }

  /**
   * Verify a SIWE signature
   */
  async verify(
    message: string,
    signature: Hex
  ): Promise<SIWEVerificationResult> {
    // Parse the message
    let parsed: SIWEMessage;
    try {
      parsed = this.parseMessage(message);
    } catch (err) {
      return {
        valid: false,
        address: '0x0' as Address,
        message: { message } as SIWEMessage,
        error: err instanceof Error ? err.message : 'Failed to parse message',
      };
    }

    // Check expiration
    const expirationTime = new Date(parsed.expirationTime).getTime();
    if (Date.now() > expirationTime) {
      return {
        valid: false,
        address: parsed.address,
        message: parsed,
        error: 'Message has expired',
      };
    }

    // Check that issued time is not in the future
    const issuedAt = new Date(parsed.issuedAt).getTime();
    if (issuedAt > Date.now() + 60000) {
      // Allow 1 minute clock drift
      return {
        valid: false,
        address: parsed.address,
        message: parsed,
        error: 'Message issued in the future',
      };
    }

    // Verify the domain matches
    if (parsed.domain !== this.config.domain) {
      return {
        valid: false,
        address: parsed.address,
        message: parsed,
        error: `Domain mismatch: expected ${this.config.domain}, got ${parsed.domain}`,
      };
    }

    // Verify signature using viem
    const isValid = await verifyMessage({
      address: parsed.address,
      message,
      signature,
    });

    if (!isValid) {
      return {
        valid: false,
        address: parsed.address,
        message: parsed,
        error: 'Invalid signature',
      };
    }

    return {
      valid: true,
      address: parsed.address,
      message: parsed,
    };
  }

  /**
   * Verify a signature against a known address
   * More strict: verifies signature AND that it matches expected address
   */
  async verifyForAddress(
    message: string,
    signature: Hex,
    expectedAddress: Address
  ): Promise<SIWEVerificationResult> {
    const result = await this.verify(message, signature);

    if (
      result.valid &&
      result.address.toLowerCase() !== expectedAddress.toLowerCase()
    ) {
      return {
        ...result,
        valid: false,
        error: `Address mismatch: expected ${expectedAddress}, got ${result.address}`,
      };
    }

    return result;
  }
}

/**
 * Create a simple SIWE message for quick authentication
 * Returns the message string ready for signing
 */
export function createSIWEMessage(
  domain: string,
  address: Address,
  options?: {
    statement?: string;
    chainId?: number;
    nonce?: string;
    expiresIn?: number;
  }
): string {
  const siwe = new SIWE({ domain, chainId: options?.chainId });
  const msg = siwe.createMessage(address, options);
  return msg.message;
}

/**
 * Verify a SIWE message signature
 */
export async function verifySIWE(
  domain: string,
  message: string,
  signature: Hex
): Promise<SIWEVerificationResult> {
  const siwe = new SIWE({ domain });
  return siwe.verify(message, signature);
}
