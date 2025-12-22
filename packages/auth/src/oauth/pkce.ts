/**
 * PKCE Utilities
 *
 * Proof Key for Code Exchange (RFC 7636) implementation.
 * Used for secure OAuth without a client secret.
 */

import { PKCEParamsSchema } from '../schemas/index';
import type { PKCEParams } from './types';

/**
 * Convert Uint8Array to base64url string
 */
function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = '';
  for (const byte of arr) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate a cryptographically secure random string
 */
function generateRandomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return uint8ArrayToBase64Url(bytes).slice(0, length);
}

/**
 * Generate code verifier (43-128 characters)
 */
export function generateCodeVerifier(): string {
  return generateRandomString(64);
}

/**
 * Convert Uint8Array to ArrayBuffer (guaranteed non-shared)
 */
function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(arr.length);
  new Uint8Array(buffer).set(arr);
  return buffer;
}

/**
 * Generate code challenge from verifier using S256 method
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', toArrayBuffer(data));
  const hashArray = new Uint8Array(hash);

  return uint8ArrayToBase64Url(hashArray);
}

/**
 * Generate state parameter
 */
export function generateState(): string {
  return generateRandomString(32);
}

/**
 * Generate nonce
 */
export function generateNonce(): string {
  return generateRandomString(16);
}

/**
 * Generate complete PKCE parameters
 */
export async function generatePKCE(): Promise<PKCEParams> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();
  const nonce = generateNonce();

  return {
    codeVerifier,
    codeChallenge,
    state,
    nonce,
  };
}

/**
 * PKCE Utilities class
 */
export class PKCEUtils {
  /**
   * Store PKCE params (client-side only)
   */
  static store(params: PKCEParams, key = 'jeju_pkce'): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(key, JSON.stringify(params));
    }
  }

  /**
   * Retrieve stored PKCE params
   */
  static retrieve(key = 'jeju_pkce'): PKCEParams | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    const stored = sessionStorage.getItem(key);
    if (!stored) {
      return null;
    }

    sessionStorage.removeItem(key);
    const parseResult = PKCEParamsSchema.safeParse(JSON.parse(stored));
    if (!parseResult.success) {
      return null;
    }
    return parseResult.data;
  }

  /**
   * Validate state parameter
   */
  static validateState(received: string, expected: string): boolean {
    return received === expected;
  }

  /**
   * Generate and store PKCE params
   */
  static async generateAndStore(key = 'jeju_pkce'): Promise<PKCEParams> {
    const params = await generatePKCE();
    this.store(params, key);
    return params;
  }
}
