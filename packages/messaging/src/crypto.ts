/**
 * Cryptographic utilities for end-to-end encrypted messaging
 * Uses X25519 for key exchange and AES-256-GCM for encryption
 */

import { gcm } from '@noble/ciphers/aes';
import { x25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';
import { EncryptedMessageSchema } from './schemas';
import type { EncryptionKeys } from './types';

const NONCE_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * Generate a new X25519 key pair
 */
export function generateKeyPair(): EncryptionKeys {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

/**
 * Derive key pair from wallet signature (deterministic)
 */
export function deriveKeyPair(signature: string): EncryptionKeys {
  const signatureBytes = hexToBytes(
    signature.startsWith('0x') ? signature.slice(2) : signature
  );
  const privateKey = sha256(signatureBytes).slice(0, KEY_LENGTH);
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

/**
 * Compute shared secret using X25519
 */
export function computeSharedSecret(
  privateKey: Uint8Array,
  publicKey: Uint8Array
): Uint8Array {
  const rawSecret = x25519.getSharedSecret(privateKey, publicKey);
  return sha256(rawSecret);
}

/**
 * Encrypt message with AES-256-GCM
 */
export function encryptMessage(
  plaintext: string,
  recipientPublicKey: Uint8Array,
  _senderKeys: EncryptionKeys
): {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  ephemeralPublicKey: Uint8Array;
} {
  // Generate ephemeral key pair for forward secrecy
  const ephemeral = generateKeyPair();

  // Compute shared secret
  const sharedSecret = computeSharedSecret(
    ephemeral.privateKey,
    recipientPublicKey
  );

  // Generate random nonce
  const nonce = randomBytes(NONCE_LENGTH);

  // Encrypt with AES-256-GCM
  const cipher = gcm(sharedSecret, nonce);
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const ciphertext = cipher.encrypt(plaintextBytes);

  return {
    ciphertext,
    nonce,
    ephemeralPublicKey: ephemeral.publicKey,
  };
}

/**
 * Decrypt message with AES-256-GCM
 */
export function decryptMessage(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  ephemeralPublicKey: Uint8Array,
  recipientKeys: EncryptionKeys
): string {
  // Compute shared secret using ephemeral public key
  const sharedSecret = computeSharedSecret(
    recipientKeys.privateKey,
    ephemeralPublicKey
  );

  // Decrypt with AES-256-GCM
  const cipher = gcm(sharedSecret, nonce);
  const plaintextBytes = cipher.decrypt(ciphertext);

  return new TextDecoder().decode(plaintextBytes);
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert public key to bytes32 for contract storage
 */
export function publicKeyToBytes32(publicKey: Uint8Array): `0x${string}` {
  return `0x${bytesToHex(publicKey)}` as `0x${string}`;
}

/**
 * Convert bytes32 to public key
 */
export function bytes32ToPublicKey(bytes32: `0x${string}`): Uint8Array {
  return hexToBytes(bytes32.slice(2));
}

/**
 * Serialize encrypted message for transport
 */
export function serializeEncryptedMessage(data: {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  ephemeralPublicKey: Uint8Array;
}): string {
  return JSON.stringify({
    ciphertext: bytesToHex(data.ciphertext),
    nonce: bytesToHex(data.nonce),
    ephemeralPublicKey: bytesToHex(data.ephemeralPublicKey),
  });
}

/**
 * Deserialize encrypted message from transport
 */
export function deserializeEncryptedMessage(serialized: string): {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  ephemeralPublicKey: Uint8Array;
} {
  const parsed = EncryptedMessageSchema.parse(JSON.parse(serialized));
  return {
    ciphertext: hexToBytes(parsed.ciphertext),
    nonce: hexToBytes(parsed.nonce),
    ephemeralPublicKey: hexToBytes(parsed.ephemeralPublicKey),
  };
}

/**
 * Decrypt a serialized encrypted message directly to string
 */
export function decryptMessageToString(
  encryptedContent: string,
  recipientKeys: EncryptionKeys
): string {
  const { ciphertext, nonce, ephemeralPublicKey } =
    deserializeEncryptedMessage(encryptedContent);
  return decryptMessage(ciphertext, nonce, ephemeralPublicKey, recipientKeys);
}

/**
 * Convert public key Uint8Array to hex string
 */
export function publicKeyToHex(publicKey: Uint8Array): string {
  return bytesToHex(publicKey);
}
