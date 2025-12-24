/**
 * Decentralized Messaging Client - E2EE via X25519 + AES-256-GCM with on-chain key registry.
 */

import { CHAIN, logger, RPC_URL } from '@babylon/shared'
import {
  bytes32ToPublicKey,
  decryptMessageToString,
  deriveKeyPairFromWallet,
  type EncryptedMessage,
  encryptMessage,
  generateKeyPair,
  KEY_REGISTRY_ABI,
  type KeyPair,
  publicKeyToBytes32,
  publicKeyToHex,
} from '@jejunetwork/messaging'
import {
  type Address,
  createPublicClient,
  type Hex,
  http,
  type WalletClient,
} from 'viem'
import { z } from 'zod'
import type {
  DecryptedMessage,
  MessageEnvelope,
  MessageEvent,
  MessagingConfig,
} from './types'

import { ErrorCodes, MessagingError } from './types'

// Validation schemas for relay API responses
const RelayMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  ciphertext: z.string(),
  nonce: z.string(),
  ephemeralPublicKey: z.string(),
  timestamp: z.number(),
})

const RelayMessagesResponseSchema = z.object({
  messages: z.array(RelayMessageSchema),
})

const WebSocketMessageSchema = z.object({
  type: z.string(),
  message: z
    .object({
      id: z.string(),
      from: z.string(),
      to: z.string(),
      ciphertext: z.string(),
      nonce: z.string(),
      ephemeralPublicKey: z.string(),
      timestamp: z.number(),
    })
    .optional(),
})

/** Convert hex string to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/** Convert Uint8Array to hex string */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export class MessagingClient {
  private config: MessagingConfig
  private publicClient
  private keyPair?: KeyPair
  private ws?: WebSocket
  private eventListeners: Set<(event: MessageEvent) => void> = new Set()
  private isInitialized = false

  constructor(config: MessagingConfig) {
    this.config = config
    this.publicClient = createPublicClient({
      chain: CHAIN,
      transport: http(config.rpcUrl ?? RPC_URL),
    })
  }

  async initialize(walletSignature: string): Promise<void> {
    this.keyPair = deriveKeyPairFromWallet(this.config.address, walletSignature)
    this.isInitialized = true
    if (this.config.relayUrl) await this.connectToRelay(this.config.relayUrl)
  }

  initializeWithRandomKeys(): void {
    this.keyPair = generateKeyPair()
    this.isInitialized = true
  }

  getKeyDerivationMessage(): string {
    return `Sign this message to enable encrypted messaging on Babylon.\n\nThis signature will be used to derive your encryption keys.\n\nAddress: ${this.config.address}`
  }

  getPublicKeyHex(): string {
    if (!this.keyPair)
      throw new MessagingError(
        'Keys not initialized',
        ErrorCodes.NOT_INITIALIZED,
      )
    return publicKeyToHex(this.keyPair.publicKey)
  }

  async registerKeyOnChain(walletClient: WalletClient): Promise<Hex> {
    if (!this.keyPair)
      throw new MessagingError('Keys not initialized', ErrorCodes.NO_KEY_BUNDLE)
    if (!this.config.keyRegistryAddress)
      throw new MessagingError(
        'KeyRegistry not configured',
        ErrorCodes.CONTRACT_ERROR,
      )

    const identityKey = publicKeyToBytes32(this.keyPair.publicKey)
    if (!walletClient.account) {
      throw new MessagingError(
        'Wallet account not connected',
        ErrorCodes.NOT_INITIALIZED,
      )
    }
    const emptyPreKey: Hex = `0x${'00'.repeat(32)}`
    return walletClient.writeContract({
      chain: null,
      account: walletClient.account,
      address: this.config.keyRegistryAddress,
      abi: KEY_REGISTRY_ABI,
      functionName: 'registerKeyBundle',
      args: [identityKey, identityKey, emptyPreKey],
    })
  }

  async getRecipientPublicKey(recipientAddress: Address): Promise<Uint8Array> {
    if (!this.config.keyRegistryAddress)
      throw new MessagingError(
        'KeyRegistry not configured',
        ErrorCodes.CONTRACT_ERROR,
      )

    const keyBundle = await this.publicClient.readContract({
      address: this.config.keyRegistryAddress,
      abi: KEY_REGISTRY_ABI,
      functionName: 'getKeyBundle',
      args: [recipientAddress],
    })

    if (!keyBundle.isActive) {
      throw new MessagingError(
        `Recipient ${recipientAddress} has no registered keys`,
        ErrorCodes.RECIPIENT_KEY_NOT_FOUND,
      )
    }
    return bytes32ToPublicKey(keyBundle.identityKey)
  }

  async sendMessage(to: Address, content: string): Promise<string> {
    if (!this.keyPair)
      throw new MessagingError(
        'Keys not initialized',
        ErrorCodes.NOT_INITIALIZED,
      )
    if (!this.config.keyRegistryAddress)
      throw new MessagingError(
        'Cannot resolve recipient key',
        ErrorCodes.RECIPIENT_KEY_NOT_FOUND,
      )

    const recipientPublicKey = await this.getRecipientPublicKey(to)
    const encrypted = encryptMessage(
      content,
      recipientPublicKey,
      this.keyPair.privateKey,
    )

    const envelope: MessageEnvelope = {
      id: crypto.randomUUID(),
      from: this.config.address,
      to,
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      ephemeralPublicKey: encrypted.ephemeralPublicKey,
      timestamp: Date.now(),
    }

    if (!this.config.relayUrl)
      throw new MessagingError(
        'No relay configured',
        ErrorCodes.RELAY_UNAVAILABLE,
      )
    await this.sendViaRelay(envelope)
    return envelope.id
  }

  private async sendViaRelay(envelope: MessageEnvelope): Promise<void> {
    if (!this.config.relayUrl)
      throw new MessagingError(
        'Relay not configured',
        ErrorCodes.RELAY_UNAVAILABLE,
      )

    const response = await fetch(`${this.config.relayUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: envelope.id,
        from: envelope.from,
        to: envelope.to,
        ciphertext: bytesToHex(envelope.ciphertext),
        nonce: bytesToHex(envelope.nonce),
        ephemeralPublicKey: bytesToHex(envelope.ephemeralPublicKey),
        timestamp: envelope.timestamp,
      }),
    })

    if (!response.ok)
      throw new MessagingError(
        `Relay error: ${await response.text()}`,
        ErrorCodes.RELAY_UNAVAILABLE,
      )
  }

  async fetchPendingMessages(): Promise<DecryptedMessage[]> {
    if (!this.config.relayUrl) return []

    const response = await fetch(
      `${this.config.relayUrl}/messages/${this.config.address}`,
    )
    if (!response.ok) return []

    const parseResult = RelayMessagesResponseSchema.safeParse(
      await response.json(),
    )

    if (!parseResult.success) {
      logger.error(
        'Invalid relay response',
        { error: parseResult.error },
        'Messaging',
      )
      return []
    }

    const decryptedMessages: DecryptedMessage[] = await Promise.all(
      parseResult.data.messages.map(async (msg) => ({
        id: msg.id,
        from: msg.from as Address,
        to: msg.to as Address,
        content: await this.decryptMessageContent({
          ciphertext: hexToBytes(msg.ciphertext),
          nonce: hexToBytes(msg.nonce),
          ephemeralPublicKey: hexToBytes(msg.ephemeralPublicKey),
        }),
        timestamp: new Date(msg.timestamp),
        isDecentralized: true as const,
      })),
    )
    return decryptedMessages
  }

  private async decryptMessageContent(
    encrypted: EncryptedMessage,
  ): Promise<string> {
    if (!this.keyPair)
      throw new MessagingError(
        'Keys not initialized',
        ErrorCodes.NOT_INITIALIZED,
      )
    return decryptMessageToString(encrypted, this.keyPair.privateKey)
  }

  private async connectToRelay(relayUrl: string): Promise<void> {
    const wsUrl = `${relayUrl.replace(/^http/, 'ws')}/ws`
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      this.ws?.send(
        JSON.stringify({ type: 'subscribe', address: this.config.address }),
      )
      this.emit({ type: 'connection:status', data: { connected: true } })
    }

    this.ws.onmessage = async (event) => {
      const eventData = typeof event.data === 'string' ? event.data : ''
      const parseResult = WebSocketMessageSchema.safeParse(
        JSON.parse(eventData),
      )

      if (!parseResult.success) {
        logger.error(
          'Invalid WebSocket message',
          { error: parseResult.error },
          'Messaging',
        )
        return
      }

      const data = parseResult.data

      if (data.type === 'new_message' && data.message) {
        const msg = data.message
        const content = await this.decryptMessageContent({
          ciphertext: hexToBytes(msg.ciphertext),
          nonce: hexToBytes(msg.nonce),
          ephemeralPublicKey: hexToBytes(msg.ephemeralPublicKey),
        })
        const decryptedMsg: DecryptedMessage = {
          id: msg.id,
          from: msg.from as Address,
          to: msg.to as Address,
          content,
          timestamp: new Date(msg.timestamp),
          isDecentralized: true,
        }
        this.emit({
          type: 'message:new',
          data: decryptedMsg,
        })
      }
    }

    this.ws.onclose = () =>
      this.emit({ type: 'connection:status', data: { connected: false } })
  }

  onMessage(listener: (event: MessageEvent) => void): () => void {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  private emit(event: MessageEvent): void {
    this.eventListeners.forEach((listener) => {
      listener(event)
    })
  }

  disconnect(): void {
    this.ws?.close()
    this.ws = undefined
    this.eventListeners.clear()
  }

  get initialized(): boolean {
    return this.isInitialized
  }
}

export const createMessagingClient = (config: MessagingConfig) =>
  new MessagingClient(config)
