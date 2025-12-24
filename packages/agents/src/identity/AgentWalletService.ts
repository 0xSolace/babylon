/**
 * Agent Wallet Service
 *
 * Handles agent wallet creation and on-chain registration with zero user interaction.
 * Uses Jeju KMS for key management (MPC/TEE-backed) and OAuth3 for identity.
 * NO FALLBACKS to centralized key management.
 *
 * @packageDocumentation
 */

import { db, type JsonValue } from '@babylon/db'
import { toNull } from '@babylon/shared'
import { v4 as uuidv4 } from 'uuid'
import { getAddress, keccak256 } from 'viem'
import { getAgent0Client } from '../agent0/Agent0Client'
import { getAgentConfig } from '../shared/agent-config'
import { logger } from '../shared/logger'

// ============================================================================
// KMS Client Types
// ============================================================================

import { getKMSClient, initializeKMS, type KMSClient } from '@babylon/api'

let kmsClient: KMSClient | null = null

async function getKMS(): Promise<KMSClient> {
  if (kmsClient?.isInitialized()) return kmsClient

  const kms = getKMSClient()
  if (!kms.isInitialized()) {
    await initializeKMS()
  }
  kmsClient = kms
  return kmsClient
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
    walletAddress: string
    kmsKeyId: string
  }> {
    const agent = await db.user.findUnique({ where: { id: agentUserId } })

    if (!agent || !agent.isAgent) {
      throw new Error('Agent user not found')
    }

    // Check if agent already has a wallet address
    const existingWalletAddress = agent.walletAddress
      ? String(agent.walletAddress)
      : null
    if (existingWalletAddress) {
      logger.info(
        'Agent already has wallet address, skipping creation',
        {
          agentUserId,
          walletAddress: existingWalletAddress,
        },
        'AgentWalletService',
      )

      const existingKmsKeyId = agent.kmsKeyId
        ? String(agent.kmsKeyId)
        : `agent_${agentUserId}`
      return {
        walletAddress: existingWalletAddress,
        kmsKeyId: existingKmsKeyId,
      }
    }

    logger.info(
      `Creating KMS-backed wallet for agent ${agentUserId}`,
      undefined,
      'AgentWalletService',
    )

    // Step 1: Generate key via Jeju KMS (MPC/TEE-backed)
    const kms = await getKMS()
    const keyName = `agent_${agentUserId}_${Date.now()}`
    const { keyId: kmsKeyId, publicKey } = await kms.generateKey(keyName)

    // Derive wallet address from public key (Ethereum: keccak256 of uncompressed pubkey, take last 20 bytes)
    const addressHash = keccak256(publicKey)
    const walletAddress = getAddress(`0x${addressHash.slice(-40)}`)

    // Step 2: Update agent user with wallet info
    await db.user.update({
      where: { id: agentUserId },
      data: {
        walletAddress,
        kmsKeyId,
        // OAuth3 identity reference for KMS-backed wallets
        oauth3Id: `kms:${kmsKeyId}`,
      },
    })

    // Step 3: Log wallet creation
    await db.agentLog.create({
      data: {
        id: uuidv4(),
        agentUserId,
        type: 'system',
        level: 'info',
        content: `KMS wallet created: ${walletAddress}`,
        metadata: {
          kmsKeyId,
          walletAddress,
          provider: 'jeju-kms',
        } as JsonValue,
      },
    })

    logger.info(
      `KMS wallet created for agent ${agentUserId}: ${walletAddress}`,
      undefined,
      'AgentWalletService',
    )

    return { walletAddress, kmsKeyId }
  }

  /**
   * Register agent on ERC-8004 identity registry (server-side signing, gas handled)
   */
  async registerAgentOnChain(agentUserId: string): Promise<{
    tokenId: number
    txHash: string
    metadataCID?: string
  }> {
    logger.info(
      `Registering agent ${agentUserId} on-chain`,
      undefined,
      'AgentWalletService',
    )

    const agent = await db.user.findUnique({ where: { id: agentUserId } })

    if (!agent || !agent.isAgent) {
      throw new Error('Agent user not found')
    }

    const agentWalletAddress = agent.walletAddress
      ? String(agent.walletAddress)
      : null
    if (!agentWalletAddress) {
      throw new Error('Agent must have wallet before on-chain registration')
    }

    // Get agent config for capabilities
    const config = await getAgentConfig(agentUserId)

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
    }

    // Step 2: Register via Agent0Client (handles signing and gas server-side)
    const agent0Client = getAgent0Client()

    // Use individual agent's A2A endpoint
    const BABYLON_API_PORT = process.env.BABYLON_API_PORT ?? '5009'
    const baseUrl =
      process.env.PUBLIC_APP_URL ?? `http://localhost:${BABYLON_API_PORT}`
    const individualAgentA2AEndpoint = `${baseUrl}/api/agents/${agentUserId}/a2a`

    const agentDisplayName = agent.displayName
      ? String(agent.displayName)
      : null
    const agentUsername = agent.username ? String(agent.username) : null
    const agentBio = agent.bio ? String(agent.bio) : null
    const agentProfileImageUrl = agent.profileImageUrl
      ? String(agent.profileImageUrl)
      : null

    const registration = await agent0Client.registerAgent({
      name: agentDisplayName ?? agentUsername ?? 'Agent',
      description: agentBio ?? 'Autonomous AI agent in Babylon',
      imageUrl: agentProfileImageUrl,
      walletAddress: agentWalletAddress,
      a2aEndpoint: individualAgentA2AEndpoint,
      capabilities,
    })

    // Step 3: Update agent with on-chain data
    await db.user.update({
      where: { id: agentUserId },
      data: {
        agent0TokenId: registration.tokenId,
        agent0MetadataCID: toNull(registration.metadataCID),
        registrationTxHash: registration.txHash,
        onChainRegistered: true,
      },
    })

    // Step 4: Log registration
    await db.agentLog.create({
      data: {
        id: uuidv4(),
        agentUserId,
        type: 'system',
        level: 'info',
        content: `Agent registered on-chain: Token ID ${registration.tokenId}`,
        metadata: {
          tokenId: registration.tokenId,
          txHash: registration.txHash,
          metadataCID: registration.metadataCID,
        } as JsonValue,
      },
    })

    logger.info(
      `Agent ${agentUserId} registered on-chain: Token ID ${registration.tokenId}`,
      undefined,
      'AgentWalletService',
    )

    return {
      tokenId: registration.tokenId,
      txHash: registration.txHash,
      metadataCID: registration.metadataCID,
    }
  }

  /**
   * Complete setup: Create wallet + register on-chain (fully automated)
   */
  async setupAgentIdentity(agentUserId: string): Promise<{
    walletAddress: string
    tokenId?: number
    onChainRegistered: boolean
  }> {
    logger.info(
      `Setting up complete identity for agent ${agentUserId}`,
      undefined,
      'AgentWalletService',
    )

    // Step 1: Create KMS-backed wallet
    const wallet = await this.createAgentEmbeddedWallet(agentUserId)

    // Step 2: Register on-chain
    const registration = await this.registerAgentOnChain(agentUserId)

    return {
      walletAddress: wallet.walletAddress,
      tokenId: registration.tokenId,
      onChainRegistered: true,
    }
  }

  /**
   * Sign transaction for agent (via Jeju KMS)
   */
  async signTransaction(
    agentUserId: string,
    transactionData: {
      to: string
      value: string
      data: string
    },
  ): Promise<string> {
    const agent = await db.user.findUnique({ where: { id: agentUserId } })

    if (!agent || !agent.isAgent) {
      throw new Error('Agent not found')
    }

    // Get KMS key ID from kmsKeyId field or oauth3Id (for backwards compatibility)
    const agentKmsKeyId = agent.kmsKeyId ? String(agent.kmsKeyId) : null
    const agentOauth3Id = agent.oauth3Id ? String(agent.oauth3Id) : null

    let keyId = agentKmsKeyId
    if (!keyId && agentOauth3Id?.startsWith('kms:')) {
      keyId = agentOauth3Id.replace('kms:', '')
    }

    if (!keyId) {
      throw new Error('Agent does not have KMS wallet')
    }

    // Sign via Jeju KMS
    const kms = await getKMS()
    const messageToSign = JSON.stringify(transactionData)
    // Convert string to hex bytes
    const messageBytes = new TextEncoder().encode(messageToSign)
    const hexContent = Array.from(messageBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    // Template literal creates properly typed hex string
    const messageHex: `0x${string}` = `0x${hexContent}`
    const result = await kms.sign({
      message: messageHex,
      keyId,
    })

    logger.info(
      `Transaction signed for agent ${agentUserId}`,
      undefined,
      'AgentWalletService',
    )

    return result.signature
  }

  /**
   * Verify agent has valid on-chain identity
   */
  async verifyOnChainIdentity(agentUserId: string): Promise<boolean> {
    const agent = await db.user.findUnique({ where: { id: agentUserId } })

    if (!agent || !agent.isAgent || !agent.agent0TokenId) {
      return false
    }

    // Verify with Agent0 network
    const agent0Client = getAgent0Client()
    const tokenId = Number(agent.agent0TokenId)
    const profile = await agent0Client.getAgentProfile(tokenId)

    return profile !== null
  }
}

export const agentWalletService = new AgentWalletService()
