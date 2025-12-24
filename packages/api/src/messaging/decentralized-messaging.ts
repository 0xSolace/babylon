/**
 * Decentralized Messaging API Integration
 *
 * Provides the bridge between API routes and decentralized messaging.
 * Handles the dual-write to both PostgreSQL and CovenantSQL during migration.
 */

import {
  type MessagingConversation as Conversation,
  getMessagingBridge,
  type MessagingMessage as Message,
  type MessagingBridge,
} from '@babylon/messaging'
import { logger } from '@babylon/shared'
import type { Address } from 'viem'

let messagingBridge: MessagingBridge | null = null

function getMessagingBridgeInstance(): MessagingBridge {
  if (!messagingBridge) {
    messagingBridge = getMessagingBridge()
  }
  return messagingBridge
}

export interface MessageResult {
  decentralizedId?: string
  centralizedId: string
  timestamp: number
  encrypted: boolean
}

/**
 * Check if decentralized messaging is enabled
 * Defaults to TRUE - set MESSAGING_MODE=centralized to disable
 */
export function isDecentralizedMessagingEnabled(): boolean {
  // Decentralized is the default - only disable if explicitly set to centralized
  if (process.env.MESSAGING_MODE === 'centralized') {
    return false
  }
  return true
}

/**
 * Send a message through both centralized and decentralized channels
 */
export async function sendMessage(options: {
  chatId: string
  senderId: string
  senderAddress?: Address
  content: string
  messageType: 'dm' | 'group' | 'channel'
  recipientAddress?: Address
  centralizedMessageId: string
  encrypt?: boolean
}): Promise<MessageResult> {
  const result: MessageResult = {
    centralizedId: options.centralizedMessageId,
    timestamp: Date.now(),
    encrypted: false,
  }

  // If decentralized messaging is disabled, return early
  if (!isDecentralizedMessagingEnabled()) {
    return result
  }

  // If no sender address, we can't use decentralized messaging
  if (!options.senderAddress) {
    logger.debug('No sender address provided, skipping decentralized messaging')
    return result
  }

  try {
    const bridge = getMessagingBridgeInstance()

    const sendResult = await bridge.sendMessage(
      options.chatId,
      options.senderId,
      options.senderAddress,
      options.content,
      {
        recipientAddress: options.recipientAddress,
        messageType: options.messageType,
        encrypt: options.encrypt,
      },
    )

    if (sendResult.decentralized) {
      result.decentralizedId = sendResult.decentralized.id
      result.encrypted = Boolean(sendResult.decentralized.encryptedContent)

      logger.info('Message sent to decentralized storage', {
        chatId: options.chatId,
        decentralizedId: result.decentralizedId,
        encrypted: result.encrypted,
      })
    }
  } catch (error) {
    // Log but don't fail - centralized storage is the fallback
    logger.warn('Failed to send to decentralized storage', {
      chatId: options.chatId,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return result
}

/**
 * Get or create a DM conversation
 */
export async function getOrCreateDM(
  user1Address: Address,
  user2Address: Address,
): Promise<{ conversationId: string; isNew: boolean } | null> {
  if (!isDecentralizedMessagingEnabled()) {
    return null
  }

  const bridge = await getMessagingBridgeInstance()
  const conversation = await bridge.getOrCreateDM(user1Address, user2Address)

  if (!conversation) {
    return null
  }

  return {
    conversationId: conversation.id,
    isNew: Date.now() - conversation.createdAt < 1000, // Created in last second
  }
}

/**
 * Get pending messages for a user from decentralized storage
 */
export async function getPendingMessages(
  address: Address,
  limit = 100,
): Promise<
  Array<{
    id: string
    conversationId: string
    sender: Address
    content: string
    timestamp: number
  }>
> {
  if (!isDecentralizedMessagingEnabled()) {
    return []
  }

  const bridge = getMessagingBridgeInstance()
  const messages = await bridge.getPendingMessages(address, limit)

  return messages.map((m: Message) => ({
    id: m.id,
    conversationId: m.conversationId,
    sender: m.sender,
    content: m.content,
    timestamp: m.timestamp,
  }))
}

/**
 * Mark a message as delivered
 */
export async function markMessageDelivered(messageId: string): Promise<void> {
  if (!isDecentralizedMessagingEnabled()) {
    return
  }

  try {
    const bridge = getMessagingBridgeInstance()
    await bridge.markDelivered(messageId)
  } catch (error) {
    logger.warn('Failed to mark message as delivered', {
      messageId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Mark a message as read
 */
export async function markMessageRead(messageId: string): Promise<void> {
  if (!isDecentralizedMessagingEnabled()) {
    return
  }

  try {
    const bridge = getMessagingBridgeInstance()
    await bridge.markRead(messageId)
  } catch (error) {
    logger.warn('Failed to mark message as read', {
      messageId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Get user's decentralized conversations
 */
export async function getConversations(
  address: Address,
  limit = 50,
): Promise<
  Array<{
    id: string
    type: 'dm' | 'group' | 'channel'
    name?: string
    participants: Address[]
    lastMessageAt: number
    lastMessagePreview?: string
  }>
> {
  if (!isDecentralizedMessagingEnabled()) {
    return []
  }

  const bridge = getMessagingBridgeInstance()
  const conversations = await bridge.getUserConversations(address, limit)

  return conversations.map((c: Conversation) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    participants: c.participants,
    lastMessageAt: c.lastMessageAt,
    lastMessagePreview: c.lastMessagePreview,
  }))
}
