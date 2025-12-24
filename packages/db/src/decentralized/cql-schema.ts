/**
 * CovenantSQL Schema Definitions
 *
 * Pure TypeScript schema definitions for CovenantSQL.
 * All schemas defined statically.
 */

import type { CQLColumn, CQLTableSchema } from './types'

/** Map type names to CQL types */
const TYPE_MAP: Record<string, CQLColumn['type']> = {
  text: 'TEXT',
  integer: 'INTEGER',
  bigint: 'BIGINT',
  boolean: 'BOOLEAN',
  timestamp: 'TIMESTAMP',
  decimal: 'DECIMAL',
  doublePrecision: 'DOUBLE',
  json: 'JSON',
  jsonb: 'JSON',
}

/** Generate CREATE TABLE SQL from schema */
export function generateCreateTableSQL(schema: CQLTableSchema): string {
  const columnDefs = schema.columns.map((col) => {
    let def = `"${col.name}" ${col.type}`

    if (col.type === 'DECIMAL' && col.precision && col.scale) {
      def = `"${col.name}" DECIMAL(${col.precision}, ${col.scale})`
    }

    if (!col.nullable) def += ' NOT NULL'
    if (col.default !== undefined) {
      if (col.default === null) {
        def += ' DEFAULT NULL'
      } else if (typeof col.default === 'string') {
        if (col.default === 'NOW()' || col.default === 'CURRENT_TIMESTAMP') {
          def += ' DEFAULT CURRENT_TIMESTAMP'
        } else {
          def += ` DEFAULT '${col.default}'`
        }
      } else if (typeof col.default === 'boolean') {
        def += ` DEFAULT ${col.default ? 'TRUE' : 'FALSE'}`
      } else {
        def += ` DEFAULT ${col.default}`
      }
    }
    if (col.unique && !col.primaryKey) def += ' UNIQUE'

    return def
  })

  const constraints: string[] = []

  if (schema.primaryKey.length > 0) {
    constraints.push(
      `PRIMARY KEY (${schema.primaryKey.map((k) => `"${k}"`).join(', ')})`,
    )
  }

  for (const uc of schema.uniqueConstraints ?? []) {
    constraints.push(
      `CONSTRAINT "${uc.name}" UNIQUE (${uc.columns.map((c) => `"${c}"`).join(', ')})`,
    )
  }

  const allDefs = [...columnDefs, ...constraints]

  return `CREATE TABLE IF NOT EXISTS "${schema.name}" (\n  ${allDefs.join(',\n  ')}\n)`
}

/** Generate CREATE INDEX SQL statements */
export function generateIndexSQL(schema: CQLTableSchema): string[] {
  return (schema.indexes ?? []).map((idx) => {
    const unique = idx.unique ? 'UNIQUE ' : ''
    const columns = idx.columns.map((c) => `"${c}"`).join(', ')
    return `CREATE ${unique}INDEX IF NOT EXISTS "${idx.name}" ON "${schema.name}" (${columns})`
  })
}

/** Babylon tables for CovenantSQL. */
export const BABYLON_SCHEMAS = [
  // Users
  {
    name: 'User',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'walletAddress', type: 'TEXT', nullable: true, unique: true },
      { name: 'username', type: 'TEXT', nullable: true, unique: true },
      { name: 'displayName', type: 'TEXT', nullable: true },
      { name: 'bio', type: 'TEXT', nullable: true },
      { name: 'profileImageUrl', type: 'TEXT', nullable: true },
      { name: 'isActor', type: 'BOOLEAN', nullable: false, default: false },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      { name: 'updatedAt', type: 'TIMESTAMP', nullable: false },
      { name: 'personality', type: 'TEXT', nullable: true },
      { name: 'postStyle', type: 'TEXT', nullable: true },
      { name: 'postExample', type: 'TEXT', nullable: true },
      {
        name: 'virtualBalance',
        type: 'DECIMAL',
        nullable: false,
        default: '1000',
        precision: 18,
        scale: 2,
      },
      {
        name: 'totalDeposited',
        type: 'DECIMAL',
        nullable: false,
        default: '1000',
        precision: 18,
        scale: 2,
      },
      {
        name: 'totalWithdrawn',
        type: 'DECIMAL',
        nullable: false,
        default: '0',
        precision: 18,
        scale: 2,
      },
      {
        name: 'lifetimePnL',
        type: 'DECIMAL',
        nullable: false,
        default: '0',
        precision: 18,
        scale: 2,
      },
      {
        name: 'profileComplete',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'hasProfileImage',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      { name: 'hasUsername', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'hasBio', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'profileSetupCompletedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'farcasterUsername', type: 'TEXT', nullable: true },
      {
        name: 'hasFarcaster',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      { name: 'hasTwitter', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'hasDiscord', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'nftTokenId', type: 'INTEGER', nullable: true, unique: true },
      {
        name: 'onChainRegistered',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForFarcaster',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForFarcasterFollow',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForProfile',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForProfileImage',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForTwitter',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForTwitterFollow',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForDiscord',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForDiscordJoin',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForUsername',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForWallet',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForReferralBonus',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForShare',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForPrivateGroup',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'pointsAwardedForPrivateChannel',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      { name: 'referralCode', type: 'TEXT', nullable: true, unique: true },
      { name: 'referralCount', type: 'INTEGER', nullable: false, default: 0 },
      { name: 'referredBy', type: 'TEXT', nullable: true },
      { name: 'registrationIpHash', type: 'TEXT', nullable: true },
      { name: 'lastReferralIpHash', type: 'TEXT', nullable: true },
      { name: 'registrationTxHash', type: 'TEXT', nullable: true },
      {
        name: 'reputationPoints',
        type: 'INTEGER',
        nullable: false,
        default: 1000,
      },
      { name: 'twitterUsername', type: 'TEXT', nullable: true },
      {
        name: 'bannerDismissCount',
        type: 'INTEGER',
        nullable: false,
        default: 0,
      },
      { name: 'bannerLastShown', type: 'TIMESTAMP', nullable: true },
      { name: 'coverImageUrl', type: 'TEXT', nullable: true },
      {
        name: 'showFarcasterPublic',
        type: 'BOOLEAN',
        nullable: false,
        default: true,
      },
      {
        name: 'showTwitterPublic',
        type: 'BOOLEAN',
        nullable: false,
        default: true,
      },
      {
        name: 'showWalletPublic',
        type: 'BOOLEAN',
        nullable: false,
        default: true,
      },
      { name: 'usernameChangedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'agent0FeedbackCount', type: 'INTEGER', nullable: true },
      { name: 'agent0MetadataCID', type: 'TEXT', nullable: true },
      { name: 'agent0RegisteredAt', type: 'TIMESTAMP', nullable: true },
      { name: 'agent0TokenId', type: 'INTEGER', nullable: true },
      { name: 'agent0TrustScore', type: 'DOUBLE', nullable: true },
      { name: 'bannedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'bannedBy', type: 'TEXT', nullable: true },
      { name: 'bannedReason', type: 'TEXT', nullable: true },
      { name: 'farcasterDisplayName', type: 'TEXT', nullable: true },
      { name: 'farcasterFid', type: 'TEXT', nullable: true, unique: true },
      { name: 'farcasterPfpUrl', type: 'TEXT', nullable: true },
      { name: 'farcasterVerifiedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'isAdmin', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'isBanned', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'isScammer', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'isCSAM', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'appealCount', type: 'INTEGER', nullable: false, default: 0 },
      {
        name: 'appealStaked',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'appealStakeAmount',
        type: 'DECIMAL',
        nullable: true,
        precision: 18,
        scale: 2,
      },
      { name: 'appealStakeTxHash', type: 'TEXT', nullable: true },
      { name: 'appealStatus', type: 'TEXT', nullable: true },
      { name: 'appealSubmittedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'appealReviewedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'falsePositiveHistory', type: 'JSON', nullable: true },
      { name: 'privyId', type: 'TEXT', nullable: true, unique: true },
      { name: 'oauth3Id', type: 'TEXT', nullable: true, unique: true },
      { name: 'kmsKeyId', type: 'TEXT', nullable: true, unique: true },
      { name: 'registrationBlockNumber', type: 'BIGINT', nullable: true },
      { name: 'registrationGasUsed', type: 'BIGINT', nullable: true },
      { name: 'registrationTimestamp', type: 'TIMESTAMP', nullable: true },
      { name: 'role', type: 'TEXT', nullable: true },
      {
        name: 'totalFeesEarned',
        type: 'DECIMAL',
        nullable: false,
        default: '0',
        precision: 18,
        scale: 2,
      },
      {
        name: 'totalFeesPaid',
        type: 'DECIMAL',
        nullable: false,
        default: '0',
        precision: 18,
        scale: 2,
      },
      { name: 'twitterAccessToken', type: 'TEXT', nullable: true },
      { name: 'twitterId', type: 'TEXT', nullable: true, unique: true },
      { name: 'twitterRefreshToken', type: 'TEXT', nullable: true },
      { name: 'twitterTokenExpiresAt', type: 'TIMESTAMP', nullable: true },
      { name: 'twitterVerifiedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'discordId', type: 'TEXT', nullable: true, unique: true },
      { name: 'discordUsername', type: 'TEXT', nullable: true },
      { name: 'discordAccessToken', type: 'TEXT', nullable: true },
      { name: 'discordRefreshToken', type: 'TEXT', nullable: true },
      { name: 'discordTokenExpiresAt', type: 'TIMESTAMP', nullable: true },
      { name: 'discordVerifiedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'tosAccepted', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'tosAcceptedAt', type: 'TIMESTAMP', nullable: true },
      {
        name: 'tosAcceptedVersion',
        type: 'TEXT',
        nullable: true,
        default: '2025-11-11',
      },
      {
        name: 'privacyPolicyAccepted',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      { name: 'privacyPolicyAcceptedAt', type: 'TIMESTAMP', nullable: true },
      {
        name: 'privacyPolicyAcceptedVersion',
        type: 'TEXT',
        nullable: true,
        default: '2025-11-11',
      },
      { name: 'invitePoints', type: 'INTEGER', nullable: false, default: 0 },
      { name: 'earnedPoints', type: 'INTEGER', nullable: false, default: 0 },
      { name: 'bonusPoints', type: 'INTEGER', nullable: false, default: 0 },
      { name: 'waitlistPosition', type: 'INTEGER', nullable: true },
      { name: 'waitlistJoinedAt', type: 'TIMESTAMP', nullable: true },
      {
        name: 'isWaitlistActive',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      { name: 'isTest', type: 'BOOLEAN', nullable: false, default: false },
      {
        name: 'pointsAwardedForEmail',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      {
        name: 'emailVerified',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      { name: 'email', type: 'TEXT', nullable: true },
      { name: 'waitlistGraduatedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'isAgent', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'managedBy', type: 'TEXT', nullable: true },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'User_displayName_idx', columns: ['displayName'] },
      { name: 'User_earnedPoints_idx', columns: ['earnedPoints'] },
      { name: 'User_invitePoints_idx', columns: ['invitePoints'] },
      { name: 'User_isActor_idx', columns: ['isActor'] },
      { name: 'User_isAgent_idx', columns: ['isAgent'] },
      { name: 'User_isAgent_managedBy_idx', columns: ['isAgent', 'managedBy'] },
      { name: 'User_isBanned_isActor_idx', columns: ['isBanned', 'isActor'] },
      { name: 'User_isScammer_idx', columns: ['isScammer'] },
      { name: 'User_isCSAM_idx', columns: ['isCSAM'] },
      { name: 'User_managedBy_idx', columns: ['managedBy'] },
      {
        name: 'User_profileComplete_createdAt_idx',
        columns: ['profileComplete', 'createdAt'],
      },
      { name: 'User_referralCode_idx', columns: ['referralCode'] },
      { name: 'User_reputationPoints_idx', columns: ['reputationPoints'] },
      { name: 'User_username_idx', columns: ['username'] },
      { name: 'User_waitlistJoinedAt_idx', columns: ['waitlistJoinedAt'] },
      { name: 'User_waitlistPosition_idx', columns: ['waitlistPosition'] },
      { name: 'User_walletAddress_idx', columns: ['walletAddress'] },
      { name: 'User_registrationIpHash_idx', columns: ['registrationIpHash'] },
      { name: 'User_lastReferralIpHash_idx', columns: ['lastReferralIpHash'] },
    ],
    uniqueConstraints: [],
  },

  // Markets
  {
    name: 'Market',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'question', type: 'TEXT', nullable: false },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'gameId', type: 'TEXT', nullable: true },
      { name: 'dayNumber', type: 'INTEGER', nullable: true },
      {
        name: 'yesShares',
        type: 'DECIMAL',
        nullable: false,
        default: '0',
        precision: 18,
        scale: 6,
      },
      {
        name: 'noShares',
        type: 'DECIMAL',
        nullable: false,
        default: '0',
        precision: 18,
        scale: 6,
      },
      {
        name: 'liquidity',
        type: 'DECIMAL',
        nullable: false,
        precision: 18,
        scale: 6,
      },
      { name: 'resolved', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'resolution', type: 'BOOLEAN', nullable: true },
      { name: 'endDate', type: 'TIMESTAMP', nullable: false },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      { name: 'updatedAt', type: 'TIMESTAMP', nullable: false },
      { name: 'onChainMarketId', type: 'TEXT', nullable: true },
      {
        name: 'onChainResolved',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'Market_createdAt_idx', columns: ['createdAt'] },
      { name: 'Market_gameId_idx', columns: ['gameId'] },
      { name: 'Market_resolved_idx', columns: ['resolved'] },
    ],
    uniqueConstraints: [],
  },

  // Positions
  {
    name: 'Position',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'userId', type: 'TEXT', nullable: false },
      { name: 'marketId', type: 'TEXT', nullable: false },
      { name: 'side', type: 'BOOLEAN', nullable: false },
      {
        name: 'shares',
        type: 'DECIMAL',
        nullable: false,
        precision: 18,
        scale: 6,
      },
      {
        name: 'avgPrice',
        type: 'DECIMAL',
        nullable: false,
        precision: 18,
        scale: 6,
      },
      {
        name: 'amount',
        type: 'DECIMAL',
        nullable: false,
        default: '0',
        precision: 18,
        scale: 2,
      },
      { name: 'status', type: 'TEXT', nullable: false, default: 'active' },
      { name: 'pnl', type: 'DECIMAL', nullable: true, precision: 18, scale: 2 },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      { name: 'updatedAt', type: 'TIMESTAMP', nullable: false },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'Position_userId_idx', columns: ['userId'] },
      { name: 'Position_marketId_idx', columns: ['marketId'] },
      { name: 'Position_status_idx', columns: ['status'] },
    ],
    uniqueConstraints: [],
  },

  // Posts
  {
    name: 'Post',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'content', type: 'TEXT', nullable: false },
      { name: 'authorId', type: 'TEXT', nullable: false },
      { name: 'gameId', type: 'TEXT', nullable: true },
      { name: 'dayNumber', type: 'INTEGER', nullable: true },
      { name: 'type', type: 'TEXT', nullable: false, default: 'post' },
      {
        name: 'timestamp',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      { name: 'deletedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'commentOnPostId', type: 'TEXT', nullable: true },
      { name: 'parentCommentId', type: 'TEXT', nullable: true },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'Post_authorId_idx', columns: ['authorId'] },
      { name: 'Post_timestamp_idx', columns: ['timestamp'] },
      { name: 'Post_type_idx', columns: ['type'] },
    ],
    uniqueConstraints: [],
  },

  // Comments
  {
    name: 'Comment',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'content', type: 'TEXT', nullable: false },
      { name: 'postId', type: 'TEXT', nullable: false },
      { name: 'authorId', type: 'TEXT', nullable: false },
      { name: 'parentCommentId', type: 'TEXT', nullable: true },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      { name: 'updatedAt', type: 'TIMESTAMP', nullable: false },
      { name: 'deletedAt', type: 'TIMESTAMP', nullable: true },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'Comment_postId_idx', columns: ['postId'] },
      { name: 'Comment_authorId_idx', columns: ['authorId'] },
    ],
    uniqueConstraints: [],
  },

  // Reactions
  {
    name: 'Reaction',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'postId', type: 'TEXT', nullable: true },
      { name: 'commentId', type: 'TEXT', nullable: true },
      { name: 'userId', type: 'TEXT', nullable: false },
      { name: 'type', type: 'TEXT', nullable: false, default: 'like' },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'Reaction_postId_idx', columns: ['postId'] },
      { name: 'Reaction_userId_idx', columns: ['userId'] },
    ],
    uniqueConstraints: [
      {
        name: 'Reaction_postId_userId_type_key',
        columns: ['postId', 'userId', 'type'],
      },
    ],
  },

  // Chats
  {
    name: 'Chat',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'name', type: 'TEXT', nullable: true },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'isGroup', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'createdBy', type: 'TEXT', nullable: true },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      { name: 'updatedAt', type: 'TIMESTAMP', nullable: false },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'Chat_isGroup_idx', columns: ['isGroup'] },
      { name: 'Chat_createdBy_idx', columns: ['createdBy'] },
    ],
    uniqueConstraints: [],
  },

  // Messages
  {
    name: 'Message',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'chatId', type: 'TEXT', nullable: false },
      { name: 'senderId', type: 'TEXT', nullable: false },
      { name: 'content', type: 'TEXT', nullable: false },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'Message_chatId_idx', columns: ['chatId'] },
      { name: 'Message_senderId_idx', columns: ['senderId'] },
    ],
    uniqueConstraints: [],
  },

  // BalanceTransactions
  {
    name: 'BalanceTransaction',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'userId', type: 'TEXT', nullable: false },
      { name: 'type', type: 'TEXT', nullable: false },
      {
        name: 'amount',
        type: 'DECIMAL',
        nullable: false,
        precision: 18,
        scale: 2,
      },
      {
        name: 'balanceBefore',
        type: 'DECIMAL',
        nullable: false,
        precision: 18,
        scale: 2,
      },
      {
        name: 'balanceAfter',
        type: 'DECIMAL',
        nullable: false,
        precision: 18,
        scale: 2,
      },
      { name: 'relatedId', type: 'TEXT', nullable: true },
      { name: 'description', type: 'TEXT', nullable: true },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'BalanceTransaction_userId_idx', columns: ['userId'] },
      { name: 'BalanceTransaction_type_idx', columns: ['type'] },
    ],
    uniqueConstraints: [],
  },

  // Follows
  {
    name: 'Follow',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'followerId', type: 'TEXT', nullable: false },
      { name: 'followingId', type: 'TEXT', nullable: false },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'Follow_followerId_idx', columns: ['followerId'] },
      { name: 'Follow_followingId_idx', columns: ['followingId'] },
    ],
    uniqueConstraints: [
      {
        name: 'Follow_followerId_followingId_key',
        columns: ['followerId', 'followingId'],
      },
    ],
  },

  // Notifications
  {
    name: 'Notification',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'userId', type: 'TEXT', nullable: false },
      { name: 'type', type: 'TEXT', nullable: false },
      { name: 'actorId', type: 'TEXT', nullable: true },
      { name: 'postId', type: 'TEXT', nullable: true },
      { name: 'chatId', type: 'TEXT', nullable: true },
      { name: 'message', type: 'TEXT', nullable: false },
      { name: 'title', type: 'TEXT', nullable: false },
      { name: 'read', type: 'BOOLEAN', nullable: false, default: false },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'Notification_userId_idx', columns: ['userId'] },
      { name: 'Notification_read_idx', columns: ['read'] },
    ],
    uniqueConstraints: [],
  },

  // ChatParticipants
  {
    name: 'ChatParticipant',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'chatId', type: 'TEXT', nullable: false },
      { name: 'userId', type: 'TEXT', nullable: false },
      {
        name: 'joinedAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'ChatParticipant_chatId_idx', columns: ['chatId'] },
      { name: 'ChatParticipant_userId_idx', columns: ['userId'] },
    ],
    uniqueConstraints: [
      {
        name: 'ChatParticipant_chatId_userId_key',
        columns: ['chatId', 'userId'],
      },
    ],
  },

  // Pools
  {
    name: 'Pool',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'name', type: 'TEXT', nullable: false },
      { name: 'npcActorId', type: 'TEXT', nullable: false },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      { name: 'updatedAt', type: 'TIMESTAMP', nullable: false },
    ],
    primaryKey: ['id'],
    indexes: [{ name: 'Pool_npcActorId_idx', columns: ['npcActorId'] }],
    uniqueConstraints: [],
  },

  // ActorState
  {
    name: 'ActorState',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'actorId', type: 'TEXT', nullable: false },
      { name: 'state', type: 'JSON', nullable: false },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      { name: 'updatedAt', type: 'TIMESTAMP', nullable: false },
    ],
    primaryKey: ['id'],
    indexes: [{ name: 'ActorState_actorId_idx', columns: ['actorId'] }],
    uniqueConstraints: [],
  },

  // Referrals
  {
    name: 'Referral',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'referrerId', type: 'TEXT', nullable: false },
      { name: 'referredUserId', type: 'TEXT', nullable: true },
      { name: 'referralCode', type: 'TEXT', nullable: false },
      { name: 'status', type: 'TEXT', nullable: false, default: 'pending' },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      { name: 'completedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'qualifiedAt', type: 'TIMESTAMP', nullable: true },
      {
        name: 'signupPointsAwarded',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      { name: 'suspiciousReferralFlags', type: 'JSON', nullable: true },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'Referral_referralCode_idx', columns: ['referralCode'] },
      { name: 'Referral_referrerId_idx', columns: ['referrerId'] },
      { name: 'Referral_referredUserId_idx', columns: ['referredUserId'] },
      {
        name: 'Referral_status_createdAt_idx',
        columns: ['status', 'createdAt'],
      },
    ],
    uniqueConstraints: [
      {
        name: 'Referral_referralCode_referredUserId_key',
        columns: ['referralCode', 'referredUserId'],
      },
    ],
  },

  // OnboardingIntents
  {
    name: 'OnboardingIntent',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'userId', type: 'TEXT', nullable: false, unique: true },
      {
        name: 'status',
        type: 'TEXT',
        nullable: false,
        default: 'PENDING_PROFILE',
      },
      { name: 'referralCode', type: 'TEXT', nullable: true },
      { name: 'payload', type: 'JSON', nullable: true },
      {
        name: 'profileApplied',
        type: 'BOOLEAN',
        nullable: false,
        default: false,
      },
      { name: 'profileCompletedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'onchainStartedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'onchainCompletedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'lastError', type: 'JSON', nullable: true },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      { name: 'updatedAt', type: 'TIMESTAMP', nullable: false },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'OnboardingIntent_createdAt_idx', columns: ['createdAt'] },
      { name: 'OnboardingIntent_status_idx', columns: ['status'] },
    ],
    uniqueConstraints: [],
  },

  // AgentRegistries
  {
    name: 'AgentRegistry',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'userId', type: 'TEXT', nullable: false, unique: true },
      { name: 'name', type: 'TEXT', nullable: false },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'status', type: 'TEXT', nullable: false, default: 'active' },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      { name: 'updatedAt', type: 'TIMESTAMP', nullable: false },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'AgentRegistry_userId_idx', columns: ['userId'] },
      { name: 'AgentRegistry_status_idx', columns: ['status'] },
    ],
    uniqueConstraints: [],
  },

  // Games
  {
    name: 'Game',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'name', type: 'TEXT', nullable: false },
      { name: 'status', type: 'TEXT', nullable: false, default: 'active' },
      { name: 'dayNumber', type: 'INTEGER', nullable: false, default: 1 },
      {
        name: 'createdAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      { name: 'updatedAt', type: 'TIMESTAMP', nullable: false },
    ],
    primaryKey: ['id'],
    indexes: [{ name: 'Game_status_idx', columns: ['status'] }],
    uniqueConstraints: [],
  },
].sort((a, b) => a.name.localeCompare(b.name)) as CQLTableSchema[]

/** Alias for backward compatibility */
export const CQL_SCHEMA = BABYLON_SCHEMAS

/** Generate all DDL statements for Babylon */
export function generateAllDDL(): string[] {
  const statements: string[] = []

  for (const schema of BABYLON_SCHEMAS) {
    statements.push(generateCreateTableSQL(schema))
    statements.push(...generateIndexSQL(schema))
  }

  return statements
}

/** Get schema by table name */
export function getSchemaByName(name: string): CQLTableSchema | undefined {
  return BABYLON_SCHEMAS.find((s) => s.name === name)
}

export { TYPE_MAP }

/** Create all tables in CovenantSQL */
export async function createCQLTables(client: {
  exec: (sql: string) => Promise<unknown>
}): Promise<void> {
  const statements = generateAllDDL()
  for (const sql of statements) {
    await client.exec(sql)
  }
}
