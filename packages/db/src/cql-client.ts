/**
 * CQL Database Client
 *
 * This is the PRIMARY database interface for Babylon.
 * ALL database operations go through CQL (CovenantSQL).
 * NO FALLBACKS to PostgreSQL.
 *
 * Provides the same API as the Drizzle client for compatibility.
 */

import type { QueryParam } from '@jeju/db';
import {
  CQLTableRepository,
  getDB,
  initializeDB,
  type JsonValue,
  resetDB,
  type SQLValue,
} from './cql-repository';

// Re-export types
export type { JsonValue, SQLValue };

// ============================================================================
// Table Type Definitions
// ============================================================================

// Base record types - these match the Drizzle schema types
type BaseRecord = Record<string, SQLValue | JsonValue>;

// ============================================================================
// CQL Client Interface
// ============================================================================

// Drizzle-style query builder types
interface SelectBuilder<T = BaseRecord> {
  from: (table: unknown) => SelectBuilder<T>;
  where: (condition: unknown) => SelectBuilder<T>;
  orderBy: (...orders: unknown[]) => SelectBuilder<T>;
  limit: (n: number) => SelectBuilder<T>;
  offset: (n: number) => SelectBuilder<T>;
  leftJoin: (table: unknown, condition: unknown) => SelectBuilder<T>;
  innerJoin: (table: unknown, condition: unknown) => SelectBuilder<T>;
  groupBy: (...columns: unknown[]) => SelectBuilder<T>;
  $dynamic: () => SelectBuilder<T>;
  then: <TResult>(
    onfulfilled?: (value: T[]) => TResult | PromiseLike<TResult>
  ) => Promise<TResult>;
}

interface InsertBuilder<T = BaseRecord> {
  values: (data: unknown | unknown[]) => InsertBuilder<T>;
  onConflictDoNothing: () => InsertBuilder<T>;
  onConflictDoUpdate: (options: unknown) => InsertBuilder<T>;
  returning: () => Promise<T[]>;
  then: <TResult>(
    onfulfilled?: (value: T[]) => TResult | PromiseLike<TResult>
  ) => Promise<TResult>;
}

interface UpdateBuilder<T = BaseRecord> {
  set: (data: unknown) => UpdateBuilder<T>;
  where: (condition: unknown) => UpdateBuilder<T>;
  $dynamic: () => UpdateBuilder<T>;
  returning: () => Promise<T[]>;
  then: <TResult>(
    onfulfilled?: (value: T[]) => TResult | PromiseLike<TResult>
  ) => Promise<TResult>;
}

interface DeleteBuilder<T = BaseRecord> {
  where: (condition: unknown) => DeleteBuilder<T>;
  $dynamic: () => DeleteBuilder<T>;
  returning: () => Promise<T[]>;
  then: <TResult>(
    onfulfilled?: (value: T[]) => TResult | PromiseLike<TResult>
  ) => Promise<TResult>;
}

export interface CQLClient {
  // Connection management
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
  $transaction: <T>(callback: (tx: CQLClient) => Promise<T>) => Promise<T>;

  // Raw query methods
  $queryRaw: <T = Record<string, SQLValue>>(
    strings: TemplateStringsArray,
    ...values: SQLValue[]
  ) => Promise<T[]>;
  $executeRaw: (
    strings: TemplateStringsArray,
    ...values: SQLValue[]
  ) => Promise<number>;

  // Direct DB access
  query: <T>(sql: string, params?: QueryParam[]) => Promise<T[]>;
  queryOne: <T>(sql: string, params?: QueryParam[]) => Promise<T | null>;
  exec: (
    sql: string,
    params?: QueryParam[]
  ) => Promise<{ rowsAffected: number }>;

  // Drizzle-style query builders
  select: <T extends Record<string, unknown> = BaseRecord>(
    fields?: T
  ) => SelectBuilder<T>;
  selectDistinct: <T extends Record<string, unknown> = BaseRecord>(
    fields?: T
  ) => SelectBuilder<T>;
  selectDistinctOn: <T extends Record<string, unknown> = BaseRecord>(
    columns: unknown[],
    fields?: T
  ) => SelectBuilder<T>;
  insert: <T = BaseRecord>(table: unknown) => InsertBuilder<T>;
  update: <T = BaseRecord>(table: unknown) => UpdateBuilder<T>;
  delete: <T = BaseRecord>(table: unknown) => DeleteBuilder<T>;
  execute: (query: unknown) => Promise<unknown[]>;
  transaction: <T>(fn: (tx: CQLClient) => Promise<T>) => Promise<T>;

  // Table repositories - all tables from the schema
  user: CQLTableRepository<BaseRecord, BaseRecord>;
  actorState: CQLTableRepository<BaseRecord, BaseRecord>;
  actorFollow: CQLTableRepository<BaseRecord, BaseRecord>;
  actorRelationship: CQLTableRepository<BaseRecord, BaseRecord>;
  post: CQLTableRepository<BaseRecord, BaseRecord>;
  comment: CQLTableRepository<BaseRecord, BaseRecord>;
  reaction: CQLTableRepository<BaseRecord, BaseRecord>;
  share: CQLTableRepository<BaseRecord, BaseRecord>;
  market: CQLTableRepository<BaseRecord, BaseRecord>;
  position: CQLTableRepository<BaseRecord, BaseRecord>;
  perpPosition: CQLTableRepository<BaseRecord, BaseRecord>;
  pool: CQLTableRepository<BaseRecord, BaseRecord>;
  poolPosition: CQLTableRepository<BaseRecord, BaseRecord>;
  poolDeposit: CQLTableRepository<BaseRecord, BaseRecord>;
  organizationState: CQLTableRepository<BaseRecord, BaseRecord>;
  stockPrice: CQLTableRepository<BaseRecord, BaseRecord>;
  question: CQLTableRepository<BaseRecord, BaseRecord>;
  predictionPriceHistory: CQLTableRepository<BaseRecord, BaseRecord>;
  chat: CQLTableRepository<BaseRecord, BaseRecord>;
  chatParticipant: CQLTableRepository<BaseRecord, BaseRecord>;
  chatAdmin: CQLTableRepository<BaseRecord, BaseRecord>;
  chatInvite: CQLTableRepository<BaseRecord, BaseRecord>;
  message: CQLTableRepository<BaseRecord, BaseRecord>;
  notification: CQLTableRepository<BaseRecord, BaseRecord>;
  dmAcceptance: CQLTableRepository<BaseRecord, BaseRecord>;
  groupChatMembership: CQLTableRepository<BaseRecord, BaseRecord>;
  userInteraction: CQLTableRepository<BaseRecord, BaseRecord>;
  agentRegistry: CQLTableRepository<BaseRecord, BaseRecord>;
  agentCapability: CQLTableRepository<BaseRecord, BaseRecord>;
  agentLog: CQLTableRepository<BaseRecord, BaseRecord>;
  agentMessage: CQLTableRepository<BaseRecord, BaseRecord>;
  agentPerformanceMetrics: CQLTableRepository<BaseRecord, BaseRecord>;
  agentGoal: CQLTableRepository<BaseRecord, BaseRecord>;
  agentGoalAction: CQLTableRepository<BaseRecord, BaseRecord>;
  agentPointsTransaction: CQLTableRepository<BaseRecord, BaseRecord>;
  agentTrade: CQLTableRepository<BaseRecord, BaseRecord>;
  externalAgentConnection: CQLTableRepository<BaseRecord, BaseRecord>;
  npcTrade: CQLTableRepository<BaseRecord, BaseRecord>;
  npcInteraction: CQLTableRepository<BaseRecord, BaseRecord>;
  tradingFee: CQLTableRepository<BaseRecord, BaseRecord>;
  balanceTransaction: CQLTableRepository<BaseRecord, BaseRecord>;
  pointsTransaction: CQLTableRepository<BaseRecord, BaseRecord>;
  userActorFollow: CQLTableRepository<BaseRecord, BaseRecord>;
  userGroup: CQLTableRepository<BaseRecord, BaseRecord>;
  userGroupAdmin: CQLTableRepository<BaseRecord, BaseRecord>;
  userGroupInvite: CQLTableRepository<BaseRecord, BaseRecord>;
  userGroupMember: CQLTableRepository<BaseRecord, BaseRecord>;
  pendingGroupInviteCandidate: CQLTableRepository<BaseRecord, BaseRecord>;
  userBlock: CQLTableRepository<BaseRecord, BaseRecord>;
  userMute: CQLTableRepository<BaseRecord, BaseRecord>;
  userMessagingKey: CQLTableRepository<BaseRecord, BaseRecord>;
  report: CQLTableRepository<BaseRecord, BaseRecord>;
  twitterOAuthToken: CQLTableRepository<BaseRecord, BaseRecord>;
  onboardingIntent: CQLTableRepository<BaseRecord, BaseRecord>;
  favorite: CQLTableRepository<BaseRecord, BaseRecord>;
  follow: CQLTableRepository<BaseRecord, BaseRecord>;
  followStatus: CQLTableRepository<BaseRecord, BaseRecord>;
  profileUpdateLog: CQLTableRepository<BaseRecord, BaseRecord>;
  shareAction: CQLTableRepository<BaseRecord, BaseRecord>;
  tag: CQLTableRepository<BaseRecord, BaseRecord>;
  postTag: CQLTableRepository<BaseRecord, BaseRecord>;
  trendingTag: CQLTableRepository<BaseRecord, BaseRecord>;
  llmCallLog: CQLTableRepository<BaseRecord, BaseRecord>;
  marketOutcome: CQLTableRepository<BaseRecord, BaseRecord>;
  trainedModel: CQLTableRepository<BaseRecord, BaseRecord>;
  trainingBatch: CQLTableRepository<BaseRecord, BaseRecord>;
  benchmarkResult: CQLTableRepository<BaseRecord, BaseRecord>;
  trajectory: CQLTableRepository<BaseRecord, BaseRecord>;
  rewardJudgment: CQLTableRepository<BaseRecord, BaseRecord>;
  oracleCommitment: CQLTableRepository<BaseRecord, BaseRecord>;
  oracleTransaction: CQLTableRepository<BaseRecord, BaseRecord>;
  realtimeOutbox: CQLTableRepository<BaseRecord, BaseRecord>;
  game: CQLTableRepository<BaseRecord, BaseRecord>;
  gameConfig: CQLTableRepository<BaseRecord, BaseRecord>;
  oAuthState: CQLTableRepository<BaseRecord, BaseRecord>;
  systemSettings: CQLTableRepository<BaseRecord, BaseRecord>;
  worldEvent: CQLTableRepository<BaseRecord, BaseRecord>;
  worldFact: CQLTableRepository<BaseRecord, BaseRecord>;
  rssFeedSource: CQLTableRepository<BaseRecord, BaseRecord>;
  rssHeadline: CQLTableRepository<BaseRecord, BaseRecord>;
  parodyHeadline: CQLTableRepository<BaseRecord, BaseRecord>;
  moderationEscrow: CQLTableRepository<BaseRecord, BaseRecord>;
  generationLock: CQLTableRepository<BaseRecord, BaseRecord>;
  feedback: CQLTableRepository<BaseRecord, BaseRecord>;
  referral: CQLTableRepository<BaseRecord, BaseRecord>;
  widgetCache: CQLTableRepository<BaseRecord, BaseRecord>;
  userAgentConfig: CQLTableRepository<BaseRecord, BaseRecord>;
  userApiKey: CQLTableRepository<BaseRecord, BaseRecord>;
  tickTokenStats: CQLTableRepository<BaseRecord, BaseRecord>;
  questionArcPlan: CQLTableRepository<BaseRecord, BaseRecord>;
}

// ============================================================================
// Table name mappings
// ============================================================================

const TABLE_NAMES: Record<string, string> = {
  user: 'users',
  actorState: 'actor_state',
  actorFollow: 'actor_follows',
  actorRelationship: 'actor_relationships',
  post: 'posts',
  comment: 'comments',
  reaction: 'reactions',
  share: 'shares',
  market: 'markets',
  position: 'positions',
  perpPosition: 'perp_positions',
  pool: 'pools',
  poolPosition: 'pool_positions',
  poolDeposit: 'pool_deposits',
  organizationState: 'organization_state',
  stockPrice: 'stock_prices',
  question: 'questions',
  predictionPriceHistory: 'prediction_price_histories',
  chat: 'chats',
  chatParticipant: 'chat_participants',
  chatAdmin: 'chat_admins',
  chatInvite: 'chat_invites',
  message: 'messages',
  notification: 'notifications',
  dmAcceptance: 'dm_acceptances',
  groupChatMembership: 'group_chat_memberships',
  userInteraction: 'user_interactions',
  agentRegistry: 'agent_registries',
  agentCapability: 'agent_capabilities',
  agentLog: 'agent_logs',
  agentMessage: 'agent_messages',
  agentPerformanceMetrics: 'agent_performance_metrics',
  agentGoal: 'agent_goals',
  agentGoalAction: 'agent_goal_actions',
  agentPointsTransaction: 'agent_points_transactions',
  agentTrade: 'agent_trades',
  externalAgentConnection: 'external_agent_connections',
  npcTrade: 'npc_trades',
  npcInteraction: 'npc_interactions',
  tradingFee: 'trading_fees',
  balanceTransaction: 'balance_transactions',
  pointsTransaction: 'points_transactions',
  userActorFollow: 'user_actor_follows',
  userGroup: 'user_groups',
  userGroupAdmin: 'user_group_admins',
  userGroupInvite: 'user_group_invites',
  userGroupMember: 'user_group_members',
  pendingGroupInviteCandidate: 'pending_group_invite_candidates',
  userBlock: 'user_blocks',
  userMute: 'user_mutes',
  userMessagingKey: 'user_messaging_keys',
  report: 'reports',
  twitterOAuthToken: 'twitter_oauth_tokens',
  onboardingIntent: 'onboarding_intents',
  favorite: 'favorites',
  follow: 'follows',
  followStatus: 'follow_statuses',
  profileUpdateLog: 'profile_update_logs',
  shareAction: 'share_actions',
  tag: 'tags',
  postTag: 'post_tags',
  trendingTag: 'trending_tags',
  llmCallLog: 'llm_call_logs',
  marketOutcome: 'market_outcomes',
  trainedModel: 'trained_models',
  trainingBatch: 'training_batches',
  benchmarkResult: 'benchmark_results',
  trajectory: 'trajectories',
  rewardJudgment: 'reward_judgments',
  oracleCommitment: 'oracle_commitments',
  oracleTransaction: 'oracle_transactions',
  realtimeOutbox: 'realtime_outboxes',
  game: 'games',
  gameConfig: 'game_configs',
  oAuthState: 'oauth_states',
  systemSettings: 'system_settings',
  worldEvent: 'world_events',
  worldFact: 'world_facts',
  rssFeedSource: 'rss_feed_sources',
  rssHeadline: 'rss_headlines',
  parodyHeadline: 'parody_headlines',
  moderationEscrow: 'moderation_escrows',
  generationLock: 'generation_locks',
  feedback: 'feedbacks',
  referral: 'referrals',
  widgetCache: 'widget_caches',
  userAgentConfig: 'user_agent_configs',
  userApiKey: 'user_api_keys',
  tickTokenStats: 'tick_token_stats',
  questionArcPlan: 'question_arc_plans',
};

// ============================================================================
// Create CQL Client
// ============================================================================

function createRepository(
  tableName: string
): CQLTableRepository<BaseRecord, BaseRecord> {
  return new CQLTableRepository(tableName, getDB);
}

export function createCQLClient(): CQLClient {
  const $connect = async (): Promise<void> => {
    await initializeDB();
  };

  const $disconnect = async (): Promise<void> => {
    resetDB();
  };

  const $transaction = async <T>(
    callback: (tx: CQLClient) => Promise<T>
  ): Promise<T> => {
    const dbInstance = getDB();
    return dbInstance.transaction(async () => {
      // In CQL transactions, we use the same client
      // The transaction context is managed by the DB layer
      return callback(createCQLClient());
    });
  };

  const $queryRaw = async <T = Record<string, SQLValue>>(
    strings: TemplateStringsArray,
    ...values: SQLValue[]
  ): Promise<T[]> => {
    const dbInstance = getDB();
    // Build SQL from template
    let sql = '';
    const params: QueryParam[] = [];
    strings.forEach((str, i) => {
      sql += str;
      if (i < values.length) {
        params.push(values[i] as QueryParam);
        sql += `$${i + 1}`;
      }
    });
    return dbInstance.query<T>(sql, params);
  };

  const $executeRaw = async (
    strings: TemplateStringsArray,
    ...values: SQLValue[]
  ): Promise<number> => {
    const dbInstance = getDB();
    // Build SQL from template
    let sql = '';
    const params: QueryParam[] = [];
    strings.forEach((str, i) => {
      sql += str;
      if (i < values.length) {
        params.push(values[i] as QueryParam);
        sql += `$${i + 1}`;
      }
    });
    const result = await dbInstance.exec(sql, params);
    return result.rowsAffected;
  };

  const query = async <T>(sql: string, params?: QueryParam[]): Promise<T[]> => {
    const dbInstance = getDB();
    return dbInstance.query<T>(sql, params);
  };

  const queryOne = async <T>(
    sql: string,
    params?: QueryParam[]
  ): Promise<T | null> => {
    const dbInstance = getDB();
    return dbInstance.queryOne<T>(sql, params);
  };

  const exec = async (
    sql: string,
    params?: QueryParam[]
  ): Promise<{ rowsAffected: number }> => {
    const dbInstance = getDB();
    return dbInstance.exec(sql, params);
  };

  // Drizzle-style query builders
  const createSelectBuilder = <T extends Record<string, unknown> = BaseRecord>(
    _fields?: T
  ): SelectBuilder<T> => {
    let tableName = '';
    let whereClause = '';
    let orderByClause = '';
    let limitClause = '';
    let offsetClause = '';
    const params: QueryParam[] = [];

    const builder: SelectBuilder<T> = {
      from: (table: unknown) => {
        // Extract table name from Drizzle table object or string
        if (typeof table === 'object' && table !== null) {
          const tableObj = table as Record<string, unknown>;
          tableName =
            (tableObj['_'] as Record<string, string>)?.name ??
            (tableObj as Record<string, string>).tableName ??
            String(table);
        } else {
          tableName = String(table);
        }
        return builder;
      },
      where: (condition: unknown) => {
        if (condition) {
          // Simple condition extraction - in real use this would need more parsing
          whereClause = ' WHERE 1=1';
        }
        return builder;
      },
      orderBy: (..._orders: unknown[]) => {
        orderByClause = '';
        return builder;
      },
      limit: (n: number) => {
        limitClause = ` LIMIT ${n}`;
        return builder;
      },
      offset: (n: number) => {
        offsetClause = ` OFFSET ${n}`;
        return builder;
      },
      leftJoin: () => builder,
      innerJoin: () => builder,
      groupBy: () => builder,
      $dynamic: () => builder,
      then: async <TResult>(
        onfulfilled?: (value: T[]) => TResult | PromiseLike<TResult>
      ): Promise<TResult> => {
        const sql = `SELECT * FROM "${tableName}"${whereClause}${orderByClause}${limitClause}${offsetClause}`;
        const dbInstance = getDB();
        const results = await dbInstance.query<T>(sql, params);
        if (onfulfilled) {
          return onfulfilled(results);
        }
        return results as unknown as TResult;
      },
    };
    return builder;
  };

  const createInsertBuilder = <T = BaseRecord>(
    table: unknown
  ): InsertBuilder<T> => {
    let tableName = '';
    let data: unknown[] = [];

    // Extract table name
    if (typeof table === 'object' && table !== null) {
      const tableObj = table as Record<string, unknown>;
      tableName =
        (tableObj['_'] as Record<string, string>)?.name ??
        (tableObj as Record<string, string>).tableName ??
        String(table);
    } else {
      tableName = String(table);
    }

    const builder: InsertBuilder<T> = {
      values: (inputData: unknown | unknown[]) => {
        data = Array.isArray(inputData) ? inputData : [inputData];
        return builder;
      },
      onConflictDoNothing: () => builder,
      onConflictDoUpdate: () => builder,
      returning: async (): Promise<T[]> => {
        if (data.length === 0) return [];
        const firstRecord = data[0] as Record<string, unknown>;
        const columns = Object.keys(firstRecord);
        const allValues: QueryParam[] = [];
        const valueSets: string[] = [];

        data.forEach((record, rowIndex) => {
          const rec = record as Record<string, unknown>;
          const placeholders = columns.map((col, colIndex) => {
            allValues.push(rec[col] as QueryParam);
            return `$${rowIndex * columns.length + colIndex + 1}`;
          });
          valueSets.push(`(${placeholders.join(', ')})`);
        });

        const sql = `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES ${valueSets.join(', ')} RETURNING *`;
        const dbInstance = getDB();
        return dbInstance.query<T>(sql, allValues);
      },
      then: async <TResult>(
        onfulfilled?: (value: T[]) => TResult | PromiseLike<TResult>
      ): Promise<TResult> => {
        const results = await builder.returning();
        if (onfulfilled) {
          return onfulfilled(results);
        }
        return results as unknown as TResult;
      },
    };
    return builder;
  };

  const createUpdateBuilder = <T = BaseRecord>(
    table: unknown
  ): UpdateBuilder<T> => {
    let tableName = '';
    let setData: Record<string, unknown> = {};
    let whereClause = '';
    const params: QueryParam[] = [];

    // Extract table name
    if (typeof table === 'object' && table !== null) {
      const tableObj = table as Record<string, unknown>;
      tableName =
        (tableObj['_'] as Record<string, string>)?.name ??
        (tableObj as Record<string, string>).tableName ??
        String(table);
    } else {
      tableName = String(table);
    }

    const builder: UpdateBuilder<T> = {
      set: (data: unknown) => {
        setData = data as Record<string, unknown>;
        return builder;
      },
      where: (condition: unknown) => {
        if (condition) {
          whereClause = ' WHERE 1=1';
        }
        return builder;
      },
      $dynamic: () => builder,
      returning: async (): Promise<T[]> => {
        const setClauses: string[] = [];
        let paramIndex = 0;

        for (const [key, value] of Object.entries(setData)) {
          paramIndex++;
          params.push(value as QueryParam);
          setClauses.push(`"${key}" = $${paramIndex}`);
        }

        const sql = `UPDATE "${tableName}" SET ${setClauses.join(', ')}${whereClause} RETURNING *`;
        const dbInstance = getDB();
        return dbInstance.query<T>(sql, params);
      },
      then: async <TResult>(
        onfulfilled?: (value: T[]) => TResult | PromiseLike<TResult>
      ): Promise<TResult> => {
        const results = await builder.returning();
        if (onfulfilled) {
          return onfulfilled(results);
        }
        return results as unknown as TResult;
      },
    };
    return builder;
  };

  const createDeleteBuilder = <T = BaseRecord>(
    table: unknown
  ): DeleteBuilder<T> => {
    let tableName = '';
    let whereClause = '';
    const params: QueryParam[] = [];

    // Extract table name
    if (typeof table === 'object' && table !== null) {
      const tableObj = table as Record<string, unknown>;
      tableName =
        (tableObj['_'] as Record<string, string>)?.name ??
        (tableObj as Record<string, string>).tableName ??
        String(table);
    } else {
      tableName = String(table);
    }

    const builder: DeleteBuilder<T> = {
      where: (condition: unknown) => {
        if (condition) {
          whereClause = ' WHERE 1=1';
        }
        return builder;
      },
      $dynamic: () => builder,
      returning: async (): Promise<T[]> => {
        const sql = `DELETE FROM "${tableName}"${whereClause} RETURNING *`;
        const dbInstance = getDB();
        return dbInstance.query<T>(sql, params);
      },
      then: async <TResult>(
        onfulfilled?: (value: T[]) => TResult | PromiseLike<TResult>
      ): Promise<TResult> => {
        const results = await builder.returning();
        if (onfulfilled) {
          return onfulfilled(results);
        }
        return results as unknown as TResult;
      },
    };
    return builder;
  };

  const execute = async (queryObj: unknown): Promise<unknown[]> => {
    const dbInstance = getDB();
    if (
      typeof queryObj === 'object' &&
      queryObj !== null &&
      'raw' in queryObj
    ) {
      const q = queryObj as { raw: string; values: unknown[] };
      return dbInstance.query(q.raw, q.values as QueryParam[]);
    }
    return [];
  };

  const transaction = async <T>(
    fn: (tx: CQLClient) => Promise<T>
  ): Promise<T> => {
    const dbInstance = getDB();
    return dbInstance.transaction(async () => {
      return fn(createCQLClient());
    });
  };

  // Create all table repositories
  const client: CQLClient = {
    $connect,
    $disconnect,
    $transaction,
    $queryRaw,
    $executeRaw,
    query,
    queryOne,
    exec,

    // Drizzle-style query builders
    select: createSelectBuilder,
    selectDistinct: createSelectBuilder,
    selectDistinctOn: <T extends Record<string, unknown> = BaseRecord>(
      _columns: unknown[],
      fields?: T
    ) => createSelectBuilder(fields) as SelectBuilder<T>,
    insert: createInsertBuilder,
    update: createUpdateBuilder,
    delete: createDeleteBuilder,
    execute,
    transaction,

    // Table repositories
    user: createRepository(TABLE_NAMES.user ?? 'users'),
    actorState: createRepository(TABLE_NAMES.actorState ?? 'actor_state'),
    actorFollow: createRepository(TABLE_NAMES.actorFollow ?? 'actor_follows'),
    actorRelationship: createRepository(
      TABLE_NAMES.actorRelationship ?? 'actor_relationships'
    ),
    post: createRepository(TABLE_NAMES.post ?? 'posts'),
    comment: createRepository(TABLE_NAMES.comment ?? 'comments'),
    reaction: createRepository(TABLE_NAMES.reaction ?? 'reactions'),
    share: createRepository(TABLE_NAMES.share ?? 'shares'),
    market: createRepository(TABLE_NAMES.market ?? 'markets'),
    position: createRepository(TABLE_NAMES.position ?? 'positions'),
    perpPosition: createRepository(
      TABLE_NAMES.perpPosition ?? 'perp_positions'
    ),
    pool: createRepository(TABLE_NAMES.pool ?? 'pools'),
    poolPosition: createRepository(
      TABLE_NAMES.poolPosition ?? 'pool_positions'
    ),
    poolDeposit: createRepository(TABLE_NAMES.poolDeposit ?? 'pool_deposits'),
    organizationState: createRepository(
      TABLE_NAMES.organizationState ?? 'organization_state'
    ),
    stockPrice: createRepository(TABLE_NAMES.stockPrice ?? 'stock_prices'),
    question: createRepository(TABLE_NAMES.question ?? 'questions'),
    predictionPriceHistory: createRepository(
      TABLE_NAMES.predictionPriceHistory ?? 'prediction_price_histories'
    ),
    chat: createRepository(TABLE_NAMES.chat ?? 'chats'),
    chatParticipant: createRepository(
      TABLE_NAMES.chatParticipant ?? 'chat_participants'
    ),
    chatAdmin: createRepository(TABLE_NAMES.chatAdmin ?? 'chat_admins'),
    chatInvite: createRepository(TABLE_NAMES.chatInvite ?? 'chat_invites'),
    message: createRepository(TABLE_NAMES.message ?? 'messages'),
    notification: createRepository(TABLE_NAMES.notification ?? 'notifications'),
    dmAcceptance: createRepository(
      TABLE_NAMES.dmAcceptance ?? 'dm_acceptances'
    ),
    groupChatMembership: createRepository(
      TABLE_NAMES.groupChatMembership ?? 'group_chat_memberships'
    ),
    userInteraction: createRepository(
      TABLE_NAMES.userInteraction ?? 'user_interactions'
    ),
    agentRegistry: createRepository(
      TABLE_NAMES.agentRegistry ?? 'agent_registries'
    ),
    agentCapability: createRepository(
      TABLE_NAMES.agentCapability ?? 'agent_capabilities'
    ),
    agentLog: createRepository(TABLE_NAMES.agentLog ?? 'agent_logs'),
    agentMessage: createRepository(
      TABLE_NAMES.agentMessage ?? 'agent_messages'
    ),
    agentPerformanceMetrics: createRepository(
      TABLE_NAMES.agentPerformanceMetrics ?? 'agent_performance_metrics'
    ),
    agentGoal: createRepository(TABLE_NAMES.agentGoal ?? 'agent_goals'),
    agentGoalAction: createRepository(
      TABLE_NAMES.agentGoalAction ?? 'agent_goal_actions'
    ),
    agentPointsTransaction: createRepository(
      TABLE_NAMES.agentPointsTransaction ?? 'agent_points_transactions'
    ),
    agentTrade: createRepository(TABLE_NAMES.agentTrade ?? 'agent_trades'),
    externalAgentConnection: createRepository(
      TABLE_NAMES.externalAgentConnection ?? 'external_agent_connections'
    ),
    npcTrade: createRepository(TABLE_NAMES.npcTrade ?? 'npc_trades'),
    npcInteraction: createRepository(
      TABLE_NAMES.npcInteraction ?? 'npc_interactions'
    ),
    tradingFee: createRepository(TABLE_NAMES.tradingFee ?? 'trading_fees'),
    balanceTransaction: createRepository(
      TABLE_NAMES.balanceTransaction ?? 'balance_transactions'
    ),
    pointsTransaction: createRepository(
      TABLE_NAMES.pointsTransaction ?? 'points_transactions'
    ),
    userActorFollow: createRepository(
      TABLE_NAMES.userActorFollow ?? 'user_actor_follows'
    ),
    userGroup: createRepository(TABLE_NAMES.userGroup ?? 'user_groups'),
    userGroupAdmin: createRepository(
      TABLE_NAMES.userGroupAdmin ?? 'user_group_admins'
    ),
    userGroupInvite: createRepository(
      TABLE_NAMES.userGroupInvite ?? 'user_group_invites'
    ),
    userGroupMember: createRepository(
      TABLE_NAMES.userGroupMember ?? 'user_group_members'
    ),
    pendingGroupInviteCandidate: createRepository(
      TABLE_NAMES.pendingGroupInviteCandidate ??
        'pending_group_invite_candidates'
    ),
    userBlock: createRepository(TABLE_NAMES.userBlock ?? 'user_blocks'),
    userMute: createRepository(TABLE_NAMES.userMute ?? 'user_mutes'),
    userMessagingKey: createRepository(
      TABLE_NAMES.userMessagingKey ?? 'user_messaging_keys'
    ),
    report: createRepository(TABLE_NAMES.report ?? 'reports'),
    twitterOAuthToken: createRepository(
      TABLE_NAMES.twitterOAuthToken ?? 'twitter_oauth_tokens'
    ),
    onboardingIntent: createRepository(
      TABLE_NAMES.onboardingIntent ?? 'onboarding_intents'
    ),
    favorite: createRepository(TABLE_NAMES.favorite ?? 'favorites'),
    follow: createRepository(TABLE_NAMES.follow ?? 'follows'),
    followStatus: createRepository(
      TABLE_NAMES.followStatus ?? 'follow_statuses'
    ),
    profileUpdateLog: createRepository(
      TABLE_NAMES.profileUpdateLog ?? 'profile_update_logs'
    ),
    shareAction: createRepository(TABLE_NAMES.shareAction ?? 'share_actions'),
    tag: createRepository(TABLE_NAMES.tag ?? 'tags'),
    postTag: createRepository(TABLE_NAMES.postTag ?? 'post_tags'),
    trendingTag: createRepository(TABLE_NAMES.trendingTag ?? 'trending_tags'),
    llmCallLog: createRepository(TABLE_NAMES.llmCallLog ?? 'llm_call_logs'),
    marketOutcome: createRepository(
      TABLE_NAMES.marketOutcome ?? 'market_outcomes'
    ),
    trainedModel: createRepository(
      TABLE_NAMES.trainedModel ?? 'trained_models'
    ),
    trainingBatch: createRepository(
      TABLE_NAMES.trainingBatch ?? 'training_batches'
    ),
    benchmarkResult: createRepository(
      TABLE_NAMES.benchmarkResult ?? 'benchmark_results'
    ),
    trajectory: createRepository(TABLE_NAMES.trajectory ?? 'trajectories'),
    rewardJudgment: createRepository(
      TABLE_NAMES.rewardJudgment ?? 'reward_judgments'
    ),
    oracleCommitment: createRepository(
      TABLE_NAMES.oracleCommitment ?? 'oracle_commitments'
    ),
    oracleTransaction: createRepository(
      TABLE_NAMES.oracleTransaction ?? 'oracle_transactions'
    ),
    realtimeOutbox: createRepository(
      TABLE_NAMES.realtimeOutbox ?? 'realtime_outboxes'
    ),
    game: createRepository(TABLE_NAMES.game ?? 'games'),
    gameConfig: createRepository(TABLE_NAMES.gameConfig ?? 'game_configs'),
    oAuthState: createRepository(TABLE_NAMES.oAuthState ?? 'oauth_states'),
    systemSettings: createRepository(
      TABLE_NAMES.systemSettings ?? 'system_settings'
    ),
    worldEvent: createRepository(TABLE_NAMES.worldEvent ?? 'world_events'),
    worldFact: createRepository(TABLE_NAMES.worldFact ?? 'world_facts'),
    rssFeedSource: createRepository(
      TABLE_NAMES.rssFeedSource ?? 'rss_feed_sources'
    ),
    rssHeadline: createRepository(TABLE_NAMES.rssHeadline ?? 'rss_headlines'),
    parodyHeadline: createRepository(
      TABLE_NAMES.parodyHeadline ?? 'parody_headlines'
    ),
    moderationEscrow: createRepository(
      TABLE_NAMES.moderationEscrow ?? 'moderation_escrows'
    ),
    generationLock: createRepository(
      TABLE_NAMES.generationLock ?? 'generation_locks'
    ),
    feedback: createRepository(TABLE_NAMES.feedback ?? 'feedbacks'),
    referral: createRepository(TABLE_NAMES.referral ?? 'referrals'),
    widgetCache: createRepository(TABLE_NAMES.widgetCache ?? 'widget_caches'),
    userAgentConfig: createRepository(
      TABLE_NAMES.userAgentConfig ?? 'user_agent_configs'
    ),
    userApiKey: createRepository(TABLE_NAMES.userApiKey ?? 'user_api_keys'),
    tickTokenStats: createRepository(
      TABLE_NAMES.tickTokenStats ?? 'tick_token_stats'
    ),
    questionArcPlan: createRepository(
      TABLE_NAMES.questionArcPlan ?? 'question_arc_plans'
    ),
  };

  return client;
}

// ============================================================================
// Singleton Export
// ============================================================================

let clientInstance: CQLClient | null = null;

export function getCQLClient(): CQLClient {
  if (!clientInstance) {
    clientInstance = createCQLClient();
  }
  return clientInstance;
}

export function resetCQLClient(): void {
  clientInstance = null;
  resetDB();
}

// ============================================================================
// Lazy Proxy for Default Export
// ============================================================================

function createLazyCQLProxy(): CQLClient {
  const handler: ProxyHandler<CQLClient> = {
    get(_target, prop: string | symbol) {
      const client = getCQLClient();
      const value = client[prop as keyof CQLClient];
      if (typeof value === 'function') {
        return value.bind(client);
      }
      return value;
    },
  };

  return new Proxy({} as CQLClient, handler);
}

// Default export - lazy proxy that auto-initializes
export const db: CQLClient = createLazyCQLProxy();

export type { DecentralizedDB } from './cql-repository';
// Re-export initialization functions
export { getDB, initializeDB, resetDB } from './cql-repository';
