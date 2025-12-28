/**
 * Babylon Messaging API Integration
 *
 * Uses Jeju's decentralized messaging infrastructure directly.
 * - Farcaster: Public posts to /babylon channel
 * - XMTP: Private messaging filtered to Babylon clients
 *
 * For full messaging functionality, use @jejunetwork/messaging directly.
 */

import { logger } from '@babylon/shared'
import type { Address } from 'viem'

/**
 * Check if messaging is enabled
 * Defaults to TRUE - set MESSAGING_ENABLED=false to disable
 */
export function isMessagingEnabled(): boolean {
  return process.env.MESSAGING_ENABLED !== 'false'
}

export interface MessageResult {
  messageId: string
  timestamp: number
  encrypted: boolean
}

/**
 * Send a message via Jeju XMTP
 *
 * For full messaging functionality including DMs, group chats, etc.,
 * use @jejunetwork/messaging directly:
 *
 * ```typescript
 * import { createMessagingClient } from '@jejunetwork/messaging';
 *
 * const client = createMessagingClient({ rpcUrl, relayUrl });
 * await client.initialize(signature);
 * await client.sendMessage({ to: recipient, content: 'Hello' });
 * ```
 */
export async function sendMessage(options: {
  senderAddress: Address
  recipientAddress: Address
  content: string
}): Promise<MessageResult> {
  if (!isMessagingEnabled()) {
    throw new Error('Messaging is disabled')
  }

  // This is a placeholder - actual implementation should use @jejunetwork/messaging
  // directly in the calling code for full functionality
  logger.info('sendMessage called - use @jejunetwork/messaging directly', {
    to: options.recipientAddress,
  })

  return {
    messageId: `msg-${Date.now()}`,
    timestamp: Date.now(),
    encrypted: true,
  }
}
