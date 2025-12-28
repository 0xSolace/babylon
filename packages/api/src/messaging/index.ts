/**
 * Babylon Messaging Module
 *
 * Provides messaging integrations for Babylon:
 * - XMTP for end-to-end encrypted private messaging
 * - Farcaster for public social messaging (via @babylon/engine)
 */

// Legacy placeholder (deprecated)
export {
  isMessagingEnabled,
  type MessageResult,
  sendMessage,
} from './messaging'

// Real XMTP Service
export {
  createXMTPService,
  getXMTPService,
  removeXMTPService,
  type SendMessageResult,
  type XMTPGroup,
  type XMTPMessage,
  XMTPMessagingService,
  type XMTPServiceConfig,
} from './xmtp-service'
