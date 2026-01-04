/**
 * Babylon XMTP Messaging Service
 *
 * Real XMTP SDK integration with Jeju KMS for secure signing.
 * - End-to-end encryption via MLS (Message Layer Security)
 * - Compatible with all XMTP clients (MetaMask, Coinbase, etc.)
 * - Private keys never leave KMS enclave
 */

import { logger } from '@babylon/shared'
import { getRpcUrl } from '@babylon/shared/config'
import {
  Client as XMTPClient,
  type Signer as XMTPSigner,
  type Dm,
  type Group,
  type DecodedMessage,
  type Identifier,
  type IdentifierKind,
} from '@xmtp/node-sdk'
import { createKMSSigner, type KMSSigner } from '@jejunetwork/kms'
import type { Address } from 'viem'
import { toBytes } from 'viem'
import { createHash } from 'crypto'

/** Configuration for the XMTP service */
export interface XMTPServiceConfig {
  /** XMTP environment */
  env?: 'local' | 'dev' | 'production'
  /** Path for XMTP database */
  dbPath?: string
}

/** Message in the XMTP system */
export interface XMTPMessage {
  id: string
  senderId: string
  conversationId: string
  content: string
  sentAt: Date
}

/** Conversation in XMTP */
export interface XMTPConversation {
  id: string
  peerInboxId?: string
  name?: string
  isGroup: boolean
  createdAt: Date
}

/** Result of sending a message */
export interface SendMessageResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Generate DB encryption key from KMS signature
 */
async function getDbEncryptionKey(kmsSigner: KMSSigner): Promise<Uint8Array> {
  const result = await kmsSigner.signMessage('XMTP_DB_ENCRYPTION_KEY_V1')
  const hash = createHash('sha256').update(toBytes(result.signature)).digest()
  return new Uint8Array(hash)
}

/**
 * Create XMTP-compatible signer from KMS
 */
function createXMTPKMSSigner(kmsSigner: KMSSigner, address: Address): XMTPSigner {
  return {
    type: 'EOA',
    getIdentifier: (): Identifier => ({
      identifier: address.toLowerCase(),
      identifierKind: 0 as IdentifierKind,
    }),
    signMessage: async (message: string): Promise<Uint8Array> => {
      const result = await kmsSigner.signMessage(message)
      return toBytes(result.signature)
    },
  }
}

/**
 * XMTP Messaging Service for Babylon
 *
 * Uses real XMTP SDK with KMS-backed signing
 */
class XMTPMessagingService {
  private config: XMTPServiceConfig
  private client: XMTPClient | null = null
  private kmsSigner: KMSSigner | null = null
  private userAddress: Address | null = null
  private initialized = false

  constructor(config: XMTPServiceConfig = {}) {
    this.config = config
  }

  /**
   * Initialize the XMTP service with KMS
   */
  async initialize(userAddress: Address): Promise<void> {
    if (this.initialized && this.client) return

    this.userAddress = userAddress

    // Create KMS signer
    this.kmsSigner = createKMSSigner({
      serviceId: `xmtp-${userAddress.toLowerCase()}`,
      allowLocalDev: true,
    })
    await this.kmsSigner.initialize()

    // Create XMTP signer wrapper
    const xmtpSigner = createXMTPKMSSigner(this.kmsSigner, userAddress)

    // Get DB encryption key from KMS
    const dbEncryptionKey = await getDbEncryptionKey(this.kmsSigner)

    // Create real XMTP client
    this.client = await XMTPClient.create(xmtpSigner, {
      env: this.config.env ?? 'dev',
      dbPath: this.config.dbPath ?? `./data/xmtp/${userAddress.toLowerCase()}.db3`,
      dbEncryptionKey,
    })

    logger.info(
      'XMTP service initialized',
      { userAddress, inboxId: this.client.inboxId },
      'XMTPMessagingService',
    )
    this.initialized = true
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.client !== null
  }

  /**
   * Get the XMTP inbox ID
   */
  getInboxId(): string | null {
    return this.client?.inboxId ?? null
  }

  /**
   * Send a DM to another user
   */
  async sendDM(recipientAddress: Address, content: string): Promise<SendMessageResult> {
    if (!this.client) {
      return { success: false, error: 'Service not initialized' }
    }

    const dm = await this.client.conversations.newDmWithIdentifier({
      identifier: recipientAddress.toLowerCase(),
      identifierKind: 0 as IdentifierKind,
    })

    const messageId = await dm.send(content)

    return {
      success: true,
      messageId,
    }
  }

  /**
   * Create a group conversation
   */
  async createGroup(
    participantAddresses: Address[],
    name?: string,
    description?: string,
  ): Promise<Group> {
    if (!this.client) {
      throw new Error('Service not initialized')
    }

    const identifiers: Identifier[] = participantAddresses.map((addr) => ({
      identifier: addr.toLowerCase(),
      identifierKind: 0 as IdentifierKind,
    }))

    return this.client.conversations.newGroupWithIdentifiers(identifiers, {
      name: name ?? '',
      description: description ?? '',
    })
  }

  /**
   * Send message to a conversation
   */
  async sendMessage(conversationId: string, content: string): Promise<SendMessageResult> {
    if (!this.client) {
      return { success: false, error: 'Service not initialized' }
    }

    const conversation = await this.client.conversations.getConversationById(conversationId)
    if (!conversation) {
      return { success: false, error: 'Conversation not found' }
    }

    const messageId = await conversation.send(content)

    return {
      success: true,
      messageId,
    }
  }

  /**
   * Get messages from a conversation
   */
  async getMessages(conversationId: string, limit = 50): Promise<XMTPMessage[]> {
    if (!this.client) return []

    const conversation = await this.client.conversations.getConversationById(conversationId)
    if (!conversation) return []

    await conversation.sync()
    const messages = await conversation.messages({ limit })

    return messages.map((msg) => ({
      id: msg.id,
      senderId: msg.senderInboxId,
      conversationId: msg.conversationId,
      content: String(msg.content),
      sentAt: msg.sentAt,
    }))
  }

  /**
   * List all conversations
   */
  async listConversations(): Promise<XMTPConversation[]> {
    if (!this.client) return []

    await this.client.conversations.sync()

    const dms = this.client.conversations.listDms()
    const groups = this.client.conversations.listGroups()

    const result: XMTPConversation[] = []

    for (const dm of dms) {
      result.push({
        id: dm.id,
        peerInboxId: dm.peerInboxId,
        isGroup: false,
        createdAt: dm.createdAt,
      })
    }

    for (const group of groups) {
      result.push({
        id: group.id,
        name: group.name,
        isGroup: true,
        createdAt: group.createdAt,
      })
    }

    return result
  }

  /**
   * Stream incoming messages
   */
  async streamMessages(
    callback: (message: XMTPMessage) => void,
  ): Promise<() => Promise<void>> {
    if (!this.client) {
      throw new Error('Service not initialized')
    }

    const stream = await this.client.conversations.streamAllMessages({
      onValue: (msg: DecodedMessage) => {
        callback({
          id: msg.id,
          senderId: msg.senderInboxId,
          conversationId: msg.conversationId,
          content: String(msg.content),
          sentAt: msg.sentAt,
        })
      },
    })

    return async () => {
      await stream.return()
    }
  }

  /**
   * Check if we can message a wallet
   */
  async canMessage(address: Address): Promise<boolean> {
    if (!this.client) return false

    const result = await this.client.canMessage([
      { identifier: address.toLowerCase(), identifierKind: 0 as IdentifierKind },
    ])

    return result.get(address.toLowerCase()) ?? false
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.client = null
    this.kmsSigner = null
    this.initialized = false
  }
}

// Service instances per user
const userServices = new Map<Address, XMTPMessagingService>()

/**
 * Get or create an XMTP service for a user
 */
export function getXMTPService(
  userAddress: Address,
  config?: XMTPServiceConfig,
): XMTPMessagingService {
  const normalizedAddress = userAddress.toLowerCase() as Address
  const existing = userServices.get(normalizedAddress)
  if (existing) return existing

  const service = new XMTPMessagingService(config)
  userServices.set(normalizedAddress, service)
  return service
}

/**
 * Create a new XMTP service instance
 */
export function createXMTPService(config?: XMTPServiceConfig): XMTPMessagingService {
  return new XMTPMessagingService(config)
}

/**
 * Remove a user's XMTP service (on logout)
 */
export function removeXMTPService(userAddress: Address): void {
  const normalizedAddress = userAddress.toLowerCase() as Address
  const service = userServices.get(normalizedAddress)
  if (service) {
    service.disconnect()
    userServices.delete(normalizedAddress)
  }
}

export { XMTPMessagingService }
