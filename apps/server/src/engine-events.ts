/**
 * Engine Events Setup
 *
 * Subscribes to engine events and connects them to API services.
 * This bridges the pure engine domain to server-side side effects
 * (SSE broadcasting, notifications, etc.)
 */

import {
  broadcastToChannel,
  notifyFollow,
  notifyGroupChatInvite,
  type RealtimeChannel,
} from '@babylon/api'
import { engineEvents } from '@babylon/engine'

/**
 * Type guard for RealtimeChannel
 */
function isRealtimeChannel(channel: string): channel is RealtimeChannel {
  // Valid channels: prices, market:{id}, agent:{id}, user:{id}, etc.
  return typeof channel === 'string' && channel.length > 0
}

/**
 * Initialize engine event listeners
 * Call this once during server bootstrap
 */
export function setupEngineEvents(): void {
  console.log('[EngineEvents] Setting up engine event listeners...')

  // Price updates → SSE broadcast
  engineEvents.on('priceUpdate', async ({ channel, updates }) => {
    try {
      if (isRealtimeChannel(channel)) {
        await broadcastToChannel(channel, {
          type: 'price_update',
          updates,
        })
      }
    } catch (error) {
      console.error('[EngineEvents] Failed to broadcast price update:', error)
    }
  })

  // NPC follows user → notification
  engineEvents.on('follow', async ({ userId, followerId }) => {
    try {
      await notifyFollow(userId, followerId)
    } catch (error) {
      console.error('[EngineEvents] Failed to send follow notification:', error)
    }
  })

  // Group chat invite → notification
  engineEvents.on(
    'groupChatInvite',
    async ({ userId, inviterId, chatId, chatName }) => {
      try {
        await notifyGroupChatInvite(userId, inviterId, chatId, chatName)
      } catch (error) {
        console.error(
          '[EngineEvents] Failed to send group invite notification:',
          error,
        )
      }
    },
  )

  console.log('[EngineEvents] Engine event listeners ready')
}
