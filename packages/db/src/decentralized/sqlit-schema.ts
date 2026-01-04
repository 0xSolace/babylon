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
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  wallet_address TEXT UNIQUE,
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  profile_image_url TEXT,
  is_actor INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  virtual_balance TEXT DEFAULT '0',
  total_deposited TEXT DEFAULT '0',
  total_withdrawn TEXT DEFAULT '0',
  lifetime_pnl TEXT DEFAULT '0',
  profile_complete INTEGER DEFAULT 0,
  reputation_points INTEGER DEFAULT 0
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  content TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  like_count INTEGER DEFAULT 0,
  repost_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY,
  creator_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'open',
  resolution_value REAL,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  resolved_at INTEGER,
  closes_at INTEGER,
  total_volume TEXT DEFAULT '0',
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  shares TEXT NOT NULL,
  cost_basis TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (market_id) REFERENCES markets(id)
);

-- Pools table
CREATE TABLE IF NOT EXISTS pools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  market_id TEXT,
  total_liquidity TEXT DEFAULT '0',
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (market_id) REFERENCES markets(id)
);

-- Pool positions table
CREATE TABLE IF NOT EXISTS pool_positions (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  shares TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (pool_id) REFERENCES pools(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  name TEXT,
  type TEXT DEFAULT 'direct',
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Chat participants table
CREATE TABLE IF NOT EXISTS chat_participants (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (chat_id) REFERENCES chats(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  message TEXT,
  read INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Training batches table
CREATE TABLE IF NOT EXISTS training_batches (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'pending',
  model_type TEXT,
  trajectory_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  completed_at INTEGER
);

-- Trained models table
CREATE TABLE IF NOT EXISTS trained_models (
  id TEXT PRIMARY KEY,
  batch_id TEXT,
  name TEXT NOT NULL,
  version TEXT,
  metrics TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (batch_id) REFERENCES training_batches(id)
);

-- Trajectories table
CREATE TABLE IF NOT EXISTS trajectories (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  market_id TEXT,
  action TEXT,
  outcome TEXT,
  reward REAL,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  tick_number INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Game configs table
CREATE TABLE IF NOT EXISTS game_configs (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
`
}

/**
 * Create all tables in the SQLit database.
 */
export async function createSQLitTables(db: DB): Promise<void> {
  const ddl = generateAllDDL()
  const statements = ddl
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  for (const statement of statements) {
    await db.exec(`${statement};`)
  }
}
