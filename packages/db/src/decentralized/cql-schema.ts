/**
 * CovenantSQL Schema Definitions
 *
 * Converts Drizzle-style schema to CovenantSQL DDL.
 * Handles type mapping and constraint generation.
 */

import type { CQLColumn, CQLTableSchema } from './types';

/** Map Drizzle types to CQL types */
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
};

/** Generate CREATE TABLE SQL from schema */
export function generateCreateTableSQL(schema: CQLTableSchema): string {
  const columnDefs = schema.columns.map((col) => {
    let def = `"${col.name}" ${col.type}`;

    if (col.type === 'DECIMAL' && col.precision && col.scale) {
      def = `"${col.name}" DECIMAL(${col.precision}, ${col.scale})`;
    }

    if (!col.nullable) def += ' NOT NULL';
    if (col.default !== undefined) {
      if (col.default === null) {
        def += ' DEFAULT NULL';
      } else if (typeof col.default === 'string') {
        if (col.default === 'NOW()' || col.default === 'CURRENT_TIMESTAMP') {
          def += ' DEFAULT CURRENT_TIMESTAMP';
        } else {
          def += ` DEFAULT '${col.default}'`;
        }
      } else if (typeof col.default === 'boolean') {
        def += ` DEFAULT ${col.default ? 'TRUE' : 'FALSE'}`;
      } else {
        def += ` DEFAULT ${col.default}`;
      }
    }
    if (col.unique && !col.primaryKey) def += ' UNIQUE';

    return def;
  });

  const constraints: string[] = [];

  if (schema.primaryKey.length > 0) {
    constraints.push(
      `PRIMARY KEY (${schema.primaryKey.map((k) => `"${k}"`).join(', ')})`
    );
  }

  for (const uc of schema.uniqueConstraints) {
    constraints.push(
      `CONSTRAINT "${uc.name}" UNIQUE (${uc.columns.map((c) => `"${c}"`).join(', ')})`
    );
  }

  const allDefs = [...columnDefs, ...constraints];

  return `CREATE TABLE IF NOT EXISTS "${schema.name}" (\n  ${allDefs.join(',\n  ')}\n)`;
}

/** Generate CREATE INDEX SQL statements */
export function generateIndexSQL(schema: CQLTableSchema): string[] {
  return schema.indexes.map((idx) => {
    const unique = idx.unique ? 'UNIQUE ' : '';
    const columns = idx.columns.map((c) => `"${c}"`).join(', ');
    return `CREATE ${unique}INDEX IF NOT EXISTS "${idx.name}" ON "${schema.name}" (${columns})`;
  });
}

/** Define all Babylon tables for CovenantSQL */
export const BABYLON_SCHEMAS: CQLTableSchema[] = [
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
        name: 'reputationPoints',
        type: 'INTEGER',
        nullable: false,
        default: 1000,
      },
      { name: 'referralCode', type: 'TEXT', nullable: true, unique: true },
      { name: 'referralCount', type: 'INTEGER', nullable: false, default: 0 },
      { name: 'referredBy', type: 'TEXT', nullable: true },
      { name: 'privyId', type: 'TEXT', nullable: true, unique: true },
      { name: 'isAdmin', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'isBanned', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'isAgent', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'managedBy', type: 'TEXT', nullable: true },
      { name: 'farcasterFid', type: 'TEXT', nullable: true, unique: true },
      { name: 'twitterId', type: 'TEXT', nullable: true, unique: true },
      { name: 'discordId', type: 'TEXT', nullable: true, unique: true },
      { name: 'email', type: 'TEXT', nullable: true },
      { name: 'tosAccepted', type: 'BOOLEAN', nullable: false, default: false },
      { name: 'invitePoints', type: 'INTEGER', nullable: false, default: 0 },
      { name: 'earnedPoints', type: 'INTEGER', nullable: false, default: 0 },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'User_walletAddress_idx', columns: ['walletAddress'] },
      { name: 'User_username_idx', columns: ['username'] },
      { name: 'User_isAgent_idx', columns: ['isAgent'] },
      { name: 'User_isActor_idx', columns: ['isActor'] },
      { name: 'User_reputationPoints_idx', columns: ['reputationPoints'] },
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

  // PerpPositions
  {
    name: 'PerpPosition',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'userId', type: 'TEXT', nullable: false },
      { name: 'ticker', type: 'TEXT', nullable: false },
      { name: 'organizationId', type: 'TEXT', nullable: false },
      { name: 'side', type: 'TEXT', nullable: false },
      { name: 'entryPrice', type: 'DOUBLE', nullable: false },
      { name: 'currentPrice', type: 'DOUBLE', nullable: false },
      { name: 'size', type: 'DOUBLE', nullable: false },
      { name: 'leverage', type: 'INTEGER', nullable: false },
      { name: 'liquidationPrice', type: 'DOUBLE', nullable: false },
      { name: 'unrealizedPnL', type: 'DOUBLE', nullable: false },
      { name: 'unrealizedPnLPercent', type: 'DOUBLE', nullable: false },
      {
        name: 'openedAt',
        type: 'TIMESTAMP',
        nullable: false,
        default: 'NOW()',
      },
      { name: 'lastUpdated', type: 'TIMESTAMP', nullable: false },
      { name: 'closedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'realizedPnL', type: 'DOUBLE', nullable: true },
    ],
    primaryKey: ['id'],
    indexes: [
      { name: 'PerpPosition_userId_idx', columns: ['userId'] },
      { name: 'PerpPosition_ticker_idx', columns: ['ticker'] },
    ],
    uniqueConstraints: [],
  },

  // Organizations (Companies for perps)
  {
    name: 'Organization',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
      { name: 'name', type: 'TEXT', nullable: false },
      { name: 'ticker', type: 'TEXT', nullable: true },
      { name: 'description', type: 'TEXT', nullable: false },
      { name: 'type', type: 'TEXT', nullable: false },
      {
        name: 'canBeInvolved',
        type: 'BOOLEAN',
        nullable: false,
        default: true,
      },
      { name: 'initialPrice', type: 'DOUBLE', nullable: true },
      { name: 'currentPrice', type: 'DOUBLE', nullable: true },
      { name: 'imageUrl', type: 'TEXT', nullable: true },
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
      { name: 'Organization_ticker_idx', columns: ['ticker'] },
      { name: 'Organization_type_idx', columns: ['type'] },
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
];

/** Generate all DDL statements for Babylon */
export function generateAllDDL(): string[] {
  const statements: string[] = [];

  for (const schema of BABYLON_SCHEMAS) {
    statements.push(generateCreateTableSQL(schema));
    statements.push(...generateIndexSQL(schema));
  }

  return statements;
}

/** Get schema by table name */
export function getSchemaByName(name: string): CQLTableSchema | undefined {
  return BABYLON_SCHEMAS.find((s) => s.name === name);
}

export { TYPE_MAP };

// Aliases for index.ts exports
export const CQL_SCHEMA = BABYLON_SCHEMAS;

/** Create all tables in CovenantSQL */
export async function createCQLTables(client: {
  exec: (sql: string) => Promise<unknown>;
}): Promise<void> {
  const statements = generateAllDDL();
  for (const sql of statements) {
    await client.exec(sql);
  }
}
