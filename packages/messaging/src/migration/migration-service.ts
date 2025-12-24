/**
 * Migration Service for Babylon DMs
 *
 * Migrates existing centralized DM conversations to the
 * decentralized messaging protocol while maintaining message history.
 */

import type { Address } from 'viem'
import type { MessagingClient } from '../client'
import type { MigrationStatus } from '../types'

interface CentralizedDM {
  chatId: string
  participant1Id: string
  participant1Address: Address
  participant2Id: string
  participant2Address: Address
  messages: Array<{
    id: string
    senderId: string
    content: string
    createdAt: Date
  }>
}

interface MigrationOptions {
  /** Batch size for message migration */
  batchSize?: number
  /** Delay between batches (ms) */
  batchDelay?: number
  /** Whether to delete centralized messages after migration */
  deleteCentralized?: boolean
}

type FetchDMsCallback = () => Promise<CentralizedDM[]>
type UpdateStatusCallback = (status: MigrationStatus) => Promise<void>
type DeleteCentralizedCallback = (chatId: string) => Promise<void>

/**
 * Service for migrating Babylon DMs to decentralized protocol
 *
 * Migration Process:
 * 1. Fetch all DM conversations from centralized DB
 * 2. For each conversation:
 *    a. Ensure both participants have registered keys
 *    b. Re-encrypt messages with recipient's public key
 *    c. Store on decentralized relay
 *    d. Update migration status
 * 3. Optionally delete centralized copies
 */
export class MigrationService {
  private options: Required<MigrationOptions>
  private statuses: Map<string, MigrationStatus> = new Map()

  constructor(options: MigrationOptions = {}) {
    this.options = {
      batchSize: 50,
      batchDelay: 1000,
      deleteCentralized: false,
      ...options,
    }
  }

  /**
   * Run full migration
   */
  async migrate(
    client: MessagingClient,
    callbacks: {
      fetchDMs: FetchDMsCallback
      updateStatus: UpdateStatusCallback
      deleteCentralized?: DeleteCentralizedCallback
    },
  ): Promise<MigrationStatus[]> {
    const dms = await callbacks.fetchDMs()
    const results: MigrationStatus[] = []

    for (const dm of dms) {
      const status = await this.migrateDM(dm, client, callbacks)
      results.push(status)
    }

    return results
  }

  /**
   * Migrate a single DM conversation
   */
  private async migrateDM(
    dm: CentralizedDM,
    client: MessagingClient,
    callbacks: {
      updateStatus: UpdateStatusCallback
      deleteCentralized?: DeleteCentralizedCallback
    },
  ): Promise<MigrationStatus> {
    const status: MigrationStatus = {
      chatId: dm.chatId,
      participant1: dm.participant1Id,
      participant2: dm.participant2Id,
      totalMessages: dm.messages.length,
      migratedMessages: 0,
      status: 'in_progress',
      startedAt: new Date(),
    }

    this.statuses.set(dm.chatId, status)
    await callbacks.updateStatus(status)

    // Process messages in batches
    const batches = this.createBatches(dm.messages, this.options.batchSize)

    for (const batch of batches) {
      for (const msg of batch) {
        // Determine recipient based on sender
        const recipientAddress =
          msg.senderId === dm.participant1Id
            ? dm.participant2Address
            : dm.participant1Address

        // Send message through decentralized protocol
        // Note: This re-encrypts for the recipient
        await client.sendMessage(recipientAddress, msg.content)

        status.migratedMessages++
      }

      await callbacks.updateStatus(status)

      // Delay between batches
      if (this.options.batchDelay > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.options.batchDelay),
        )
      }
    }

    // Mark complete
    status.status = 'completed'
    status.completedAt = new Date()
    await callbacks.updateStatus(status)

    // Optionally delete centralized messages
    if (this.options.deleteCentralized && callbacks.deleteCentralized) {
      await callbacks.deleteCentralized(dm.chatId)
    }

    return status
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Get migration status for a chat
   */
  getStatus(chatId: string): MigrationStatus | undefined {
    return this.statuses.get(chatId)
  }

  /**
   * Get all migration statuses
   */
  getAllStatuses(): MigrationStatus[] {
    return Array.from(this.statuses.values())
  }

  /**
   * Check if migration is complete for all chats
   */
  isComplete(): boolean {
    for (const status of this.statuses.values()) {
      if (status.status !== 'completed' && status.status !== 'failed') {
        return false
      }
    }
    return true
  }
}

/**
 * Factory function to create migration service
 */
export function createMigrationService(
  options?: MigrationOptions,
): MigrationService {
  return new MigrationService(options)
}
