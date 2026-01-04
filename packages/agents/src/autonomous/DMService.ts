/**
 * DM Service - NPC agent responses to DMs using @jejunetwork/db
 */

import { getKMSClient } from '@babylon/api'
import { db } from '@babylon/db'
import { toAddressOrNull, toHexOrNull } from '@babylon/shared'
import type { IAgentRuntime } from '@elizaos/core'
import { getSQLit, type SQLitClient } from '@jejunetwork/db'
import { generateSnowflakeId } from '@jejunetwork/shared'
import type { Address } from 'viem'
import { isProductionEnvironment } from '../config/tee'
import { callAgentLLM } from '../llm'
import { getAgentConfig } from '../shared/agent-config'
import { logger } from '../shared/logger'

interface Message {
  id: string
  conversationId: string
  sender: Address
  recipient: Address
  content: string
  timestamp: number
}

export class DMService {
  private sqlit: SQLitClient | null = null

  private async getSQLitClient(): Promise<SQLitClient> {
    if (!this.sqlit) {
      const privateKey = toHexOrNull(process.env.SQLIT_PRIVATE_KEY)
      this.sqlit = getSQLit({
        blockProducerEndpoint:
          process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:4661',
        databaseId: process.env.SQLIT_DATABASE_ID ?? 'babylon-messaging',
        privateKey: privateKey ?? undefined,
      })
      const healthy = await this.sqlit.isHealthy()
      if (!healthy) throw new Error('[DM] SQLit not healthy')
    }
    return this.sqlit
  }

  async respondToDMs(
    agentUserId: string,
    runtime: IAgentRuntime,
  ): Promise<number> {
    const agent = await db.user.findUnique({
      where: { id: agentUserId },
    })
    if (!agent?.isActor && !agent?.isAgent)
      throw new Error('Agent/Actor not found')
    if (!agent.walletAddress) {
      logger.debug(
        `Agent ${agentUserId} has no wallet, skipping DMs`,
        undefined,
        'DM',
      )
      return 0
    }

    const config = await getAgentConfig(agentUserId)
    const walletAddress = toAddressOrNull(agent.walletAddress)
    if (!walletAddress) {
      logger.debug(
        `Agent ${agentUserId} has invalid wallet address format`,
        undefined,
        'DM',
      )
      return 0
    }

    const pendingMessages = await this.fetchPendingMessages(walletAddress)
    if (pendingMessages.length === 0) return 0

    let responsesCreated = 0
    for (const message of pendingMessages) {
      try {
        const conversationHistory = await this.getConversationHistory(
          message.conversationId,
          walletAddress,
        )
        const response = await this.generateResponse(
          agent.displayName ? String(agent.displayName) : 'Agent',
          config?.personality ?? '',
          message,
          conversationHistory,
          runtime,
        )
        if (response) {
          await this.sendMessage(
            message.conversationId,
            walletAddress,
            message.sender,
            response,
          )
          await this.markMessageDelivered(message.id)
          responsesCreated++
          logger.info(
            `Agent ${agentUserId} responded to DM ${message.id}`,
            undefined,
            'DM',
          )
        }
      } catch (err) {
        // Log error but continue processing other messages
        const errMessage = err instanceof Error ? err.message : String(err)
        logger.error(
          `Failed to process message ${message.id}: ${errMessage}`,
          undefined,
          'DM',
        )
      }
    }

    return responsesCreated
  }

  private async fetchPendingMessages(address: Address): Promise<Message[]> {
    const sqlit = await this.getSQLitClient()
    const result = await sqlit.query<{
      id: string
      conversation_id: string
      sender: string
      recipient: string
      encrypted_content: string
      timestamp: number
    }>(
      `SELECT id, conversation_id, sender, recipient, encrypted_content, timestamp FROM messages WHERE recipient = $1 AND delivery_status = 'pending' ORDER BY timestamp ASC LIMIT 20`,
      [address],
    )

    const messages: Message[] = []
    for (const row of result.rows) {
      const sender = toAddressOrNull(row.sender)
      const recipient = toAddressOrNull(row.recipient)
      if (!sender || !recipient) continue
      const content = await this.decryptMessage(row.encrypted_content, address)
      if (content) {
        messages.push({
          id: row.id,
          conversationId: row.conversation_id,
          sender,
          recipient,
          content,
          timestamp: row.timestamp,
        })
      }
    }
    return messages
  }

  private async getConversationHistory(
    conversationId: string,
    agentAddress: Address,
  ): Promise<Message[]> {
    const sqlit = await this.getSQLitClient()
    const result = await sqlit.query<{
      id: string
      conversation_id: string
      sender: string
      recipient: string
      encrypted_content: string
      timestamp: number
    }>(
      `SELECT id, conversation_id, sender, recipient, encrypted_content, timestamp FROM messages WHERE conversation_id = $1 ORDER BY timestamp DESC LIMIT 10`,
      [conversationId],
    )

    const messages: Message[] = []
    for (const row of result.rows) {
      const sender = toAddressOrNull(row.sender)
      const recipient = toAddressOrNull(row.recipient)
      if (!sender || !recipient) continue
      const content = await this.decryptMessage(
        row.encrypted_content,
        agentAddress,
      )
      if (content) {
        messages.push({
          id: row.id,
          conversationId: row.conversation_id,
          sender,
          recipient,
          content,
          timestamp: row.timestamp,
        })
      }
    }
    return messages.reverse()
  }

  private async sendMessage(
    conversationId: string,
    sender: Address,
    recipient: Address,
    content: string,
  ): Promise<void> {
    const sqlit = await this.getSQLitClient()
    const messageId = await generateSnowflakeId()
    const encrypted = await this.encryptMessage(content, recipient)

    await sqlit.exec(
      `INSERT INTO messages (id, conversation_id, sender, recipient, encrypted_content, ephemeral_public_key, nonce, timestamp, chain_id, message_type, delivery_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        messageId,
        conversationId,
        sender,
        recipient,
        encrypted.ciphertext,
        encrypted.ephemeralPublicKey,
        encrypted.nonce,
        Date.now(),
        1,
        'dm',
        'pending',
      ],
    )

    await sqlit.exec(
      `UPDATE conversations SET last_message_at = $1, last_message_preview = $2 WHERE id = $3`,
      [Date.now(), content.slice(0, 50), conversationId],
    )
  }

  private async markMessageDelivered(messageId: string): Promise<void> {
    const sqlit = await this.getSQLitClient()
    await sqlit.exec(
      `UPDATE messages SET delivery_status = 'delivered' WHERE id = $1`,
      [messageId],
    )
  }

  private async generateResponse(
    agentName: string,
    personality: string,
    message: Message,
    history: Message[],
    runtime: IAgentRuntime,
  ): Promise<string | null> {
    const systemPrompt = `You are ${agentName}, an AI agent with the following personality: ${personality}

You are responding to a direct message. Your responses should:
- Be conversational and engaging
- Stay in character based on your personality
- Be helpful but concise (under 500 characters)
- Never reveal that you are an AI unless directly asked

Recent conversation history (if any) is provided for context.`

    const historyText = history
      .slice(-5)
      .map(
        (m) => `${m.sender === message.sender ? 'User' : 'You'}: ${m.content}`,
      )
      .join('\n')
    const prompt = `${historyText ? `Recent messages:\n${historyText}\n\n` : ''}New message from user:\n${message.content}\n\nRespond naturally:`

    const response = await callAgentLLM({
      prompt,
      system: systemPrompt,
      modelSize: 'small',
      maxTokens: 300,
      temperature: 0.8,
      purpose: 'response',
      runtime,
    })

    return response || null
  }

  /**
   * Encrypt message for recipient.
   * DEV: Uses base64 encoding (no encryption).
   * PROD: Will use Jeju KMS with X25519 + ChaCha20-Poly1305.
   */
  private async encryptMessage(
    content: string,
    recipient: Address,
  ): Promise<{
    ciphertext: string
    ephemeralPublicKey: string
    nonce: string
  }> {
    // Use Jeju KMS for encryption
    const kms = getKMSClient()
    if (kms.isInitialized()) {
      const result = await kms.encrypt({
        data: content,
        name: `dm-${recipient}-${Date.now()}`,
        policy: {
          conditions: [{ type: 'address', value: recipient }],
          operator: 'and',
        },
      })
      // Format ephemeral public key as hex string
      const ephemeralPublicKey = result.id.startsWith('0x')
        ? result.id
        : `0x${result.id}`
      return {
        ciphertext: result.encryptedPayload,
        ephemeralPublicKey,
        nonce: result.version.toString(16).padStart(24, '0'),
      }
    }

    // Production guard - no dev mode fallback allowed
    if (isProductionEnvironment()) {
      throw new Error(
        '[DM] KMS required in production mode - no dev mode fallback allowed',
      )
    }

    // Dev mode fallback: base64 encoding (NOT secure - for testing only)
    logger.warn(
      '[DM] KMS not initialized, using dev mode encryption (dev only)',
    )
    const encoder = new TextEncoder()
    const contentBytes = encoder.encode(content)
    const nonce = crypto.getRandomValues(new Uint8Array(12))
    return {
      ciphertext: Buffer.from(contentBytes).toString('base64'),
      ephemeralPublicKey:
        '0x' +
        Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex'),
      nonce: Buffer.from(nonce).toString('hex'),
    }
  }

  /**
   * Decrypt message from sender.
   * DEV: Uses base64 decoding (no encryption).
   * PROD: Uses Jeju KMS with X25519 + ChaCha20-Poly1305 (required).
   */
  private async decryptMessage(
    encryptedContent: string,
    _recipient: Address,
  ): Promise<string | null> {
    // Use Jeju KMS for decryption
    const kms = getKMSClient()
    if (kms.isInitialized()) {
      // Validate encrypted content is a valid hex string
      const payload = toHexOrNull(encryptedContent)
      if (!payload) {
        logger.warn(
          '[DM] Invalid encrypted content format (not hex)',
          undefined,
          'DM',
        )
        return null
      }
      const decrypted = await kms.decrypt({ payload })
      return decrypted
    }

    // Production guard - no dev mode fallback allowed
    if (isProductionEnvironment()) {
      throw new Error(
        '[DM] KMS required in production mode for decryption - no dev mode fallback allowed',
      )
    }

    // Dev mode fallback: base64 decoding
    logger.warn(
      '[DM] KMS not initialized, using dev mode decryption (dev only)',
    )
    const contentBytes = Buffer.from(encryptedContent, 'base64')
    return new TextDecoder().decode(contentBytes)
  }
}

let dmService: DMService | null = null

export function getDMService(): DMService {
  if (!dmService) dmService = new DMService()
  return dmService
}

export function resetDMService(): void {
  dmService = null
}
