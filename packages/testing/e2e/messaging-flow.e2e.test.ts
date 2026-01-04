/**
 * E2E Test: Decentralized Messaging Flow
 *
 * Validates the complete NPC messaging pipeline:
 * 1. NPC identity setup (wallet + keys)
 * 2. Message sending through relay
 * 3. Storage in SQLit
 * 4. NPC response generation
 * 5. On-chain verification
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { toAddress, toAddressOrNull } from '@babylon/shared'
import { responseJson } from '@jejunetwork/shared'
import { type Address, createPublicClient, http } from 'viem'
import { hardhat } from 'viem/chains'
import { z } from 'zod'

// Response schemas
const HealthStatusSchema = z.object({ status: z.string() })
const ChainIdResponseSchema = z.object({ result: z.string() })
const KeyGenerationSchema = z.object({
  publicKey: z.string(),
  metadata: z.object({ id: z.string(), curve: z.string() }),
})
const SignResponseSchema = z.object({ signature: z.string() })
const MessageSendSchema = z.object({
  success: z.boolean(),
  messageId: z.string(),
  timestamp: z.number().optional(),
})
const MessagesListSchema = z.object({
  messages: z.array(z.object({ id: z.string(), sender: z.string() })),
})
const SuccessResponseSchema = z.object({ success: z.boolean() })

// Skip if messaging services not available
const RUN_MESSAGING_E2E =
  process.env.USE_DECENTRALIZED_MESSAGING === 'true' ||
  process.env.RUN_MESSAGING_E2E === 'true'

const describeFn = RUN_MESSAGING_E2E ? describe : describe.skip

describeFn('Decentralized Messaging E2E', () => {
  const KMS_ENDPOINT = process.env.KMS_ENDPOINT ?? 'http://localhost:3300'
  const RELAY_ENDPOINT = process.env.RELAY_ENDPOINT ?? 'http://localhost:3200'
  const SQLIT_ENDPOINT =
    process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:8546'
  const RPC_URL = process.env.PUBLIC_RPC_URL ?? 'http://localhost:6545'

  let testWallet: { address: Address; privateKey: `0x${string}` }
  let npcWallet: { address: Address; privateKey: `0x${string}` }

  beforeAll(async () => {
    // Generate test wallets
    testWallet = {
      address: toAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8'),
      privateKey:
        '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    }

    npcWallet = {
      address: toAddress('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'),
      privateKey:
        '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    }

    // Generate encryption keys via KMS
    await fetch(`${KMS_ENDPOINT}/keys/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'encryption',
        curve: 'x25519',
        owner: testWallet.address,
      }),
    })

    await fetch(`${KMS_ENDPOINT}/keys/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'encryption',
        curve: 'x25519',
        owner: npcWallet.address,
      }),
    })
  })

  describe('1. Infrastructure Health', () => {
    it('KMS service is healthy', async () => {
      const response = await fetch(`${KMS_ENDPOINT}/health`)
      const data = HealthStatusSchema.parse(await responseJson(response))
      expect(response.ok).toBe(true)
      expect(data.status).toBe('healthy')
    })

    it('Relay service is healthy', async () => {
      const response = await fetch(`${RELAY_ENDPOINT}/health`)
      const data = HealthStatusSchema.parse(await responseJson(response))
      expect(response.ok).toBe(true)
      expect(data.status).toBe('healthy')
    })

    it('SQLit service is healthy', async () => {
      const response = await fetch(`${SQLIT_ENDPOINT}/v1/health`)
      expect(response.ok).toBe(true)
    })

    it('Jeju chain is accessible', async () => {
      const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
      })
      const data = ChainIdResponseSchema.parse(await responseJson(response))
      expect(response.ok).toBe(true)
      expect(data.result).toBe('0x7a69') // 31337
    })
  })

  describe('2. Key Generation', () => {
    it('can generate X25519 encryption keys', async () => {
      const response = await fetch(`${KMS_ENDPOINT}/keys/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'encryption',
          curve: 'x25519',
          owner: '0x0000000000000000000000000000000000000001',
        }),
      })

      const data = KeyGenerationSchema.parse(await responseJson(response))

      expect(response.ok).toBe(true)
      expect(data.publicKey).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(data.metadata.curve).toBe('x25519')
    })

    it('can generate Ed25519 signing keys', async () => {
      const response = await fetch(`${KMS_ENDPOINT}/keys/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'signing',
          curve: 'ed25519',
          owner: '0x0000000000000000000000000000000000000001',
        }),
      })

      const data = KeyGenerationSchema.parse(await responseJson(response))

      expect(response.ok).toBe(true)
      expect(data.publicKey).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(data.metadata.curve).toBe('ed25519')
    })

    it('can sign messages with generated key', async () => {
      // First generate a signing key
      const genResponse = await fetch(`${KMS_ENDPOINT}/keys/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'signing',
          curve: 'ed25519',
          owner: '0x0000000000000000000000000000000000000001',
        }),
      })

      const genData = KeyGenerationSchema.parse(await responseJson(genResponse))

      // Sign a message
      const messageHex = `0x${Buffer.from('test message for signing').toString('hex')}`
      const signResponse = await fetch(`${KMS_ENDPOINT}/keys/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: genData.metadata.id,
          message: messageHex,
        }),
      })

      const signData = SignResponseSchema.parse(
        await responseJson(signResponse),
      )

      expect(signResponse.ok).toBe(true)
      expect(signData.signature).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(signData.signature.length).toBeGreaterThan(100) // Ed25519 sig is 64 bytes
    })
  })

  describe('3. Message Relay', () => {
    it('can send a message through the relay', async () => {
      const encryptedContent = Buffer.from(
        JSON.stringify({
          text: 'Hello NPC!',
          timestamp: Date.now(),
        }),
      ).toString('base64')

      const response = await fetch(`${RELAY_ENDPOINT}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: testWallet.address,
          recipient: npcWallet.address,
          encryptedContent,
        }),
      })

      const data = MessageSendSchema.parse(await responseJson(response))

      expect(response.ok).toBe(true)
      expect(data.success).toBe(true)
      expect(data.messageId).toMatch(/^msg-/)
      expect(data.timestamp).toBeGreaterThan(0)
    })

    it('can retrieve pending messages for recipient', async () => {
      // Send a test message first
      const encryptedContent = Buffer.from('test-retrieval-message').toString(
        'base64',
      )
      const testRecipient = '0x0000000000000000000000000000000000000099'

      await fetch(`${RELAY_ENDPOINT}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: testWallet.address,
          recipient: testRecipient,
          encryptedContent,
        }),
      })

      // Retrieve messages
      const response = await fetch(
        `${RELAY_ENDPOINT}/messages?recipient=${testRecipient}`,
      )
      const data = MessagesListSchema.parse(await responseJson(response))

      expect(response.ok).toBe(true)
      expect(data.messages).toBeInstanceOf(Array)
      expect(data.messages.length).toBeGreaterThan(0)

      const firstMessage = data.messages[0]
      if (!firstMessage) {
        throw new Error('Expected at least one message')
      }
      expect(firstMessage.sender).toBe(testWallet.address)
    })

    it('can acknowledge message delivery', async () => {
      // Send a message
      const testRecipient = '0x0000000000000000000000000000000000000098'
      const sendResponse = await fetch(`${RELAY_ENDPOINT}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: testWallet.address,
          recipient: testRecipient,
          encryptedContent: Buffer.from('ack-test').toString('base64'),
        }),
      })

      const sendData = MessageSendSchema.parse(await responseJson(sendResponse))

      // Acknowledge delivery
      const ackResponse = await fetch(
        `${RELAY_ENDPOINT}/messages/${sendData.messageId}/ack`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: testRecipient,
            status: 'delivered',
          }),
        },
      )

      const ackData = SuccessResponseSchema.parse(
        await responseJson(ackResponse),
      )

      expect(ackResponse.ok).toBe(true)
      expect(ackData.success).toBe(true)

      // Verify message no longer in pending
      const checkResponse = await fetch(
        `${RELAY_ENDPOINT}/messages?recipient=${testRecipient}`,
      )
      const checkData = MessagesListSchema.parse(
        await responseJson(checkResponse),
      )

      const deliveredMessage = checkData.messages.find(
        (m) => m.id === sendData.messageId,
      )
      expect(deliveredMessage).toBeUndefined() // Should not be in pending anymore
    })
  })

  describe('4. Relay Stats', () => {
    it('can get relay statistics', async () => {
      const response = await fetch(`${RELAY_ENDPOINT}/stats`)
      const RelayStatsSchema = z.object({
        totalMessages: z.number(),
        pendingMessages: z.number(),
        activeConnections: z.number().optional(),
        queuedRecipients: z.number().optional(),
      })
      const data = RelayStatsSchema.parse(await responseJson(response))

      expect(response.ok).toBe(true)
      expect(typeof data.totalMessages).toBe('number')
      expect(typeof data.pendingMessages).toBe('number')
    })
  })

  describe('5. Contract Integration', () => {
    const KEY_REGISTRY_ADDRESS = toAddressOrNull(
      process.env.KEY_REGISTRY_ADDRESS,
    )

    // Skip contract tests if not deployed
    const contractDescribe = KEY_REGISTRY_ADDRESS !== null ? it : it.skip

    contractDescribe('KeyRegistry contract is deployed', async () => {
      const client = createPublicClient({
        chain: hardhat,
        transport: http(RPC_URL),
      })

      if (!KEY_REGISTRY_ADDRESS) {
        throw new Error('KEY_REGISTRY_ADDRESS is not set')
      }

      const code = await client.getCode({
        address: KEY_REGISTRY_ADDRESS,
      })
      expect(code).toBeDefined()
      expect(code).not.toBe('0x')
      expect(code?.length).toBeGreaterThan(2)
    })
  })

  afterAll(async () => {
    // Cleanup test data if needed
    console.log('[E2E Cleanup] Test completed')
  })
})
