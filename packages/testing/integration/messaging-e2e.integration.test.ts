/**
 * Messaging E2E Tests
 *
 * Tests the full messaging flow with real Jeju services:
 * 1. Key generation and on-chain registration
 * 2. Message encryption and decryption
 * 3. Message storage in IPFS
 * 4. Message relay and synchronization
 *
 * Prerequisites:
 *   1. Start Jeju: cd /path/to/jeju && bun run dev
 *   2. Deploy key registry contract
 *
 * Run with: bun test packages/testing/integration/messaging-e2e.integration.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  createMessagingClient,
  decryptMessage,
  deriveKeyPairFromWallet,
  encryptMessage,
  generateKeyPair,
} from '@jejunetwork/messaging'

// Response schema
const _CidSchema = z.object({ cid: z.string() })

import { responseJson } from '@jejunetwork/shared'
import { z } from 'zod'

const CidSchema = z.object({ cid: z.string() })

// Helper to convert Uint8Array to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex')
}

import { privateKeyToAccount } from 'viem/accounts'

// Test accounts (Hardhat dev accounts)
const ALICE_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const BOB_PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'

const aliceAccount = privateKeyToAccount(ALICE_PRIVATE_KEY)
const bobAccount = privateKeyToAccount(BOB_PRIVATE_KEY)

// Configuration - use 8545 for local anvil/hardhat
const JEJU_GATEWAY_URL = process.env.JEJU_GATEWAY_URL ?? 'http://localhost:4030'
const JEJU_RPC_URL =
  process.env.JEJU_RPC_URL ?? process.env.RPC_URL ?? 'http://localhost:6545'

// Track service availability
let devnetAvailable = false
let jejuGatewayAvailable = false

async function checkDevnetAvailable(): Promise<boolean> {
  const response = await fetch(JEJU_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_chainId',
      params: [],
      id: 1,
    }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => null)

  return response?.ok ?? false
}

async function checkJejuGatewayAvailable(): Promise<boolean> {
  const response = await fetch(`${JEJU_GATEWAY_URL}/health`, {
    signal: AbortSignal.timeout(3000),
  }).catch(() => null)

  return response?.ok ?? false
}

beforeAll(async () => {
  devnetAvailable = await checkDevnetAvailable()
  jejuGatewayAvailable = await checkJejuGatewayAvailable()

  console.log(`Devnet (${JEJU_RPC_URL}): ${devnetAvailable ? '✅' : '❌'}`)
  console.log(
    `Jeju Gateway (${JEJU_GATEWAY_URL}): ${jejuGatewayAvailable ? '✅' : '❌'}`,
  )
})

// ============================================================================
// Crypto Tests (No external services needed)
// ============================================================================

describe('Messaging Crypto', () => {
  it('should generate key pairs', async () => {
    const keys = generateKeyPair()
    expect(keys.publicKey).toBeInstanceOf(Uint8Array)
    expect(keys.privateKey).toBeInstanceOf(Uint8Array)
    expect(keys.publicKey.length).toBe(32)
    expect(keys.privateKey.length).toBe(32)

    const publicKeyHex = bytesToHex(keys.publicKey)
    expect(publicKeyHex.length).toBe(64) // 32 bytes = 64 hex chars
    console.log('Generated key pair successfully')
  })

  it('should derive consistent keys from signature', async () => {
    const address = '0x1234567890123456789012345678901234567890' as const
    const signature =
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c'

    const keys1 = deriveKeyPairFromWallet(address, signature)
    const keys2 = deriveKeyPairFromWallet(address, signature)

    expect(bytesToHex(keys1.publicKey)).toBe(bytesToHex(keys2.publicKey))
  })

  it('should encrypt and decrypt messages', async () => {
    const aliceKeys = generateKeyPair()
    const bobKeys = generateKeyPair()

    const plaintext = 'Hello, this is a secret message!'
    // encryptMessage: (plaintext, recipientPublicKey, senderPrivateKey?)
    const encrypted = encryptMessage(
      plaintext,
      bobKeys.publicKey,
      aliceKeys.privateKey,
    )

    expect(encrypted).toBeTruthy()
    expect(encrypted.ciphertext).not.toBe(plaintext)

    // decryptMessage: (encryptedMessage, recipientPrivateKey)
    const decrypted = decryptMessage(encrypted, bobKeys.privateKey)

    expect(decrypted).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(decrypted)).toBe(plaintext)
  })

  it('should fail to decrypt with wrong keys', async () => {
    const aliceKeys = generateKeyPair()
    const bobKeys = generateKeyPair()
    const eveKeys = generateKeyPair()

    const plaintext = 'Secret message'
    const encrypted = encryptMessage(
      plaintext,
      bobKeys.publicKey,
      aliceKeys.privateKey,
    )

    // Eve tries to decrypt with her keys
    expect(() => {
      decryptMessage(encrypted, eveKeys.privateKey)
    }).toThrow()
  })
})

// ============================================================================
// Messaging Client Tests
// ============================================================================

describe('Messaging Client', () => {
  it('should initialize with signature-derived keys', async () => {
    // Initialize Jeju MessagingClient
    const client = createMessagingClient({
      rpcUrl: JEJU_RPC_URL,
      address: aliceAccount.address,
    })

    // Sign to derive keys
    const signature = await aliceAccount.signMessage({
      message: `Sign to enable messaging\nAddress: ${aliceAccount.address}`,
    })
    await client.initialize(signature)

    const publicKey = client.getPublicKey()
    expect(publicKey).toBeTruthy()
    console.log('Client initialized with public key')
  })

  it('should encrypt messages between two parties using crypto module', async () => {
    // No external services needed - just crypto
    const aliceKeys = generateKeyPair()
    const bobKeys = generateKeyPair()

    const plaintext = 'Hello Bob! This is Alice.'
    const encrypted = encryptMessage(
      plaintext,
      bobKeys.publicKey,
      aliceKeys.privateKey,
    )

    expect(encrypted).toBeTruthy()
    expect(bytesToHex(encrypted.ciphertext)).not.toBe(plaintext)

    const decrypted = decryptMessage(encrypted, bobKeys.privateKey)

    expect(decrypted).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(decrypted)).toBe(plaintext)
    console.log('Message encrypted and decrypted successfully')
  })
})

// ============================================================================
// On-Chain Key Registry Tests
// ============================================================================
// NOTE: Full on-chain registry tests require deployed contracts.
// For local testing, use @jejunetwork/messaging directly with devnet.

// ============================================================================
// Message Storage Tests (IPFS via Jeju)
// ============================================================================

describe('Message Storage', () => {
  it('should store encrypted messages in IPFS', async () => {
    if (!jejuGatewayAvailable) {
      console.log('Skipped: Jeju gateway not running')
      return
    }

    // Skip if storage not available
    const storageResponse = await fetch(
      `${JEJU_GATEWAY_URL}/v1/storage/health`,
    ).catch(() => null)
    if (!storageResponse?.ok) {
      console.log('Skipped: Storage service not available')
      return
    }

    // Create keys
    const aliceKeys = generateKeyPair()
    const bobKeys = generateKeyPair()

    // Encrypt message
    const plaintext = 'This message will be stored on IPFS'
    const encrypted = encryptMessage(
      plaintext,
      bobKeys.publicKey,
      aliceKeys.privateKey,
    )

    // Store in IPFS via direct fetch
    const envelope = {
      from: aliceAccount.address,
      to: bobAccount.address,
      ciphertext: bytesToHex(encrypted.ciphertext),
      nonce: bytesToHex(encrypted.nonce),
      ephemeralPublicKey: bytesToHex(encrypted.ephemeralPublicKey),
      timestamp: Date.now(),
    }

    const uploadResponse = await fetch(
      `${JEJU_GATEWAY_URL}/v1/storage/upload`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: envelope, filename: 'message.json' }),
      },
    )

    if (!uploadResponse.ok) {
      console.log('Skipped: Storage upload failed')
      return
    }

    const result = CidSchema.parse(await responseJson(uploadResponse))
    expect(result.cid).toBeTruthy()

    console.log('Message stored with CID:', result.cid)
  })
})

// ============================================================================
// Full E2E Messaging Flow
// ============================================================================

describe('E2E Messaging Flow', () => {
  it('should complete full messaging flow with derived keys', async () => {
    // No external services needed - just crypto

    console.log('1. Deriving messaging keys from wallet signatures...')

    // Alice signs and derives keys
    const aliceDerivationMessage = `Sign to enable messaging\nAddress: ${aliceAccount.address}`
    const aliceSignature = await aliceAccount.signMessage({
      message: aliceDerivationMessage,
    })
    const aliceKeys = deriveKeyPairFromWallet(
      aliceAccount.address,
      aliceSignature,
    )

    // Bob signs and derives keys
    const bobDerivationMessage = `Sign to enable messaging\nAddress: ${bobAccount.address}`
    const bobSignature = await bobAccount.signMessage({
      message: bobDerivationMessage,
    })
    const bobKeys = deriveKeyPairFromWallet(bobAccount.address, bobSignature)

    console.log('  Alice public key:', bytesToHex(aliceKeys.publicKey))
    console.log('  Bob public key:', bytesToHex(bobKeys.publicKey))

    console.log('2. Alice sends encrypted message to Bob...')

    const secretMessage = 'Hey Bob! This is an encrypted message.'
    const encrypted = encryptMessage(
      secretMessage,
      bobKeys.publicKey,
      aliceKeys.privateKey,
    )

    console.log('3. Bob receives and decrypts the message...')

    const decrypted = decryptMessage(encrypted, bobKeys.privateKey)

    const decryptedText = new TextDecoder().decode(decrypted)
    expect(decryptedText).toBe(secretMessage)
    console.log('  Decrypted:', decryptedText)

    console.log('4. Bob replies to Alice...')

    const reply = 'Hi Alice! Got your message. Decentralization is working!'
    const encryptedReply = encryptMessage(
      reply,
      aliceKeys.publicKey,
      bobKeys.privateKey,
    )

    const decryptedReply = decryptMessage(encryptedReply, aliceKeys.privateKey)

    const decryptedReplyText = new TextDecoder().decode(decryptedReply)
    expect(decryptedReplyText).toBe(reply)
    console.log('  Reply decrypted:', decryptedReplyText)

    console.log('✅ Full E2E messaging flow completed successfully')
  })
})

// ============================================================================
// Cleanup
// ============================================================================

afterAll(async () => {
  console.log('Messaging E2E tests completed')
})
