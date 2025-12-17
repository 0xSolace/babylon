/**
 * Agent Wallet Service
 *
 * Handles agent wallet creation and on-chain registration with zero user interaction.
 * Uses Jeju KMS for key management (MPC/TEE-backed) and OAuth3 for identity.
 * NO FALLBACKS to Privy or centralized key management.
 *
 * @packageDocumentation
 */

import { agentLogs, db, eq, type JsonValue, users } from '@babylon/db';
import { v4 as uuidv4 } from 'uuid';
import { getAddress, keccak256 } from 'viem';
import { getAgent0Client } from '../agent0/Agent0Client';
import { getAgentConfig } from '../shared/agent-config';
import { logger } from '../shared/logger';

// ============================================================================
// KMS Client Types
// ============================================================================

import type { KMSClient } from '@babylon/api';

let kmsClient: KMSClient | null = null;

async function getKMS(): Promise<KMSClient> {
  if (kmsClient?.isInitialized()) return kmsClient;

  const { getKMSClient, initializeKMS } = await import('@babylon/api');
  const kms = getKMSClient();
  if (!kms.isInitialized()) {
    await initializeKMS();
  }
  kmsClient = kms;
  return kmsClient;
}

// ============================================================================
// Agent Wallet Service
// ============================================================================

export class AgentWalletService {
  /**
   * Create embedded wallet for agent via Jeju KMS (decentralized key management)
   * Keys are managed via MPC/TEE - no single party has full key access.
   */
  async createAgentEmbeddedWallet(agentUserId: string): Promise<{
    walletAddress: string;
    kmsKeyId: string;
  }> {
    const [agent] = await db
      .select()
      .from(users)
      .where(eq(users.id, agentUserId))
      .limit(1);

    if (!agent || !agent.isAgent) {
      throw new Error('Agent user not found');
    }

    // Check if agent already has a wallet address
    if (agent.walletAddress) {
      logger.info(
        'Agent already has wallet address, skipping creation',
        {
          agentUserId,
          walletAddress: agent.walletAddress,
        },
        'AgentWalletService'
      );

      return {
        walletAddress: agent.walletAddress,
        kmsKeyId: agent.kmsKeyId ?? `agent_${agentUserId}`,
      };
    }

    logger.info(
      `Creating KMS-backed wallet for agent ${agentUserId}`,
      undefined,
      'AgentWalletService'
    );

    // Step 1: Generate key via Jeju KMS (MPC/TEE-backed)
    const kms = await getKMS();
    const keyName = `agent_${agentUserId}_${Date.now()}`;
    const { keyId: kmsKeyId, publicKey } = await kms.generateKey(keyName);

    // Derive wallet address from public key (Ethereum: keccak256 of uncompressed pubkey, take last 20 bytes)
    const addressHash = keccak256(publicKey);
    const walletAddress = getAddress(`0x${addressHash.slice(-40)}`);

    // Step 2: Update agent user with wallet info
    await db
      .update(users)
      .set({
        walletAddress,
        kmsKeyId,
        // Legacy field for compatibility
        privyId: `kms:${kmsKeyId}`,
      })
      .where(eq(users.id, agentUserId));

    // Step 3: Log wallet creation
    await db.insert(agentLogs).values({
      id: uuidv4(),
      agentUserId,
      type: 'system',
      level: 'info',
      message: `KMS wallet created: ${walletAddress}`,
      metadata: {
        kmsKeyId,
        walletAddress,
        provider: 'jeju-kms',
      },
    });

    logger.info(
      `KMS wallet created for agent ${agentUserId}: ${walletAddress}`,
      undefined,
      'AgentWalletService'
    );

    return { walletAddress, kmsKeyId };
  }

  /**
   * Register agent on ERC-8004 identity registry (server-side signing, gas handled)
   */
  async registerAgentOnChain(agentUserId: string): Promise<{
    tokenId: number;
    txHash: string;
    metadataCID?: string;
  }> {
    logger.info(
      `Registering agent ${agentUserId} on-chain`,
      undefined,
      'AgentWalletService'
    );

    const [agent] = await db
      .select()
      .from(users)
      .where(eq(users.id, agentUserId))
      .limit(1);

    if (!agent || !agent.isAgent) {
      throw new Error('Agent user not found');
    }

    if (!agent.walletAddress) {
      throw new Error('Agent must have wallet before on-chain registration');
    }

    // Get agent config for capabilities
    const config = await getAgentConfig(agentUserId);

    // Step 1: Prepare agent metadata
    const capabilities = {
      strategies: config?.tradingStrategy
        ? ['autonomous-trading', 'prediction-markets', 'social-interaction']
        : ['chat', 'analysis'],
      markets: ['prediction', 'perp', 'crypto'],
      actions: [
        'trade',
        'analyze',
        'chat',
        'post',
        'comment',
        'moderation-escrow',
        'appeal-ban',
      ],
      version: '1.0.0',
      platform: 'babylon',
      userType: 'agent',
      x402Support: true,
      moderationEscrowSupport: true,
      autonomousTrading: config?.autonomousTrading ?? false,
      autonomousPosting: config?.autonomousPosting ?? false,
      skills: [],
      domains: [],
    };

    // Step 2: Register via Agent0Client (handles signing and gas server-side)
    const agent0Client = getAgent0Client();

    // Use individual agent's A2A endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5007';
    const individualAgentA2AEndpoint = `${baseUrl}/api/agents/${agentUserId}/a2a`;

    const registration = await agent0Client.registerAgent({
      name: agent.displayName ?? agent.username ?? 'Agent',
      description: agent.bio ?? 'Autonomous AI agent in Babylon',
      imageUrl: agent.profileImageUrl ?? undefined,
      walletAddress: agent.walletAddress,
      a2aEndpoint: individualAgentA2AEndpoint,
      capabilities,
    });

    // Step 3: Update agent with on-chain data
    await db
      .update(users)
      .set({
        agent0TokenId: registration.tokenId,
        agent0MetadataCID: registration.metadataCID ?? null,
        registrationTxHash: registration.txHash,
        onChainRegistered: true,
      })
      .where(eq(users.id, agentUserId));

    // Step 4: Log registration
    await db.insert(agentLogs).values({
      id: uuidv4(),
      agentUserId,
      type: 'system',
      level: 'info',
      message: `Agent registered on-chain: Token ID ${registration.tokenId}`,
      metadata: {
        tokenId: registration.tokenId,
        txHash: registration.txHash,
        metadataCID: registration.metadataCID,
      } as JsonValue,
    });

    logger.info(
      `Agent ${agentUserId} registered on-chain: Token ID ${registration.tokenId}`,
      undefined,
      'AgentWalletService'
    );

    return {
      tokenId: registration.tokenId,
      txHash: registration.txHash,
      metadataCID: registration.metadataCID,
    };
  }

  /**
   * Complete setup: Create wallet + register on-chain (fully automated)
   */
  async setupAgentIdentity(agentUserId: string): Promise<{
    walletAddress: string;
    tokenId?: number;
    onChainRegistered: boolean;
  }> {
    logger.info(
      `Setting up complete identity for agent ${agentUserId}`,
      undefined,
      'AgentWalletService'
    );

    // Step 1: Create KMS-backed wallet
    const wallet = await this.createAgentEmbeddedWallet(agentUserId);

    // Step 2: Register on-chain
    const registration = await this.registerAgentOnChain(agentUserId);

    return {
      walletAddress: wallet.walletAddress,
      tokenId: registration.tokenId,
      onChainRegistered: true,
    };
  }

  /**
   * Sign transaction for agent (via Jeju KMS)
   */
  async signTransaction(
    agentUserId: string,
    transactionData: {
      to: string;
      value: string;
      data: string;
    }
  ): Promise<string> {
    const [agent] = await db
      .select({
        id: users.id,
        isAgent: users.isAgent,
        kmsKeyId: users.kmsKeyId,
        oauth3Id: users.oauth3Id,
      })
      .from(users)
      .where(eq(users.id, agentUserId))
      .limit(1);

    if (!agent || !agent.isAgent) {
      throw new Error('Agent not found');
    }

    // Get KMS key ID from kmsKeyId field or oauth3Id (for backwards compatibility)
    let keyId = agent.kmsKeyId;
    if (!keyId && agent.oauth3Id?.startsWith('kms:')) {
      keyId = agent.oauth3Id.replace('kms:', '');
    }

    if (!keyId) {
      throw new Error('Agent does not have KMS wallet');
    }

    // Sign via Jeju KMS
    const kms = await getKMS();
    const messageToSign = JSON.stringify(transactionData);
    // Convert string to hex bytes
    const messageBytes = new TextEncoder().encode(messageToSign);
    const messageHex = `0x${Array.from(messageBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}` as `0x${string}`;
    const result = await kms.sign({
      message: messageHex,
      keyId,
    });

    logger.info(
      `Transaction signed for agent ${agentUserId}`,
      undefined,
      'AgentWalletService'
    );

    return result.signature;
  }

  /**
   * Verify agent has valid on-chain identity
   */
  async verifyOnChainIdentity(agentUserId: string): Promise<boolean> {
    const [agent] = await db
      .select()
      .from(users)
      .where(eq(users.id, agentUserId))
      .limit(1);

    if (!agent || !agent.isAgent || !agent.agent0TokenId) {
      return false;
    }

    // Verify with Agent0 network
    const agent0Client = getAgent0Client();
    const profile = await agent0Client.getAgentProfile(agent.agent0TokenId);

    return profile !== null;
  }
}

export const agentWalletService = new AgentWalletService();
