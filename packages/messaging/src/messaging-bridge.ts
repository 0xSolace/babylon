/**
 * Messaging Bridge
 *
 * Bridges the existing PostgreSQL-based messaging with the new decentralized system.
 * Allows gradual migration without breaking existing functionality.
 *
 * When USE_DECENTRALIZED_MESSAGING=true:
 * - All new messages go to CovenantSQL
 * - Reads check both systems and merge
 * - Writes mirror to both during transition
 */

import type { Address } from 'viem'
import {
  type Conversation,
  getMessaging,
  type Message,
  type SendMessageRequest,
} from './messaging'

export type MessagingMode = 'centralized' | 'decentralized' | 'hybrid'

const MESSAGING_MODES: readonly MessagingMode[] = [
  'centralized',
  'decentralized',
  'hybrid',
]

function isMessagingMode(value: string): value is MessagingMode {
  return MESSAGING_MODES.includes(value as MessagingMode)
}

interface BridgeConfig {
  mode: MessagingMode
  mirrorToCentralized: boolean
  centralizedWriter?: CentralizedWriter
  onMessageSent?: (message: Message) => Promise<void>
}

interface CentralizedWriter {
  createMessage: (data: {
    id: string
    chatId: string
    senderId: string
    content: string
    createdAt: Date
  }) => Promise<void>
  updateChat: (chatId: string, lastMessageAt: Date) => Promise<void>
}

class MessagingBridge {
  private config: BridgeConfig

  constructor(config?: Partial<BridgeConfig>) {
    const envMode = process.env.MESSAGING_MODE
    const mode: MessagingMode =
      envMode && isMessagingMode(envMode) ? envMode : 'decentralized'
    this.config = {
      // Default to decentralized mode - use MESSAGING_MODE=centralized to disable
      mode,
      // Mirror to PostgreSQL for backward compatibility (disable with MIRROR_TO_CENTRALIZED=false)
      mirrorToCentralized: process.env.MIRROR_TO_CENTRALIZED !== 'false',
      ...config,
    }
  }

  /**
   * Check if decentralized messaging is enabled
   */
  isDecentralizedEnabled(): boolean {
    return this.config.mode === 'decentralized' || this.config.mode === 'hybrid'
  }

  /**
   * Send a message through the appropriate channel(s)
   */
  async sendMessage(
    chatId: string,
    senderId: string,
    senderAddress: Address,
    content: string,
    options: {
      recipientAddress?: Address
      messageType: 'dm' | 'group' | 'channel'
      encrypt?: boolean
    },
  ): Promise<{ decentralized?: Message; centralizedId?: string }> {
    const result: { decentralized?: Message; centralizedId?: string } = {}

    // Send to decentralized storage
    if (this.isDecentralizedEnabled()) {
      const messaging = getMessaging()
      const request: SendMessageRequest = {
        conversationId: chatId,
        senderAddress,
        recipientAddress: options.recipientAddress,
        content,
        messageType: options.messageType,
        encrypt: options.encrypt,
      }

      result.decentralized = await messaging.sendMessage(request)

      // Notify listeners
      if (this.config.onMessageSent) {
        await this.config.onMessageSent(result.decentralized)
      }
    }

    // Mirror to centralized storage (for backward compatibility)
    if (
      this.config.mode !== 'decentralized' ||
      this.config.mirrorToCentralized
    ) {
      if (this.config.centralizedWriter) {
        const messageId = result.decentralized?.id ?? `msg-${Date.now()}`
        await this.config.centralizedWriter.createMessage({
          id: messageId,
          chatId,
          senderId,
          content,
          createdAt: new Date(),
        })
        result.centralizedId = messageId
      }
    }

    return result
  }

  /**
   * Get messages for a conversation (merges from both sources if hybrid)
   */
  async getMessages(
    chatId: string,
    options: { limit?: number; before?: number } = {},
  ): Promise<Message[]> {
    if (!this.isDecentralizedEnabled()) {
      // Return empty - caller should use centralized query
      return []
    }

    const messaging = getMessaging()
    return messaging.getMessages({
      conversationId: chatId,
      limit: options.limit,
      before: options.before,
    })
  }

  /**
   * Get or create a DM conversation
   */
  async getOrCreateDM(
    user1Address: Address,
    user2Address: Address,
  ): Promise<Conversation | null> {
    if (!this.isDecentralizedEnabled()) {
      return null
    }

    const messaging = getMessaging()
    return messaging.getOrCreateDMConversation(user1Address, user2Address)
  }

  /**
   * Get pending messages for a user
   */
  async getPendingMessages(address: Address, limit = 100): Promise<Message[]> {
    if (!this.isDecentralizedEnabled()) {
      return []
    }

    const messaging = getMessaging()
    return messaging.getPendingMessages(address, limit)
  }

  /**
   * Mark message as delivered
   */
  async markDelivered(messageId: string): Promise<void> {
    if (!this.isDecentralizedEnabled()) {
      return
    }

    const messaging = getMessaging()
    await messaging.updateDeliveryStatus(messageId, 'delivered')
  }

  /**
   * Mark message as read
   */
  async markRead(messageId: string): Promise<void> {
    if (!this.isDecentralizedEnabled()) {
      return
    }

    const messaging = getMessaging()
    await messaging.updateDeliveryStatus(messageId, 'read')
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(
    address: Address,
    limit = 50,
  ): Promise<Conversation[]> {
    if (!this.isDecentralizedEnabled()) {
      return []
    }

    const messaging = getMessaging()
    return messaging.getUserConversations(address, limit)
  }

  /**
   * Set the centralized writer for mirroring
   */
  setCentralizedWriter(writer: CentralizedWriter): void {
    this.config.centralizedWriter = writer
  }

  /**
   * Set callback for message sent events
   */
  onMessageSent(callback: (message: Message) => Promise<void>): void {
    this.config.onMessageSent = callback
  }
}

// Singleton
let bridge: MessagingBridge | null = null

export function getMessagingBridge(): MessagingBridge {
  if (!bridge) {
    bridge = new MessagingBridge()
  }
  return bridge
}

export function resetMessagingBridge(): void {
  bridge = null
}

export { MessagingBridge }
