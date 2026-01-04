/**
 * Real XMTP Messaging Service
 *
 * Uses the official @xmtp/node-sdk with Jeju KMS for secure signing.
 * - End-to-end encryption via MLS (Message Layer Security)
 * - Compatible with all XMTP clients (MetaMask, Coinbase, etc.)
 * - Private keys never leave KMS (MPC threshold signing)
 */

import { db, eq, messages, users } from '@babylon/db'
import { logger } from '@babylon/shared'
import {
  XMTPClient,
  type XMTPClientOptions as ClientOptions,
  type XMTPDm as Dm,
  type XMTPGroup as Group,
  type XMTPSigner,
  type XMTPIdentifier as Identifier,
  type IdentifierKind,
  type XMTPDecodedMessage as DecodedMessage,
} from '@jejunetwork/messaging'
import { createKMSSigner, type KMSSigner } from '@jejunetwork/kms'
import { getXMTPConfig, type XMTPEnv } from '@jejunetwork/config'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { toBytes, toHex, type Address, type Hex } from 'viem'
import { createHash, randomBytes } from 'crypto'

// XMTP is always enabled - configuration from packages/config
const xmtpConfig = getXMTPConfig()
const XMTP_ENV: XMTPEnv = xmtpConfig.env
const XMTP_DB_PATH = xmtpConfig.dbPath

// Client instances per user (keyed by wallet address)
// Note: XMTP SDK has complex generics - using 'any' for map storage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const xmtpClients = new Map<string, any>()
const kmsSigsners = new Map<string, KMSSigner>()

/**
 * Check if XMTP is enabled - always true (configured via packages/config)
 */
export function isXMTPEnabled(): boolean {
  return true
}

/**
 * Store a user's signature for XMTP
 * Note: With KMS-based signing, signatures are generated on-demand,
 * so this is a no-op for compatibility with older code patterns.
 */
export function storeUserSignature(_userId: string, _signature: `0x${string}`): void {
  // KMS generates signatures on-demand, nothing to store
}

/**
 * Generate a deterministic DB encryption key from KMS
 * This key encrypts the local XMTP database
 */
async function getDbEncryptionKey(kmsSigner: KMSSigner): Promise<Uint8Array> {
  // Sign a deterministic message to derive encryption key
  const result = await kmsSigner.signMessage('XMTP_DB_ENCRYPTION_KEY_V1')
  // Use first 32 bytes of signature hash as encryption key
  const hash = createHash('sha256').update(toBytes(result.signature)).digest()
  return new Uint8Array(hash)
}

/**
 * Create an XMTP-compatible signer that uses Jeju KMS
 * Private keys NEVER leave the KMS enclave
 */
function createXMTPKMSSigner(kmsSigner: KMSSigner, address: Address): XMTPSigner {
  return {
    type: 'EOA',

    getIdentifier: (): Identifier => ({
      identifier: address.toLowerCase(),
      identifierKind: 0 as IdentifierKind, // Ethereum
    }),

    signMessage: async (message: string): Promise<Uint8Array> => {
      // Sign using Jeju KMS (MPC/TEE) - private key never exposed
      const result = await kmsSigner.signMessage(message)
      // XMTP expects raw signature bytes (65 bytes: r + s + v)
      return toBytes(result.signature)
    },
  }
}

/**
 * Get or create KMS signer for a user
 */
async function getOrCreateKMSSigner(userId: string): Promise<KMSSigner> {
  const existing = kmsSigsners.get(userId)
  if (existing) return existing

  const signer = createKMSSigner({
    serviceId: `xmtp-user-${userId}`,
    allowLocalDev: true, // Allow local dev mode for testing
  })
  await signer.initialize()

  kmsSigsners.set(userId, signer)
  return signer
}

/**
 * Get user wallet address from database
 */
async function getUserWallet(userId: string): Promise<Address> {
  const [user] = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user?.walletAddress) {
    throw new Error(`User ${userId} has no wallet address`)
  }

  return user.walletAddress as Address
}

/**
 * Get or create an XMTP client for a user
 * Uses KMS for all signing operations
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrCreateXMTPClient(userId: string): Promise<any> {
  const walletAddress = await getUserWallet(userId)
  const clientKey = walletAddress.toLowerCase()

  const existingClient = xmtpClients.get(clientKey)
  if (existingClient) {
    return existingClient
  }

  // Get KMS signer for this user
  const kmsSigner = await getOrCreateKMSSigner(userId)

  // Create XMTP-compatible signer wrapper
  const xmtpSigner = createXMTPKMSSigner(kmsSigner, walletAddress)

  // Generate deterministic DB encryption key from KMS
  const dbEncryptionKey = await getDbEncryptionKey(kmsSigner)

  // Create XMTP client options
  const options: ClientOptions = {
    env: XMTP_ENV,
    dbPath: `${XMTP_DB_PATH}/${clientKey}.db3`,
    dbEncryptionKey,
  }

  // Create real XMTP client
  const client = await XMTPClient.create(xmtpSigner, options)

  xmtpClients.set(clientKey, client)
  logger.info(
    'XMTP client created',
    { userId, address: walletAddress, inboxId: client.inboxId },
    'XMTPService',
  )

  return client
}

/**
 * Send an encrypted direct message via XMTP
 * Messages are end-to-end encrypted using MLS
 */
export async function sendEncryptedDM(
  senderUserId: string,
  recipientUserId: string,
  content: string,
): Promise<{ messageId: string; xmtpMessageId: string; conversationId: string }> {
  // Get recipient's wallet address
  const recipientWallet = await getUserWallet(recipientUserId)

  // Get XMTP client for sender
  const client = await getOrCreateXMTPClient(senderUserId)

  // Find or create DM conversation with recipient
  const dm = await client.conversations.newDmWithIdentifier({
    identifier: recipientWallet.toLowerCase(),
    identifierKind: 0 as IdentifierKind,
  })

  // Send encrypted message via XMTP network
  const xmtpMessageId = await dm.send(content)

  // Store in local DB for quick access
  const messageId = await generateSnowflakeId()
  const now = new Date()

  await db.insert(messages).values({
    id: messageId,
    chatId: `dm-${[senderUserId, recipientUserId].sort().join('-')}`,
    senderId: senderUserId,
    content,
    createdAt: now,
    metadata: {
      isEncrypted: true,
      encryptionType: 'xmtp-mls',
      xmtpMessageId,
      xmtpConversationId: dm.id,
      status: 'sent',
    },
  })

  logger.info(
    'XMTP DM sent',
    {
      senderUserId,
      recipientUserId,
      messageId,
      xmtpMessageId,
      conversationId: dm.id,
    },
    'XMTPService',
  )

  return {
    messageId,
    xmtpMessageId,
    conversationId: dm.id,
  }
}

/**
 * Create an XMTP group chat
 */
export async function createXMTPGroup(
  creatorUserId: string,
  participantUserIds: string[],
  name: string,
  description?: string,
): Promise<{ groupId: string; xmtpGroupId: string }> {
  const client = await getOrCreateXMTPClient(creatorUserId)

  // Get wallet addresses for all participants
  const participantIdentifiers: Identifier[] = await Promise.all(
    participantUserIds.map(async (userId) => {
      const wallet = await getUserWallet(userId)
      return {
        identifier: wallet.toLowerCase(),
        identifierKind: 0 as IdentifierKind,
      }
    }),
  )

  // Create group on XMTP network
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const group = await client.conversations.newGroupWithIdentifiers(
    participantIdentifiers,
    {
      groupName: name,
      groupDescription: description ?? '',
    } as any,
  )

  const groupId = await generateSnowflakeId()

  logger.info(
    'XMTP group created',
    {
      creatorUserId,
      groupId,
      xmtpGroupId: group.id,
      participantCount: participantUserIds.length,
    },
    'XMTPService',
  )

  return {
    groupId,
    xmtpGroupId: group.id,
  }
}

/**
 * Send a message to an XMTP group
 */
export async function sendXMTPGroupMessage(
  senderUserId: string,
  xmtpGroupId: string,
  content: string,
): Promise<{ messageId: string; xmtpMessageId: string }> {
  const client = await getOrCreateXMTPClient(senderUserId)

  // Get the group conversation
  const conversation = await client.conversations.getConversationById(xmtpGroupId)
  if (!conversation) {
    throw new Error(`XMTP group ${xmtpGroupId} not found`)
  }

  // Send message
  const xmtpMessageId = await conversation.send(content)

  // Store locally
  const messageId = await generateSnowflakeId()
  await db.insert(messages).values({
    id: messageId,
    chatId: xmtpGroupId,
    senderId: senderUserId,
    content,
    createdAt: new Date(),
    metadata: {
      isEncrypted: true,
      encryptionType: 'xmtp-mls',
      xmtpMessageId,
      xmtpConversationId: xmtpGroupId,
      status: 'sent',
    },
  })

  logger.info(
    'XMTP group message sent',
    { senderUserId, xmtpGroupId, messageId, xmtpMessageId },
    'XMTPService',
  )

  return { messageId, xmtpMessageId }
}

/**
 * Add member to XMTP group
 */
export async function addXMTPGroupMember(
  adminUserId: string,
  xmtpGroupId: string,
  newMemberUserId: string,
): Promise<void> {
  const client = await getOrCreateXMTPClient(adminUserId)
  const conversation = await client.conversations.getConversationById(xmtpGroupId)

  if (!conversation || !('addMembersByIdentifiers' in conversation)) {
    throw new Error(`XMTP group ${xmtpGroupId} not found or not a group`)
  }

  const newMemberWallet = await getUserWallet(newMemberUserId)
  const group = conversation as Group

  await group.addMembersByIdentifiers([
    {
      identifier: newMemberWallet.toLowerCase(),
      identifierKind: 0 as IdentifierKind,
    },
  ])

  logger.info(
    'XMTP group member added',
    { adminUserId, xmtpGroupId, newMemberUserId },
    'XMTPService',
  )
}

/**
 * Remove member from XMTP group
 */
export async function removeXMTPGroupMember(
  adminUserId: string,
  xmtpGroupId: string,
  memberUserId: string,
): Promise<void> {
  const client = await getOrCreateXMTPClient(adminUserId)
  const conversation = await client.conversations.getConversationById(xmtpGroupId)

  if (!conversation || !('removeMembersByIdentifiers' in conversation)) {
    throw new Error(`XMTP group ${xmtpGroupId} not found or not a group`)
  }

  const memberWallet = await getUserWallet(memberUserId)
  const group = conversation as Group

  await group.removeMembersByIdentifiers([
    {
      identifier: memberWallet.toLowerCase(),
      identifierKind: 0 as IdentifierKind,
    },
  ])

  logger.info(
    'XMTP group member removed',
    { adminUserId, xmtpGroupId, memberUserId },
    'XMTPService',
  )
}

/**
 * Get messages from an XMTP conversation
 */
export async function getXMTPMessages(
  userId: string,
  conversationId: string,
  limit = 50,
): Promise<DecodedMessage[]> {
  const client = await getOrCreateXMTPClient(userId)
  const conversation = await client.conversations.getConversationById(conversationId)

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`)
  }

  // Sync to get latest messages
  await conversation.sync()

  return conversation.messages({ limit })
}

/**
 * List all XMTP conversations for a user
 */
export async function listXMTPConversations(
  userId: string,
): Promise<{ dms: Dm[]; groups: Group[] }> {
  const client = await getOrCreateXMTPClient(userId)

  // Sync to get latest conversations
  await client.conversations.sync()

  const dms = client.conversations.listDms()
  const groups = client.conversations.listGroups()

  return { dms, groups }
}

/**
 * Stream incoming messages for a user
 * Returns an async iterable of decoded messages
 */
export async function streamXMTPMessages(
  userId: string,
  onMessage: (message: DecodedMessage) => void,
): Promise<() => Promise<void>> {
  const client = await getOrCreateXMTPClient(userId)

  const stream = await client.conversations.streamAllMessages({
    onValue: onMessage,
  })

  // Return cleanup function
  return async () => {
    await stream.return()
  }
}

/**
 * Get messaging status for a user
 */
export async function getMessagingStatus(userId: string): Promise<{
  xmtpEnabled: boolean
  hasClient: boolean
  inboxId: string | null
  walletAddress: string | null
  environment: string
}> {
  const [user] = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const walletAddress = user?.walletAddress ?? null
  const clientKey = walletAddress?.toLowerCase()
  const client = clientKey ? xmtpClients.get(clientKey) : undefined

  return {
    xmtpEnabled: true, // Always enabled
    hasClient: !!client,
    inboxId: client?.inboxId ?? null,
    walletAddress,
    environment: XMTP_ENV,
  }
}

/**
 * Check if a wallet can receive XMTP messages
 */
export async function canMessage(
  userId: string,
  targetWallet: Address,
): Promise<boolean> {
  const client = await getOrCreateXMTPClient(userId)

  const result = await client.canMessage([
    {
      identifier: targetWallet.toLowerCase(),
      identifierKind: 0 as IdentifierKind,
    },
  ])

  return result.get(targetWallet.toLowerCase()) ?? false
}

/**
 * Get XMTP client inbox ID for a user
 */
export async function getInboxId(userId: string): Promise<string> {
  const client = await getOrCreateXMTPClient(userId)
  return client.inboxId
}

/**
 * Shutdown XMTP client for a user (cleanup)
 */
export async function shutdownXMTPClient(userId: string): Promise<void> {
  const walletAddress = await getUserWallet(userId)
  const clientKey = walletAddress.toLowerCase()

  xmtpClients.delete(clientKey)
  kmsSigsners.delete(userId)

  logger.info('XMTP client shutdown', { userId }, 'XMTPService')
}

/**
 * Shutdown all XMTP clients (for server shutdown)
 */
export function shutdownAllXMTPClients(): void {
  xmtpClients.clear()
  kmsSigsners.clear()
  logger.info('All XMTP clients shutdown', {}, 'XMTPService')
}
