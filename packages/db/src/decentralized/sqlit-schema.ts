/**
 * SQLit Schema Definitions for Babylon
 *
 * Provides DDL generation and table creation for SQLit database.
 */

import type { DB } from './db'

// Re-export types from sqlit-schema-types
export * from '../sqlit-schema-types'

// Schema constants
export const SQLIT_SCHEMA = 'babylon'

export const BABYLON_SCHEMAS = [
  'users',
  'posts',
  'markets',
  'positions',
  'pools',
  'pool_positions',
  'comments',
  'messages',
  'notifications',
  'questions',
  'reactions',
  'reports',
  'chats',
  'chat_invites',
  'chat_participants',
  'trained_models',
  'training_batches',
  'trajectories',
  'perp_positions',
  'games',
  'game_configs',
]

export function getSchemaByName(name: string): string {
  return BABYLON_SCHEMAS.includes(name) ? name : ''
}

/**
 * Generate all DDL statements for the Babylon database schema.
 */
export function generateAllDDL(): string {
  return `
-- User table (PascalCase table name, camelCase columns)
CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  walletAddress TEXT UNIQUE,
  username TEXT UNIQUE,
  displayName TEXT,
  email TEXT,
  bio TEXT,
  profileImageUrl TEXT,
  isActor INTEGER DEFAULT 0,
  isAdmin INTEGER DEFAULT 0,
  isBanned INTEGER DEFAULT 0,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  virtualBalance TEXT DEFAULT '0',
  totalDeposited TEXT DEFAULT '0',
  totalWithdrawn TEXT DEFAULT '0',
  lifetimePnl TEXT DEFAULT '0',
  profileComplete INTEGER DEFAULT 0,
  reputationPoints INTEGER DEFAULT 0
);

-- Post table
CREATE TABLE IF NOT EXISTS Post (
  id TEXT PRIMARY KEY,
  authorId TEXT NOT NULL,
  content TEXT,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  likeCount INTEGER DEFAULT 0,
  repostCount INTEGER DEFAULT 0,
  commentCount INTEGER DEFAULT 0,
  FOREIGN KEY (authorId) REFERENCES User(id)
);

-- Market table
CREATE TABLE IF NOT EXISTS Market (
  id TEXT PRIMARY KEY,
  creatorId TEXT,
  title TEXT,
  question TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'open',
  resolved INTEGER DEFAULT 0,
  resolution TEXT,
  resolutionValue REAL,
  yesShares TEXT DEFAULT '0',
  noShares TEXT DEFAULT '0',
  liquidity TEXT DEFAULT '0',
  endDate INTEGER,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  resolvedAt INTEGER,
  closesAt INTEGER,
  totalVolume TEXT DEFAULT '0',
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (creatorId) REFERENCES User(id)
);

-- Position table
CREATE TABLE IF NOT EXISTS Position (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  marketId TEXT NOT NULL,
  shares TEXT NOT NULL,
  costBasis TEXT NOT NULL,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (userId) REFERENCES User(id),
  FOREIGN KEY (marketId) REFERENCES Market(id)
);

-- Pool table
CREATE TABLE IF NOT EXISTS Pool (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  marketId TEXT,
  npcActorId TEXT,
  totalLiquidity TEXT DEFAULT '0',
  totalDeposits TEXT DEFAULT '0',
  totalValue TEXT DEFAULT '0',
  availableBalance TEXT DEFAULT '0',
  lifetimePnL TEXT DEFAULT '0',
  performanceFeeRate REAL DEFAULT 0.05,
  totalFeesCollected TEXT DEFAULT '0',
  status TEXT DEFAULT 'ACTIVE',
  isActive INTEGER DEFAULT 1,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (marketId) REFERENCES Market(id)
);

-- PoolPosition table
CREATE TABLE IF NOT EXISTS PoolPosition (
  id TEXT PRIMARY KEY,
  poolId TEXT NOT NULL,
  userId TEXT NOT NULL,
  shares TEXT NOT NULL,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (poolId) REFERENCES Pool(id),
  FOREIGN KEY (userId) REFERENCES User(id)
);

-- Message table
CREATE TABLE IF NOT EXISTS Message (
  id TEXT PRIMARY KEY,
  chatId TEXT NOT NULL,
  senderId TEXT NOT NULL,
  content TEXT,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (senderId) REFERENCES User(id)
);

-- Chat table
CREATE TABLE IF NOT EXISTS Chat (
  id TEXT PRIMARY KEY,
  name TEXT,
  type TEXT DEFAULT 'direct',
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- ChatParticipant table
CREATE TABLE IF NOT EXISTS ChatParticipant (
  id TEXT PRIMARY KEY,
  chatId TEXT NOT NULL,
  userId TEXT NOT NULL,
  joinedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (chatId) REFERENCES Chat(id),
  FOREIGN KEY (userId) REFERENCES User(id)
);

-- Notification table
CREATE TABLE IF NOT EXISTS Notification (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  message TEXT,
  read INTEGER DEFAULT 0,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (userId) REFERENCES User(id)
);

-- TrainingBatch table
CREATE TABLE IF NOT EXISTS TrainingBatch (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'pending',
  modelType TEXT,
  trajectoryCount INTEGER DEFAULT 0,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  completedAt INTEGER
);

-- TrainedModel table
CREATE TABLE IF NOT EXISTS TrainedModel (
  id TEXT PRIMARY KEY,
  batchId TEXT,
  name TEXT NOT NULL,
  version TEXT,
  metrics TEXT,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (batchId) REFERENCES TrainingBatch(id)
);

-- Trajectory table
CREATE TABLE IF NOT EXISTS Trajectory (
  id TEXT PRIMARY KEY,
  userId TEXT,
  marketId TEXT,
  action TEXT,
  outcome TEXT,
  reward REAL,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Game table
CREATE TABLE IF NOT EXISTS Game (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT DEFAULT 'active',
  isContinuous INTEGER DEFAULT 1,
  isRunning INTEGER DEFAULT 1,
  currentDate INTEGER,
  currentDay INTEGER DEFAULT 1,
  speed INTEGER DEFAULT 60000,
  tickNumber INTEGER DEFAULT 0,
  startedAt INTEGER,
  pausedAt INTEGER,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- GameConfig table
CREATE TABLE IF NOT EXISTS GameConfig (
  id TEXT PRIMARY KEY,
  gameId TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  FOREIGN KEY (gameId) REFERENCES Game(id)
);

-- Question table (prediction markets)
CREATE TABLE IF NOT EXISTS Question (
  id TEXT PRIMARY KEY,
  gameId TEXT,
  marketId TEXT,
  title TEXT,
  question TEXT NOT NULL,
  text TEXT,
  type TEXT DEFAULT 'binary',
  questionNumber INTEGER,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'active',
  resolutionValue REAL,
  resolutionDate INTEGER,
  yesPrice REAL DEFAULT 0.5,
  noPrice REAL DEFAULT 0.5,
  totalVolume TEXT DEFAULT '0',
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  createdDate INTEGER,
  resolvedAt INTEGER,
  closesAt INTEGER,
  creatorId TEXT,
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (gameId) REFERENCES Game(id),
  FOREIGN KEY (marketId) REFERENCES Market(id)
);

-- ActorState table
CREATE TABLE IF NOT EXISTS ActorState (
  id TEXT PRIMARY KEY,
  actorId TEXT,
  state TEXT,
  tradingBalance TEXT DEFAULT '0',
  reputationPoints INTEGER DEFAULT 0,
  hasPool INTEGER DEFAULT 0,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- OrganizationState table
CREATE TABLE IF NOT EXISTS OrganizationState (
  id TEXT PRIMARY KEY,
  organizationId TEXT,
  state TEXT,
  currentPrice REAL DEFAULT 0,
  marketCap TEXT DEFAULT '0',
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- ActorRelationship table
CREATE TABLE IF NOT EXISTS ActorRelationship (
  id TEXT PRIMARY KEY,
  actorId TEXT,
  relatedActorId TEXT,
  actor1Id TEXT,
  actor2Id TEXT,
  relationshipType TEXT NOT NULL,
  strength REAL DEFAULT 0,
  sentiment TEXT,
  history TEXT,
  isPublic INTEGER DEFAULT 1,
  interactionCount INTEGER DEFAULT 0,
  evolutionCount INTEGER DEFAULT 0,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- TrendingTag table
CREATE TABLE IF NOT EXISTS TrendingTag (
  id TEXT PRIMARY KEY,
  tagId TEXT,
  tag TEXT,
  count INTEGER DEFAULT 0,
  postCount INTEGER DEFAULT 0,
  score REAL DEFAULT 0,
  rank INTEGER,
  windowStart INTEGER,
  windowEnd INTEGER,
  relatedContext TEXT,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- PostTag table
CREATE TABLE IF NOT EXISTS PostTag (
  id TEXT PRIMARY KEY,
  postId TEXT NOT NULL,
  tag TEXT,
  tagId TEXT,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (postId) REFERENCES Post(id)
);

-- Tag table
CREATE TABLE IF NOT EXISTS Tag (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  displayName TEXT,
  category TEXT,
  count INTEGER DEFAULT 0,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- WorldFact table
CREATE TABLE IF NOT EXISTS WorldFact (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  category TEXT,
  source TEXT,
  isVerified INTEGER DEFAULT 0,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- WorldEvent table
CREATE TABLE IF NOT EXISTS WorldEvent (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  description TEXT,
  severity TEXT,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- StockPrice table
CREATE TABLE IF NOT EXISTS StockPrice (
  id TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  price REAL NOT NULL,
  change REAL DEFAULT 0,
  volume TEXT DEFAULT '0',
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- NPCTrade table
CREATE TABLE IF NOT EXISTS NPCTrade (
  id TEXT PRIMARY KEY,
  npcId TEXT NOT NULL,
  marketId TEXT,
  side TEXT NOT NULL,
  amount REAL NOT NULL,
  price REAL,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- NPCInteraction table
CREATE TABLE IF NOT EXISTS NPCInteraction (
  id TEXT PRIMARY KEY,
  npcId TEXT NOT NULL,
  targetId TEXT,
  type TEXT NOT NULL,
  content TEXT,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Comment table
CREATE TABLE IF NOT EXISTS Comment (
  id TEXT PRIMARY KEY,
  postId TEXT NOT NULL,
  authorId TEXT NOT NULL,
  content TEXT,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (postId) REFERENCES Post(id),
  FOREIGN KEY (authorId) REFERENCES User(id)
);

-- Reaction table
CREATE TABLE IF NOT EXISTS Reaction (
  id TEXT PRIMARY KEY,
  postId TEXT,
  commentId TEXT,
  userId TEXT NOT NULL,
  type TEXT NOT NULL,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Follow table
CREATE TABLE IF NOT EXISTS Follow (
  id TEXT PRIMARY KEY,
  followerId TEXT NOT NULL,
  followingId TEXT NOT NULL,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- PerpPosition table
CREATE TABLE IF NOT EXISTS PerpPosition (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  ticker TEXT NOT NULL,
  side TEXT NOT NULL,
  size TEXT NOT NULL,
  entryPrice REAL NOT NULL,
  leverage INTEGER DEFAULT 1,
  liquidationPrice REAL,
  unrealizedPnl TEXT DEFAULT '0',
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- AgentLog table  
CREATE TABLE IF NOT EXISTS AgentLog (
  id TEXT PRIMARY KEY,
  agentId TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT,
  metadata TEXT,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- AgentMessage table
CREATE TABLE IF NOT EXISTS AgentMessage (
  id TEXT PRIMARY KEY,
  agentId TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- WidgetCache table update
CREATE TABLE IF NOT EXISTS WidgetCacheEntry (
  id TEXT PRIMARY KEY,
  widgetType TEXT NOT NULL,
  data TEXT,
  expiresAt INTEGER,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- RSSHeadline table
CREATE TABLE IF NOT EXISTS RSSHeadline (
  id TEXT PRIMARY KEY,
  sourceId TEXT,
  title TEXT NOT NULL,
  url TEXT,
  publishedAt INTEGER,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- RSSFeedSource table
CREATE TABLE IF NOT EXISTS RSSFeedSource (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  feedUrl TEXT NOT NULL,
  category TEXT,
  enabled INTEGER DEFAULT 1,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- TickTokenStats table
CREATE TABLE IF NOT EXISTS TickTokenStats (
  id TEXT PRIMARY KEY,
  gameId TEXT,
  tickNumber INTEGER,
  inputTokens INTEGER DEFAULT 0,
  outputTokens INTEGER DEFAULT 0,
  totalCost REAL DEFAULT 0,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- WidgetCache table
CREATE TABLE IF NOT EXISTS WidgetCache (
  id TEXT PRIMARY KEY,
  widgetType TEXT NOT NULL,
  data TEXT,
  expiresAt INTEGER,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- PerpMarketSnapshot table
CREATE TABLE IF NOT EXISTS PerpMarketSnapshot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL UNIQUE,
  organizationId TEXT,
  name TEXT,
  currentPrice REAL NOT NULL,
  price24hAgo REAL,
  price24hAgoUpdatedAt INTEGER,
  metrics24hResetAt INTEGER,
  change24h REAL DEFAULT 0,
  changePercent24h REAL DEFAULT 0,
  high24h REAL,
  low24h REAL,
  volume24h REAL DEFAULT 0,
  openInterest REAL DEFAULT 0,
  fundingRate TEXT,
  maxLeverage INTEGER DEFAULT 100,
  minOrderSize REAL DEFAULT 10,
  markPrice REAL,
  indexPrice REAL,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- AgentRegistry table (camelCase columns to match types)
CREATE TABLE IF NOT EXISTS AgentRegistry (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  agentId TEXT NOT NULL UNIQUE,
  actorId TEXT,
  name TEXT NOT NULL,
  description TEXT,
  systemPrompt TEXT,
  type TEXT DEFAULT 'npc',
  status TEXT DEFAULT 'active',
  trustLevel INTEGER DEFAULT 0,
  ownerId TEXT,
  runtimeInstanceId TEXT,
  lastActiveAt INTEGER,
  discoveryEndpointA2a TEXT,
  discoveryEndpointMcp TEXT,
  discoveryAuthRequired INTEGER DEFAULT 0,
  discoveryAuthMethods TEXT,
  onChainReputationScore INTEGER DEFAULT 0,
  agent0TokenId TEXT,
  agent0MetadataCID TEXT,
  agent0DiscoveryEndpoint TEXT,
  agent0SubgraphOwner TEXT,
  registeredAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (userId) REFERENCES User(id)
);

-- AgentCapability table (matches query: strategies, markets, actions, skills, domains, a2aEndpoint)
CREATE TABLE IF NOT EXISTS AgentCapability (
  id TEXT PRIMARY KEY,
  agentRegistryId TEXT NOT NULL,
  strategies TEXT,
  markets TEXT,
  actions TEXT,
  skills TEXT,
  domains TEXT,
  a2aEndpoint TEXT,
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (agentRegistryId) REFERENCES AgentRegistry(id)
);

-- AgentTrade table
CREATE TABLE IF NOT EXISTS AgentTrade (
  id TEXT PRIMARY KEY,
  agentId TEXT NOT NULL,
  marketId TEXT NOT NULL,
  side TEXT NOT NULL,
  amount REAL NOT NULL,
  price REAL NOT NULL,
  executedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (agentId) REFERENCES AgentRegistry(id)
);

-- ExternalAgentConnection table (matches query: endpoint, isHealthy)
CREATE TABLE IF NOT EXISTS ExternalAgentConnection (
  id TEXT PRIMARY KEY,
  agentRegistryId TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  protocol TEXT DEFAULT 'a2a',
  isHealthy INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (agentRegistryId) REFERENCES AgentRegistry(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_post_author ON Post(authorId);
CREATE INDEX IF NOT EXISTS idx_position_user ON Position(userId);
CREATE INDEX IF NOT EXISTS idx_position_market ON Position(marketId);
CREATE INDEX IF NOT EXISTS idx_message_chat ON Message(chatId);
CREATE INDEX IF NOT EXISTS idx_notification_user ON Notification(userId);
CREATE INDEX IF NOT EXISTS idx_agent_registry_agent_id ON AgentRegistry(agentId);
CREATE INDEX IF NOT EXISTS idx_agent_registry_status ON AgentRegistry(status);
`
}

/**
 * Create all tables in the SQLit database.
 */
export async function createSQLitTables(db: DB): Promise<void> {
  const ddl = generateAllDDL()
  const statements = ddl
    .split(';')
    .map((s) => {
      // Remove leading comment lines while preserving the SQL
      const lines = s.split('\n')
      const sqlLines = lines.filter((line) => !line.trim().startsWith('--'))
      return sqlLines.join('\n').trim()
    })
    .filter((s) => s.length > 0)

  console.log(`[SQLit Schema] Creating ${statements.length} tables/indexes...`)

  for (const statement of statements) {
    try {
      await db.exec(`${statement};`)
      // Log table creations
      if (statement.includes('CREATE TABLE')) {
        const match = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)
        if (match) console.log(`[SQLit Schema] Created table: ${match[1]}`)
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error(
        `[SQLit Schema] Failed to execute: ${statement.substring(0, 50)}...`,
      )
      console.error(`[SQLit Schema] Error: ${errMsg}`)
      // Continue with other statements - IF NOT EXISTS should handle duplicates
      if (!errMsg.includes('already exists')) {
        throw error
      }
    }
  }
  console.log('[SQLit Schema] Schema creation complete')
}
