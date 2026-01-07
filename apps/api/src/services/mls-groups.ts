/**
 * MLS Groups Service
 *
 * Provides MLS (Message Layer Security) group chat functionality.
 * - End-to-end encrypted group messaging
 * - Forward secrecy with key rotation
 * - On-chain key registry for public keys
 */

import {
  and,
  chatAdmins,
  chatParticipants,
  chats,
  db,
  eq,
  inArray,
  messages,
  users,
} from '@babylon/db'
import { logger } from '@babylon/shared'
import {
  createMLSClient,
  type GroupConfig,
  type GroupInvite,
  type GroupMember,
  type JejuGroup,
  type JejuMLSClient,
  type MLSClientConfig,
  type MLSMessage,
} from '@jejunetwork/messaging'
import { generateSnowflakeId } from '@jejunetwork/shared'
import type { Address, Hex } from 'viem'

// Environment configuration
const JEJU_RPC_URL = process.env.JEJU_RPC_URL ?? 'http://localhost:8545'
const JEJU_RELAY_URL = process.env.JEJU_RELAY_URL ?? 'http://localhost:3200'
const KEY_REGISTRY_ADDRESS =
  process.env.KEY_REGISTRY_ADDRESS ??
  '0x0000000000000000000000000000000000000000'
const MLS_ENABLED = process.env.MLS_ENABLED === 'true'

// Client instances per user (keyed by userId)
const mlsClients = new Map<string, JejuMLSClient>()

// User signature cache (in production, use secure storage)
const userSignatures = new Map<string, Hex>()

/**
 * Check if MLS is enabled
 */
export function isMLSEnabled(): boolean {
  return MLS_ENABLED
}

/**
 * Store user signature for later client initialization
 */
export function storeUserSignature(userId: string, signature: Hex): void {
  userSignatures.set(userId, signature)
}

/**
 * Check if a chat is an MLS encrypted group
 */
export async function isMLSGroup(chatId: string): Promise<boolean> {
  const [chat] = await db
    .select({ metadata: chats.metadata })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)

  if (!chat) return false

  const metadata = chat.metadata as { encryptionType?: string } | null
  return metadata?.encryptionType === 'mls'
}

/**
 * Get encryption status for a group
 */
export async function getGroupEncryptionStatus(chatId: string): Promise<{
  isEncrypted: boolean
  encryptionType: string | null
}> {
  const [chat] = await db
    .select({ metadata: chats.metadata, isGroup: chats.isGroup })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)

  if (!chat) {
    throw new Error(`Chat ${chatId} not found`)
  }

  const metadata = chat.metadata as { encryptionType?: string } | null

  if (metadata?.encryptionType === 'mls') {
    return { isEncrypted: true, encryptionType: 'mls' }
  }

  return { isEncrypted: false, encryptionType: null }
}

/**
 * Get or create an MLS client for a user
 * THROWS if MLS is disabled or prerequisites are missing
 */
async function getOrCreateMLSClient(userId: string): Promise<JejuMLSClient> {
  if (!MLS_ENABLED) {
    throw new Error('MLS is not enabled - set MLS_ENABLED=true')
  }

  const existingClient = mlsClients.get(userId)
  if (existingClient?.getState().isInitialized) {
    return existingClient
  }

  // Get user's wallet address
  const [user] = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user?.walletAddress) {
    throw new Error(
      `User ${userId} has no wallet address - cannot initialize MLS client`,
    )
  }

  // Get stored signature
  const signature = userSignatures.get(userId)
  if (!signature) {
    throw new Error(
      `No signature stored for user ${userId} - call storeUserSignature first`,
    )
  }

  const config: MLSClientConfig = {
    address: user.walletAddress as Address,
    keyRegistryAddress: KEY_REGISTRY_ADDRESS as Address,
    relayUrl: JEJU_RELAY_URL,
    rpcUrl: JEJU_RPC_URL,
    network: process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet',
    skipRelayConnection: process.env.NODE_ENV === 'test',
  }

  const client = createMLSClient(config)
  await client.initialize(signature)

  mlsClients.set(userId, client)
  logger.info(
    'MLS client initialized',
    { userId, address: user.walletAddress },
    'MLSGroupService',
  )

  return client
}

/**
 * Create an MLS encrypted group chat
 * Creates BOTH the actual MLS group AND local DB entries
 * THROWS on failure - no silent fallbacks
 */
export async function createMLSGroup(
  creatorUserId: string,
  name: string,
  memberUserIds: string[],
): Promise<{ groupId: string; memberAddresses: Address[] }> {
  if (!MLS_ENABLED) {
    throw new Error('MLS is not enabled - set MLS_ENABLED=true')
  }

  // Get MLS client (throws if not available)
  const client = await getOrCreateMLSClient(creatorUserId)

  // Get creator's wallet address
  const [creator] = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, creatorUserId))
    .limit(1)

  if (!creator?.walletAddress) {
    throw new Error('Creator has no wallet address')
  }

  // Get member wallet addresses
  const memberUsers = await db
    .select({ id: users.id, walletAddress: users.walletAddress })
    .from(users)
    .where(inArray(users.id, memberUserIds))

  const memberAddresses: Address[] = memberUsers
    .filter((u) => u.walletAddress)
    .map((u) => u.walletAddress as Address)

  // Ensure creator is included
  const creatorAddress = creator.walletAddress as Address
  if (!memberAddresses.includes(creatorAddress)) {
    memberAddresses.push(creatorAddress)
  }

  // Create the ACTUAL MLS group on the protocol
  const mlsGroupConfig: GroupConfig = {
    name,
    members: memberAddresses,
    admins: [creatorAddress],
  }

  const group = await client.createGroup(mlsGroupConfig)
  const groupState = group.getState()
  const groupId = groupState.id

  // Create local DB entries (for indexing/caching)
  await db.insert(chats).values({
    id: groupId,
    name,
    type: 'group',
    isGroup: true,
    createdBy: creatorUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      encryptionType: 'mls',
      memberAddresses,
      mlsGroupId: groupId,
    },
  })

  // Add creator as participant
  const creatorParticipantId = await generateSnowflakeId()
  await db.insert(chatParticipants).values({
    id: creatorParticipantId,
    chatId: groupId,
    userId: creatorUserId,
    isActive: true,
    joinedAt: new Date(),
  })

  // Add other participants
  for (const memberUser of memberUsers) {
    if (memberUser.id !== creatorUserId) {
      const pId = await generateSnowflakeId()
      await db.insert(chatParticipants).values({
        id: pId,
        chatId: groupId,
        userId: memberUser.id,
        isActive: true,
        joinedAt: new Date(),
      })
    }
  }

  // Add creator as admin
  const adminId = await generateSnowflakeId()
  await db.insert(chatAdmins).values({
    id: adminId,
    chatId: groupId,
    userId: creatorUserId,
  })

  logger.info(
    'MLS group created',
    {
      groupId,
      creatorId: creatorUserId,
      memberCount: memberAddresses.length,
    },
    'MLSGroupService',
  )

  return { groupId, memberAddresses }
}

/**
 * Send a message to an MLS group
 * ACTUALLY encrypts and sends via MLS protocol
 * THROWS on failure - no silent fallbacks
 */
export async function sendMLSMessage(
  senderUserId: string,
  chatId: string,
  content: string,
): Promise<{ messageId: string; mlsMessageId: string }> {
  // Get MLS client (throws if not available)
  const client = await getOrCreateMLSClient(senderUserId)

  const group = client.getGroup(chatId)
  if (!group) {
    throw new Error(
      `Group ${chatId} not found or user ${senderUserId} is not a member`,
    )
  }

  // Send via MLS protocol FIRST
  const mlsMessageId = await group.send(content)

  // Only AFTER successful MLS send, store in local DB
  const messageId = await generateSnowflakeId()
  const now = new Date()

  await db.insert(messages).values({
    id: messageId,
    chatId,
    senderId: senderUserId,
    content,
    createdAt: now,
    metadata: {
      isEncrypted: true,
      encryptionType: 'mls',
      status: 'sent',
      mlsMessageId,
    },
  })

  await db.update(chats).set({ updatedAt: now }).where(eq(chats.id, chatId))

  logger.info(
    'MLS message sent',
    { chatId, senderUserId, messageId, mlsMessageId },
    'MLSGroupService',
  )

  return { messageId, mlsMessageId }
}

/**
 * Add a member to an MLS group
 * THROWS on failure - no silent fallbacks
 */
export async function addMLSGroupMember(
  adminUserId: string,
  chatId: string,
  newMemberUserId: string,
): Promise<void> {
  // Check if admin
  const [adminStatus] = await db
    .select()
    .from(chatAdmins)
    .where(
      and(eq(chatAdmins.chatId, chatId), eq(chatAdmins.userId, adminUserId)),
    )
    .limit(1)

  if (!adminStatus) {
    throw new Error('Only admins can add members')
  }

  // Check if new member exists and has wallet
  const [newMember] = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, newMemberUserId))
    .limit(1)

  if (!newMember?.walletAddress) {
    throw new Error('New member has no wallet address')
  }

  // Get MLS client (throws if not available)
  const client = await getOrCreateMLSClient(adminUserId)

  const group = client.getGroup(chatId)
  if (!group) {
    throw new Error(`Group ${chatId} not found or admin is not a member`)
  }

  // Add to MLS group FIRST
  await group.addMembers([newMember.walletAddress as Address])

  // Only AFTER successful MLS add, update local DB
  const participantId = await generateSnowflakeId()
  await db.insert(chatParticipants).values({
    id: participantId,
    chatId,
    userId: newMemberUserId,
    isActive: true,
    joinedAt: new Date(),
    addedBy: adminUserId,
  })

  logger.info(
    'MLS group member added',
    { chatId, adminUserId, newMemberUserId },
    'MLSGroupService',
  )
}

/**
 * Create an MLS encrypted group chat (full API with client reuse)
 */
export async function createMLSGroupFull(
  creatorId: string,
  creatorWallet: Address,
  signature: Hex,
  groupConfig: {
    name: string
    description?: string
    imageUrl?: string
    memberUserIds: string[]
  },
): Promise<{
  groupId: string
  group: JejuGroup
  memberAddresses: Address[]
}> {
  storeUserSignature(creatorId, signature)

  // Use getOrCreateMLSClient for client reuse
  const client = await getOrCreateMLSClient(creatorId)

  // Resolve member wallet addresses from user IDs
  const memberUsers = await db
    .select({ id: users.id, walletAddress: users.walletAddress })
    .from(users)
    .where(inArray(users.id, groupConfig.memberUserIds))

  const memberAddresses: Address[] = memberUsers
    .filter((u) => u.walletAddress)
    .map((u) => u.walletAddress as Address)

  // Ensure creator is included
  if (!memberAddresses.includes(creatorWallet)) {
    memberAddresses.push(creatorWallet)
  }

  // Create MLS group
  const mlsGroupConfig: GroupConfig = {
    name: groupConfig.name,
    description: groupConfig.description,
    imageUrl: groupConfig.imageUrl,
    members: memberAddresses,
    admins: [creatorWallet],
  }

  const group = await client.createGroup(mlsGroupConfig)
  const groupState = group.getState()

  logger.info(
    'MLS group created (full)',
    {
      groupId: groupState.id,
      creatorId,
      memberCount: memberAddresses.length,
    },
    'MLSGroupService',
  )

  return {
    groupId: groupState.id,
    group,
    memberAddresses,
  }
}

/**
 * Get an existing MLS group
 */
export async function getMLSGroup(
  userId: string,
  signature: Hex,
  groupId: string,
): Promise<JejuGroup> {
  storeUserSignature(userId, signature)
  const client = await getOrCreateMLSClient(userId)
  const group = client.getGroup(groupId)
  if (!group) throw new Error(`Group ${groupId} not found or user not a member`)
  return group
}

/**
 * List all MLS groups for a user
 */
export async function listMLSGroups(
  userId: string,
  signature: Hex,
): Promise<JejuGroup[]> {
  storeUserSignature(userId, signature)
  const client = await getOrCreateMLSClient(userId)
  return client.listGroups()
}

/**
 * Send a message to an MLS group (full API)
 */
export async function sendMLSGroupMessageFull(
  userId: string,
  signature: Hex,
  groupId: string,
  content: string,
  options?: {
    contentType?: string
    replyTo?: string
    metadata?: Record<string, string>
  },
): Promise<{ messageId: string }> {
  storeUserSignature(userId, signature)
  const client = await getOrCreateMLSClient(userId)
  const group = client.getGroup(groupId)
  if (!group) throw new Error(`Group ${groupId} not found or user not a member`)

  const messageId = await group.send(content, options)
  logger.info(
    'MLS message sent',
    { groupId, userId, messageId },
    'MLSGroupService',
  )
  return { messageId }
}

/**
 * Get messages from an MLS group
 */
export async function getMLSGroupMessages(
  userId: string,
  signature: Hex,
  groupId: string,
  options?: { limit?: number; after?: string; before?: string },
): Promise<MLSMessage[]> {
  storeUserSignature(userId, signature)
  const client = await getOrCreateMLSClient(userId)
  const group = client.getGroup(groupId)
  if (!group) throw new Error(`Group ${groupId} not found or user not a member`)
  return group.getMessages({
    limit: options?.limit ?? 50,
    after: options?.after,
    before: options?.before,
  })
}

/**
 * Get members of an MLS group
 */
export async function getMLSGroupMembers(
  userId: string,
  signature: Hex,
  groupId: string,
): Promise<GroupMember[]> {
  storeUserSignature(userId, signature)
  const client = await getOrCreateMLSClient(userId)
  const group = client.getGroup(groupId)
  if (!group) throw new Error(`Group ${groupId} not found or user not a member`)
  return group.getMembers()
}

/**
 * Create an invite for an MLS group
 */
export async function createMLSGroupInvite(
  adminUserId: string,
  signature: Hex,
  groupId: string,
): Promise<GroupInvite> {
  storeUserSignature(adminUserId, signature)
  const client = await getOrCreateMLSClient(adminUserId)
  const group = client.getGroup(groupId)
  if (!group) throw new Error(`Group ${groupId} not found or user not a member`)

  const invite = await group.createInvite()
  logger.info('MLS invite created', { groupId, adminUserId }, 'MLSGroupService')
  return invite
}

/**
 * Accept an MLS group invite
 */
export async function acceptMLSGroupInvite(
  userId: string,
  signature: Hex,
  groupId: string,
  inviteCode: string,
): Promise<JejuGroup> {
  storeUserSignature(userId, signature)
  const client = await getOrCreateMLSClient(userId)
  const group = await client.joinGroup(groupId, inviteCode)
  logger.info('MLS invite accepted', { groupId, userId }, 'MLSGroupService')
  return group
}

/**
 * Leave an MLS group
 */
export async function leaveMLSGroup(
  userId: string,
  signature: Hex,
  groupId: string,
): Promise<void> {
  storeUserSignature(userId, signature)
  const client = await getOrCreateMLSClient(userId)
  await client.leaveGroup(groupId)
  logger.info('Left MLS group', { groupId, userId }, 'MLSGroupService')
}

/**
 * Subscribe to MLS group messages
 */
export function subscribeToMLSMessages(
  userId: string,
  handler: (message: MLSMessage, groupId: string) => void,
): () => void {
  const client = mlsClients.get(userId)
  if (!client) {
    throw new Error(
      'MLS client not initialized for user. Initialize client first.',
    )
  }

  const wrappedHandler = (event: {
    type: string
    groupId: string
    message?: MLSMessage
  }) => {
    if (event.type === 'message' && event.message) {
      handler(event.message, event.groupId)
    }
  }

  client.on('message', wrappedHandler)

  return () => {
    client.off('message', wrappedHandler)
  }
}

/**
 * Sync all MLS groups for a user
 */
export async function syncMLSGroups(
  userId: string,
  signature: Hex,
): Promise<{ newMessages: number; groupsSynced: number; errors: string[] }> {
  storeUserSignature(userId, signature)
  const client = await getOrCreateMLSClient(userId)
  const result = await client.sync()
  logger.info(
    'MLS sync completed',
    {
      userId,
      newMessages: result.newMessages,
      groupsSynced: result.groupsSynced,
    },
    'MLSGroupService',
  )
  return result
}

/**
 * Shutdown MLS client for a user
 */
export async function shutdownMLSClient(userId: string): Promise<void> {
  const client = mlsClients.get(userId)
  if (!client) return
  await client.shutdown()
  mlsClients.delete(userId)
  logger.info('MLS client shutdown', { userId }, 'MLSGroupService')
}
