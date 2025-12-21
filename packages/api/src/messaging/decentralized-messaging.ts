/**
 * Decentralized Messaging API Integration
 *
 * Provides the bridge between API routes and decentralized messaging.
 * Handles the dual-write to both PostgreSQL and CovenantSQL during migration.
 */

import { logger } from '@babylon/shared';
import { type Address } from 'viem';

// Types from the messaging package
interface Message {
  id: string;
  conversationId: string;
  sender: Address;
  recipient: Address | null;
  content: string;
  encryptedContent?: string;
  timestamp: number;
  messageType: 'dm' | 'group' | 'channel';
  deliveryStatus: 'pending' | 'delivered' | 'read';
}

interface Conversation {
  id: string;
  type: 'dm' | 'group' | 'channel';
  name?: string;
  participants: Address[];
  createdAt: number;
  lastMessageAt: number;
  lastMessagePreview?: string;
}

interface MessagingBridge {
  sendMessage: (
    chatId: string,
    senderId: string,
    senderAddress: Address,
    content: string,
    options: {
      recipientAddress?: Address;
      messageType: 'dm' | 'group' | 'channel';
      encrypt?: boolean;
    }
  ) => Promise<{ decentralized?: Message; centralizedId?: string }>;
  getOrCreateDM: (
    user1: Address,
    user2: Address
  ) => Promise<Conversation | null>;
  getPendingMessages: (address: Address, limit?: number) => Promise<Message[]>;
  markDelivered: (messageId: string) => Promise<void>;
  markRead: (messageId: string) => Promise<void>;
  getUserConversations: (
    address: Address,
    limit?: number
  ) => Promise<Conversation[]>;
}

// Lazy import to avoid circular dependencies
let messagingBridge: MessagingBridge | null = null;

async function getMessagingBridgeInstance(): Promise<MessagingBridge> {
  if (!messagingBridge) {
    const { getMessagingBridge } = await import('@babylon/messaging');
    messagingBridge = getMessagingBridge() as unknown as MessagingBridge;
  }
  return messagingBridge;
}

export interface DecentralizedMessageResult {
  decentralizedId?: string;
  centralizedId: string;
  timestamp: number;
  encrypted: boolean;
}

/**
 * Check if decentralized messaging is enabled
 * Defaults to TRUE - set MESSAGING_MODE=centralized to disable
 */
export function isDecentralizedMessagingEnabled(): boolean {
  // Decentralized is the default - only disable if explicitly set to centralized
  if (process.env.MESSAGING_MODE === 'centralized') {
    return false;
  }
  return true;
}

/**
 * Send a message through both centralized and decentralized channels
 */
export async function sendDecentralizedMessage(options: {
  chatId: string;
  senderId: string;
  senderAddress?: Address;
  content: string;
  messageType: 'dm' | 'group' | 'channel';
  recipientAddress?: Address;
  centralizedMessageId: string;
  encrypt?: boolean;
}): Promise<DecentralizedMessageResult> {
  const result: DecentralizedMessageResult = {
    centralizedId: options.centralizedMessageId,
    timestamp: Date.now(),
    encrypted: false,
  };

  // If decentralized messaging is disabled, return early
  if (!isDecentralizedMessagingEnabled()) {
    return result;
  }

  // If no sender address, we can't use decentralized messaging
  if (!options.senderAddress) {
    logger.debug(
      'No sender address provided, skipping decentralized messaging'
    );
    return result;
  }

  try {
    const bridge = await getMessagingBridgeInstance();

    const sendResult = await bridge.sendMessage(
      options.chatId,
      options.senderId,
      options.senderAddress,
      options.content,
      {
        recipientAddress: options.recipientAddress,
        messageType: options.messageType,
        encrypt: options.encrypt,
      }
    );

    if (sendResult.decentralized) {
      result.decentralizedId = sendResult.decentralized.id;
      result.encrypted = Boolean(sendResult.decentralized.encryptedContent);

      logger.info('Message sent to decentralized storage', {
        chatId: options.chatId,
        decentralizedId: result.decentralizedId,
        encrypted: result.encrypted,
      });
    }
  } catch (error) {
    // Log but don't fail - centralized storage is the fallback
    logger.warn('Failed to send to decentralized storage', {
      chatId: options.chatId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Get or create a decentralized DM conversation
 */
export async function getOrCreateDecentralizedDM(
  user1Address: Address,
  user2Address: Address
): Promise<{ conversationId: string; isNew: boolean } | null> {
  if (!isDecentralizedMessagingEnabled()) {
    return null;
  }

  const bridge = await getMessagingBridgeInstance();
  const conversation = await bridge.getOrCreateDM(user1Address, user2Address);

  if (!conversation) {
    return null;
  }

  return {
    conversationId: conversation.id,
    isNew: Date.now() - conversation.createdAt < 1000, // Created in last second
  };
}

/**
 * Get pending messages for a user from decentralized storage
 */
export async function getPendingDecentralizedMessages(
  address: Address,
  limit = 100
): Promise<
  Array<{
    id: string;
    conversationId: string;
    sender: Address;
    content: string;
    timestamp: number;
  }>
> {
  if (!isDecentralizedMessagingEnabled()) {
    return [];
  }

  const bridge = await getMessagingBridgeInstance();
  const messages = await bridge.getPendingMessages(address, limit);

  return messages.map((m: Message) => ({
    id: m.id,
    conversationId: m.conversationId,
    sender: m.sender,
    content: m.content,
    timestamp: m.timestamp,
  }));
}

/**
 * Mark a decentralized message as delivered
 */
export async function markDecentralizedMessageDelivered(
  messageId: string
): Promise<void> {
  if (!isDecentralizedMessagingEnabled()) {
    return;
  }

  try {
    const bridge = await getMessagingBridgeInstance();
    await bridge.markDelivered(messageId);
  } catch (error) {
    logger.warn('Failed to mark decentralized message as delivered', {
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Mark a decentralized message as read
 */
export async function markDecentralizedMessageRead(
  messageId: string
): Promise<void> {
  if (!isDecentralizedMessagingEnabled()) {
    return;
  }

  try {
    const bridge = await getMessagingBridgeInstance();
    await bridge.markRead(messageId);
  } catch (error) {
    logger.warn('Failed to mark decentralized message as read', {
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get user's decentralized conversations
 */
export async function getDecentralizedConversations(
  address: Address,
  limit = 50
): Promise<
  Array<{
    id: string;
    type: 'dm' | 'group' | 'channel';
    name?: string;
    participants: Address[];
    lastMessageAt: number;
    lastMessagePreview?: string;
  }>
> {
  if (!isDecentralizedMessagingEnabled()) {
    return [];
  }

  const bridge = await getMessagingBridgeInstance();
  const conversations = await bridge.getUserConversations(address, limit);

  return conversations.map((c: Conversation) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    participants: c.participants,
    lastMessageAt: c.lastMessageAt,
    lastMessagePreview: c.lastMessagePreview,
  }));
}
