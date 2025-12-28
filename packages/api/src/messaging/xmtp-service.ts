/**
 * Babylon XMTP Messaging Service
 *
 * Real implementation of XMTP messaging for Babylon using Jeju infrastructure.
 * This provides end-to-end encrypted private messaging between users.
 *
 * Features:
 * - End-to-end encryption (X25519 + AES-256-GCM)
 * - Decentralized relay network
 * - On-chain key registry
 * - MLS group messaging support
 */

import { logger } from '@babylon/shared'
import type { Address } from 'viem'

/** Configuration for the XMTP service */
export interface XMTPServiceConfig {
  /** RPC URL for blockchain access */
  rpcUrl: string
  /** Relay URL for message routing */
  relayUrl: string
  /** Key registry contract address */
  keyRegistryAddress?: Address
  /** Node registry contract address */
  nodeRegistryAddress?: Address
  /** Whether to use KMS for key management (recommended) */
  useKMS?: boolean
  /** KMS endpoint URL */
  kmsEndpoint?: string
}

/** Message in the XMTP system */
export interface XMTPMessage {
  id: string
  senderId: Address
  recipientId: Address
  content: string
  timestamp: number
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
}

/** Group chat in XMTP */
export interface XMTPGroup {
  id: string
  name: string
  members: Address[]
  createdAt: number
  lastMessageAt: number
}

/** Result of sending a message */
export interface SendMessageResult {
  success: boolean
  messageId?: string
  error?: string
  deliveryTimeMs?: number
}

/**
 * XMTP Messaging Service for Babylon
 *
 * Wraps @jejunetwork/messaging to provide Babylon-specific functionality
 */
class XMTPMessagingService {
  private config: XMTPServiceConfig
  private initialized = false
  private messagingClient:
    | import('@jejunetwork/messaging').MessagingClient
    | null = null

  constructor(config: XMTPServiceConfig) {
    this.config = config
  }

  /**
   * Initialize the XMTP service
   */
  async initialize(userAddress: Address, signature?: string): Promise<void> {
    if (this.initialized) return

    try {
      // Dynamically import to avoid loading deps if not needed
      const { createMessagingClient } = await import('@jejunetwork/messaging')

      this.messagingClient = createMessagingClient({
        address: userAddress,
        rpcUrl: this.config.rpcUrl,
        relayUrl: this.config.relayUrl,
        keyRegistryAddress: this.config.keyRegistryAddress,
        nodeRegistryAddress: this.config.nodeRegistryAddress,
        autoReconnect: true,
      })

      // Initialize with signature for key derivation
      await this.messagingClient.initialize(signature)

      logger.info(
        'XMTP service initialized',
        { userAddress },
        'XMTPMessagingService',
      )
      this.initialized = true
    } catch (error) {
      logger.error(
        'Failed to initialize XMTP service',
        { error: error instanceof Error ? error.message : 'Unknown' },
        'XMTPMessagingService',
      )
      throw error
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.messagingClient !== null
  }

  /**
   * Send a private message to another user
   */
  async sendMessage(
    recipient: Address,
    content: string,
  ): Promise<SendMessageResult> {
    if (!this.messagingClient) {
      return { success: false, error: 'Service not initialized' }
    }

    try {
      const result = await this.messagingClient.sendMessage({
        to: recipient,
        content,
      })

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        deliveryTimeMs: result.deliveryTimeMs,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get message history with a user
   */
  getMessages(chatId: string): XMTPMessage[] {
    if (!this.messagingClient) return []

    return this.messagingClient.getMessages(chatId).map((msg) => ({
      id: msg.id,
      senderId: msg.senderId as Address,
      recipientId: msg.recipientId as Address,
      content: msg.content,
      timestamp: msg.timestamp,
      status: msg.status as XMTPMessage['status'],
    }))
  }

  /**
   * Subscribe to new messages
   */
  onMessage(handler: (message: XMTPMessage) => void): () => void {
    if (!this.messagingClient) {
      return () => {}
    }

    return this.messagingClient.onMessage((event) => {
      if (event.type === 'message:new') {
        const msg = event.data as {
          id: string
          senderId: string
          recipientId: string
          content: string
          timestamp: number
          status: string
        }
        handler({
          id: msg.id,
          senderId: msg.senderId as Address,
          recipientId: msg.recipientId as Address,
          content: msg.content,
          timestamp: msg.timestamp,
          status: msg.status as XMTPMessage['status'],
        })
      }
    })
  }

  /**
   * Check if user has registered messaging keys
   */
  async isUserRegistered(address: Address): Promise<boolean> {
    if (!this.messagingClient) return false

    const publicKey = await this.messagingClient.getRecipientPublicKey(address)
    return publicKey !== undefined
  }

  /**
   * Get the signature message for key derivation
   */
  getKeyDerivationMessage(): string {
    if (!this.messagingClient) {
      return 'Sign to enable encrypted messaging on Babylon'
    }
    return this.messagingClient.getKeyDerivationMessage()
  }

  /**
   * Disconnect from the relay
   */
  disconnect(): void {
    if (this.messagingClient) {
      this.messagingClient.disconnect()
      this.messagingClient = null
      this.initialized = false
    }
  }
}

// Default config from environment
function getDefaultConfig(): XMTPServiceConfig {
  return {
    rpcUrl: process.env.JEJU_RPC_URL ?? 'http://localhost:8545',
    relayUrl: process.env.JEJU_RELAY_URL ?? 'http://localhost:3200',
    keyRegistryAddress: process.env.KEY_REGISTRY_ADDRESS as Address | undefined,
    nodeRegistryAddress: process.env.NODE_REGISTRY_ADDRESS as
      | Address
      | undefined,
    useKMS: process.env.USE_KMS_MESSAGING === 'true',
    kmsEndpoint: process.env.JEJU_KMS_ENDPOINT,
  }
}

// Service instances per user
const userServices = new Map<Address, XMTPMessagingService>()

/**
 * Get or create an XMTP service for a user
 */
export function getXMTPService(
  userAddress: Address,
  config?: Partial<XMTPServiceConfig>,
): XMTPMessagingService {
  const existing = userServices.get(userAddress)
  if (existing) return existing

  const mergedConfig = { ...getDefaultConfig(), ...config }
  const service = new XMTPMessagingService(mergedConfig)
  userServices.set(userAddress, service)
  return service
}

/**
 * Create a new XMTP service instance
 */
export function createXMTPService(
  config?: Partial<XMTPServiceConfig>,
): XMTPMessagingService {
  const mergedConfig = { ...getDefaultConfig(), ...config }
  return new XMTPMessagingService(mergedConfig)
}

/**
 * Remove a user's XMTP service (on logout)
 */
export function removeXMTPService(userAddress: Address): void {
  const service = userServices.get(userAddress)
  if (service) {
    service.disconnect()
    userServices.delete(userAddress)
  }
}

export { XMTPMessagingService }
