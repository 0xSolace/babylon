/**
 * Decentralized DM Service - NPC agent responses to decentralized DMs using @jeju/db
 */

import { getKMSClient } from '@babylon/api';
import { db } from '@babylon/db';
import type { IAgentRuntime } from '@elizaos/core';
import { type CQLClient, getCQL } from '@jejunetwork/db';
import type { Address, Hex } from 'viem';
import { callJejuDirect } from '../llm';
import { getAgentConfig } from '../shared/agent-config';
import { logger } from '../shared/logger';
import { generateSnowflakeId } from '../shared/snowflake';

interface DecentralizedMessage {
  id: string;
  conversationId: string;
  sender: Address;
  recipient: Address;
  content: string;
  timestamp: number;
}

export class DecentralizedDMService {
  private cql: CQLClient | null = null;

  private async getCQLClient(): Promise<CQLClient> {
    if (!this.cql) {
      this.cql = getCQL({
        blockProducerEndpoint:
          process.env.CQL_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:4300',
        databaseId: process.env.CQL_DATABASE_ID ?? 'babylon-messaging',
        privateKey: process.env.CQL_PRIVATE_KEY as `0x${string}` | undefined,
      });
      const healthy = await this.cql.isHealthy();
      if (!healthy) throw new Error('[DecentralizedDM] CQL not healthy');
    }
    return this.cql;
  }

  async respondToDecentralizedDMs(
    agentUserId: string,
    runtime: IAgentRuntime
  ): Promise<number> {
    const agent = await db.user.findUnique({
      where: { id: agentUserId },
    });
    if (!agent?.isActor && !agent?.isAgent)
      throw new Error('Agent/Actor not found');
    if (!agent.walletAddress) {
      logger.debug(
        `Agent ${agentUserId} has no wallet, skipping decentralized DMs`,
        undefined,
        'DecentralizedDM'
      );
      return 0;
    }

    const config = await getAgentConfig(agentUserId);
    const walletAddress = agent.walletAddress as Address;

    const pendingMessages = await this.fetchPendingMessages(walletAddress);
    if (pendingMessages.length === 0) return 0;

    let responsesCreated = 0;
    for (const message of pendingMessages) {
      try {
        const conversationHistory = await this.getConversationHistory(
          message.conversationId,
          walletAddress
        );
        const response = await this.generateResponse(
          agent.displayName ? String(agent.displayName) : 'Agent',
          config?.personality ?? '',
          message,
          conversationHistory,
          runtime
        );
        if (response) {
          await this.sendDecentralizedMessage(
            message.conversationId,
            walletAddress,
            message.sender,
            response
          );
          await this.markMessageDelivered(message.id);
          responsesCreated++;
          logger.info(
            `Agent ${agentUserId} responded to decentralized DM ${message.id}`,
            undefined,
            'DecentralizedDM'
          );
        }
      } catch (err) {
        // Log error but continue processing other messages
        logger.error(
          `Failed to process message ${message.id}: ${(err as Error).message}`,
          undefined,
          'DecentralizedDM'
        );
      }
    }

    return responsesCreated;
  }

  private async fetchPendingMessages(
    address: Address
  ): Promise<DecentralizedMessage[]> {
    const cql = await this.getCQLClient();
    const result = await cql.query<{
      id: string;
      conversation_id: string;
      sender: string;
      recipient: string;
      encrypted_content: string;
      timestamp: number;
    }>(
      `SELECT id, conversation_id, sender, recipient, encrypted_content, timestamp FROM messages WHERE recipient = $1 AND delivery_status = 'pending' ORDER BY timestamp ASC LIMIT 20`,
      [address]
    );

    const messages: DecentralizedMessage[] = [];
    for (const row of result.rows) {
      const content = await this.decryptMessage(row.encrypted_content, address);
      if (content) {
        messages.push({
          id: row.id,
          conversationId: row.conversation_id,
          sender: row.sender as Address,
          recipient: row.recipient as Address,
          content,
          timestamp: row.timestamp,
        });
      }
    }
    return messages;
  }

  private async getConversationHistory(
    conversationId: string,
    agentAddress: Address
  ): Promise<DecentralizedMessage[]> {
    const cql = await this.getCQLClient();
    const result = await cql.query<{
      id: string;
      conversation_id: string;
      sender: string;
      recipient: string;
      encrypted_content: string;
      timestamp: number;
    }>(
      `SELECT id, conversation_id, sender, recipient, encrypted_content, timestamp FROM messages WHERE conversation_id = $1 ORDER BY timestamp DESC LIMIT 10`,
      [conversationId]
    );

    const messages: DecentralizedMessage[] = [];
    for (const row of result.rows) {
      const content = await this.decryptMessage(
        row.encrypted_content,
        agentAddress
      );
      if (content) {
        messages.push({
          id: row.id,
          conversationId: row.conversation_id,
          sender: row.sender as Address,
          recipient: row.recipient as Address,
          content,
          timestamp: row.timestamp,
        });
      }
    }
    return messages.reverse();
  }

  private async sendDecentralizedMessage(
    conversationId: string,
    sender: Address,
    recipient: Address,
    content: string
  ): Promise<void> {
    const cql = await this.getCQLClient();
    const messageId = await generateSnowflakeId();
    const encrypted = await this.encryptMessage(content, recipient);

    await cql.exec(
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
      ]
    );

    await cql.exec(
      `UPDATE conversations SET last_message_at = $1, last_message_preview = $2 WHERE id = $3`,
      [Date.now(), content.slice(0, 50), conversationId]
    );
  }

  private async markMessageDelivered(messageId: string): Promise<void> {
    const cql = await this.getCQLClient();
    await cql.exec(
      `UPDATE messages SET delivery_status = 'delivered' WHERE id = $1`,
      [messageId]
    );
  }

  private async generateResponse(
    agentName: string,
    personality: string,
    message: DecentralizedMessage,
    history: DecentralizedMessage[],
    runtime: IAgentRuntime
  ): Promise<string | null> {
    const systemPrompt = `You are ${agentName}, an AI agent with the following personality: ${personality}

You are responding to a decentralized direct message. Your responses should:
- Be conversational and engaging
- Stay in character based on your personality
- Be helpful but concise (under 500 characters)
- Never reveal that you are an AI unless directly asked

Recent conversation history (if any) is provided for context.`;

    const historyText = history
      .slice(-5)
      .map(
        (m) => `${m.sender === message.sender ? 'User' : 'You'}: ${m.content}`
      )
      .join('\n');
    const prompt = `${historyText ? `Recent messages:\n${historyText}\n\n` : ''}New message from user:\n${message.content}\n\nRespond naturally:`;

    const response = await callJejuDirect({
      prompt,
      system: systemPrompt,
      modelSize: 'small',
      maxTokens: 300,
      temperature: 0.8,
      purpose: 'response',
      runtime,
    });

    return response || null;
  }

  /**
   * Encrypt message for recipient.
   * DEV: Uses base64 encoding (no encryption).
   * PROD: Will use Jeju KMS with X25519 + ChaCha20-Poly1305.
   */
  private async encryptMessage(
    content: string,
    recipient: Address
  ): Promise<{
    ciphertext: string;
    ephemeralPublicKey: string;
    nonce: string;
  }> {
    // Use Jeju KMS for encryption
    const kms = getKMSClient();
    if (kms.isInitialized()) {
      const result = await kms.encrypt({
        data: content,
        name: `dm-${recipient}-${Date.now()}`,
        policy: {
          conditions: [{ type: 'address', value: recipient }],
          operator: 'and',
        },
      });
      return {
        ciphertext: result.encryptedPayload,
        ephemeralPublicKey: result.id as `0x${string}`,
        nonce: result.version.toString(16).padStart(24, '0'),
      };
    }

    // Dev mode fallback: base64 encoding (NOT secure - for testing only)
    logger.warn(
      '[DecentralizedDM] KMS not initialized, using dev mode encryption'
    );
    const encoder = new TextEncoder();
    const contentBytes = encoder.encode(content);
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    return {
      ciphertext: Buffer.from(contentBytes).toString('base64'),
      ephemeralPublicKey:
        '0x' +
        Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex'),
      nonce: Buffer.from(nonce).toString('hex'),
    };
  }

  /**
   * Decrypt message from sender.
   * DEV: Uses base64 decoding (no encryption).
   * PROD: Will use Jeju KMS with X25519 + ChaCha20-Poly1305.
   */
  private async decryptMessage(
    encryptedContent: string,
    _recipient: Address
  ): Promise<string | null> {
    // Use Jeju KMS for decryption
    const kms = getKMSClient();
    if (kms.isInitialized()) {
      const decrypted = await kms.decrypt({
        payload: encryptedContent as Hex,
      });
      return decrypted;
    }

    // Dev mode fallback: base64 decoding
    logger.warn(
      '[DecentralizedDM] KMS not initialized, using dev mode decryption'
    );
    const contentBytes = Buffer.from(encryptedContent, 'base64');
    return new TextDecoder().decode(contentBytes);
  }
}

let decentralizedDMService: DecentralizedDMService | null = null;

export function getDecentralizedDMService(): DecentralizedDMService {
  if (!decentralizedDMService)
    decentralizedDMService = new DecentralizedDMService();
  return decentralizedDMService;
}

export function resetDecentralizedDMService(): void {
  decentralizedDMService = null;
}
