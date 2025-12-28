/**
 * Engine Events
 *
 * Event emitter for engine actions. Other packages can subscribe
 * to these events to add side effects (notifications, SSE, etc.)
 *
 * Usage:
 * ```typescript
 * // In engine (emitting):
 * import { engineEvents } from '@babylon/engine';
 * engineEvents.emit('follow', { userId, followerId, followerName });
 *
 * // In api/server (subscribing):
 * import { engineEvents } from '@babylon/engine';
 * engineEvents.on('follow', async ({ userId, followerId, followerName }) => {
 *   await sendNotification(userId, `${followerName} followed you`);
 * });
 * ```
 */

import { logger } from '@babylon/shared'
import type { JsonValue } from '@jejunetwork/shared'

// =============================================================================
// Event Types
// =============================================================================

export interface EngineEventMap {
  // Price updates
  priceUpdate: {
    channel: string
    updates: JsonValue
  }

  // Social events
  follow: {
    userId: string
    followerId: string
  }

  groupChatInvite: {
    userId: string
    inviterId: string
    chatId: string
    chatName: string
  }

  // Trading events
  tradeExecuted: {
    userId: string
    tradeType: 'perp' | 'prediction'
    action: string
    amount: number
    ticker?: string
    marketId?: string
  }
}

export type EngineEventName = keyof EngineEventMap

// =============================================================================
// Event Emitter
// =============================================================================

type EventHandler<T> = (data: T) => void | Promise<void>

class EngineEventEmitter {
  private handlers: Map<string, Set<EventHandler<unknown>>> = new Map()

  /**
   * Subscribe to an engine event
   */
  on<K extends EngineEventName>(
    event: K,
    handler: EventHandler<EngineEventMap[K]>,
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)?.add(handler as EventHandler<unknown>)

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler as EventHandler<unknown>)
    }
  }

  /**
   * Emit an engine event (fire and forget - errors are logged, not thrown)
   */
  emit<K extends EngineEventName>(event: K, data: EngineEventMap[K]): void {
    const handlers = this.handlers.get(event)
    if (!handlers || handlers.size === 0) return

    for (const handler of handlers) {
      try {
        const result = handler(data)
        if (result instanceof Promise) {
          result.catch((error) => {
            logger.error(
              'Error in event handler',
              { event, error },
              'EngineEvents',
            )
          })
        }
      } catch (error) {
        logger.error('Error in event handler', { event, error }, 'EngineEvents')
      }
    }
  }

  /**
   * Remove all handlers for an event (useful for testing)
   */
  removeAllListeners(event?: EngineEventName): void {
    if (event) {
      this.handlers.delete(event)
    } else {
      this.handlers.clear()
    }
  }
}

// Singleton instance
export const engineEvents = new EngineEventEmitter()
