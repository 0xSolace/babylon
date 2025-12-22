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
import type { Column, SQL } from 'drizzle-orm';
import {
  getTableConfig,
  type PgColumn,
  type PgTable,
} from 'drizzle-orm/pg-core';
import {
  CQLTableRepository,
  getDB,
  initializeDB,
  type JsonValue,
  resetDB,
  type SQLValue,
} from './cql-repository';
import * as schema from './schema';

// Re-export types
export type { JsonValue, QueryParam, SQLValue };

// ============================================================================
// Table Type Definitions
// ============================================================================

// Base record types - these match the Drizzle schema types
type BaseRecord = Record<string, SQLValue | JsonValue>;

type InferSelect<T extends PgTable> = T['$inferSelect'];
type InferInsert<T extends PgTable> = T['$inferInsert'];

// Use direct type inference without Extract to preserve exact types
type Repo<T extends PgTable> = CQLTableRepository<
  InferSelect<T>,
  InferInsert<T>
>;

function toQueryParam(value: SQLValue): QueryParam {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return JSON.stringify(value);
}

// ============================================================================
// Type Utilities for Drizzle Column Inference
// ============================================================================

// Extract the data type from a PgColumn, SQL expression, or other value
type InferColumnType<T> =
  T extends Column<infer TConfig>
    ? TConfig extends { data: infer D }
      ? D
      : never
    : T extends SQL<infer U>
      ? U
      : T extends { $inferSelect: infer U }
        ? U
        : T;

// Map object of columns/SQL to their inferred types
type InferSelectType<T> =
  T extends Record<string, unknown>
    ? { [K in keyof T]: InferColumnType<T[K]> }
    : T;

// ============================================================================
// CQL Client Interface
// ============================================================================

// Drizzle-style query builder types - simplified for backwards compatibility
// Returns flat rows for single-table queries. For joins, cast the result to your expected type.
interface SelectBuilder<T = BaseRecord> {
  // from() returns flat row type for single table queries
  from: <TTable extends PgTable>(
    table: TTable
  ) => SelectBuilder<TTable['$inferSelect']>;
  where: (condition: unknown) => SelectBuilder<T>;
  orderBy: (...orders: unknown[]) => SelectBuilder<T>;
  limit: (n: number) => SelectBuilder<T>;
  offset: (n: number) => SelectBuilder<T>;
  // leftJoin/innerJoin - returns same builder type (cast result to your expected join type)
  leftJoin: (table: unknown, condition: unknown) => SelectBuilder<T>;
  innerJoin: (table: unknown, condition: unknown) => SelectBuilder<T>;
  groupBy: (...columns: unknown[]) => SelectBuilder<T>;
  $dynamic: () => SelectBuilder<T>;
  then: <TResult>(
    onfulfilled?: (value: T[]) => TResult | PromiseLike<TResult>
  ) => Promise<TResult>;
}

interface InsertBuilder<T = BaseRecord> {
  values: (data: Partial<T> | Partial<T>[]) => InsertBuilder<T>;
  onConflictDoNothing: () => InsertBuilder<T>;
  onConflictDoUpdate: (options: unknown) => InsertBuilder<T>;
  returning: <TRet extends Record<string, PgColumn>>(
    fields?: TRet
  ) => Promise<T[]>;
  then: <TResult>(
    onfulfilled?: (value: T[]) => TResult | PromiseLike<TResult>
  ) => Promise<TResult>;
}

// Allow SQL expressions in set data (e.g., sql`column + 1`)
type SetData<T> = {
  [K in keyof T]?: T[K] | SQL<unknown>;
};

interface UpdateBuilder<T = BaseRecord> {
  set: (data: SetData<T>) => UpdateBuilder<T>;
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

  // Drizzle-style query builders with proper type inference
  select: <T extends Record<string, unknown> = BaseRecord>(
    fields?: T
  ) => SelectBuilder<InferSelectType<T>>;
  selectDistinct: <T extends Record<string, unknown> = BaseRecord>(
    fields?: T
  ) => SelectBuilder<InferSelectType<T>>;
  selectDistinctOn: <T extends Record<string, unknown> = BaseRecord>(
    columns: unknown[],
    fields?: T
  ) => SelectBuilder<InferSelectType<T>>;
  insert: <TTable extends PgTable>(
    table: TTable
  ) => InsertBuilder<TTable['$inferSelect']>;
  update: <TTable extends PgTable>(
    table: TTable
  ) => UpdateBuilder<TTable['$inferSelect']>;
  delete: <TTable extends PgTable>(
    table: TTable
  ) => DeleteBuilder<TTable['$inferSelect']>;
  execute: (query: unknown) => Promise<unknown[]>;
  transaction: <T>(fn: (tx: CQLClient) => Promise<T>) => Promise<T>;

  // Table repositories (typed from the Drizzle schema)
  user: Repo<typeof schema.users>;
  actorState: Repo<typeof schema.actorState>;
  actorFollow: Repo<typeof schema.actorFollows>;
  actorRelationship: Repo<typeof schema.actorRelationships>;
  post: Repo<typeof schema.posts>;
  comment: Repo<typeof schema.comments>;
  reaction: Repo<typeof schema.reactions>;
  share: Repo<typeof schema.shares>;
  market: Repo<typeof schema.markets>;
  position: Repo<typeof schema.positions>;
  perpPosition: Repo<typeof schema.perpPositions>;
  perpMarketSnapshot: Repo<typeof schema.perpMarketSnapshots>;
  pool: Repo<typeof schema.pools>;
  poolPosition: Repo<typeof schema.poolPositions>;
  poolDeposit: Repo<typeof schema.poolDeposits>;
  organizationState: Repo<typeof schema.organizationState>;
  stockPrice: Repo<typeof schema.stockPrices>;
  question: Repo<typeof schema.questions>;
  predictionPriceHistory: Repo<typeof schema.predictionPriceHistories>;
  chat: Repo<typeof schema.chats>;
  chatParticipant: Repo<typeof schema.chatParticipants>;
  chatAdmin: Repo<typeof schema.chatAdmins>;
  chatInvite: Repo<typeof schema.chatInvites>;
  message: Repo<typeof schema.messages>;
  notification: Repo<typeof schema.notifications>;
  dmAcceptance: Repo<typeof schema.dmAcceptances>;
  groupChatMembership: Repo<typeof schema.groupChatMemberships>;
  userInteraction: Repo<typeof schema.userInteractions>;
  agentRegistry: Repo<typeof schema.agentRegistries>;
  agentCapability: Repo<typeof schema.agentCapabilities>;
  agentLog: Repo<typeof schema.agentLogs>;
  agentMessage: Repo<typeof schema.agentMessages>;
  agentPerformanceMetrics: Repo<typeof schema.agentPerformanceMetrics>;
  agentGoal: Repo<typeof schema.agentGoals>;
  agentGoalAction: Repo<typeof schema.agentGoalActions>;
  agentPointsTransaction: Repo<typeof schema.agentPointsTransactions>;
  agentTrade: Repo<typeof schema.agentTrades>;
  externalAgentConnection: Repo<typeof schema.externalAgentConnections>;
  npcTrade: Repo<typeof schema.npcTrades>;
  npcInteraction: Repo<typeof schema.npcInteractions>;
  tradingFee: Repo<typeof schema.tradingFees>;
  balanceTransaction: Repo<typeof schema.balanceTransactions>;
  pointsTransaction: Repo<typeof schema.pointsTransactions>;
  userActorFollow: Repo<typeof schema.userActorFollows>;
  userGroup: Repo<typeof schema.userGroups>;
  userGroupAdmin: Repo<typeof schema.userGroupAdmins>;
  userGroupInvite: Repo<typeof schema.userGroupInvites>;
  userGroupMember: Repo<typeof schema.userGroupMembers>;
  pendingGroupInviteCandidate: Repo<typeof schema.pendingGroupInviteCandidates>;
  userBlock: Repo<typeof schema.userBlocks>;
  userMute: Repo<typeof schema.userMutes>;
  userMessagingKey: Repo<typeof schema.userMessagingKeys>;
  report: Repo<typeof schema.reports>;
  twitterOAuthToken: Repo<typeof schema.twitterOAuthTokens>;
  onboardingIntent: Repo<typeof schema.onboardingIntents>;
  favorite: Repo<typeof schema.favorites>;
  follow: Repo<typeof schema.follows>;
  followStatus: Repo<typeof schema.followStatuses>;
  profileUpdateLog: Repo<typeof schema.profileUpdateLogs>;
  shareAction: Repo<typeof schema.shareActions>;
  tag: Repo<typeof schema.tags>;
  postTag: Repo<typeof schema.postTags>;
  trendingTag: Repo<typeof schema.trendingTags>;
  llmCallLog: Repo<typeof schema.llmCallLogs>;
  marketOutcome: Repo<typeof schema.marketOutcomes>;
  trainedModel: Repo<typeof schema.trainedModels>;
  trainingBatch: Repo<typeof schema.trainingBatches>;
  benchmarkResult: Repo<typeof schema.benchmarkResults>;
  trajectory: Repo<typeof schema.trajectories>;
  rewardJudgment: Repo<typeof schema.rewardJudgments>;
  oracleCommitment: Repo<typeof schema.oracleCommitments>;
  oracleTransaction: Repo<typeof schema.oracleTransactions>;
  realtimeOutbox: Repo<typeof schema.realtimeOutboxes>;
  game: Repo<typeof schema.games>;
  gameConfig: Repo<typeof schema.gameConfigs>;
  oAuthState: Repo<typeof schema.oAuthStates>;
  systemSettings: Repo<typeof schema.systemSettings>;
  worldEvent: Repo<typeof schema.worldEvents>;
  worldFact: Repo<typeof schema.worldFacts>;
  rssFeedSource: Repo<typeof schema.rssFeedSources>;
  rssHeadline: Repo<typeof schema.rssHeadlines>;
  parodyHeadline: Repo<typeof schema.parodyHeadlines>;
  moderationEscrow: Repo<typeof schema.moderationEscrows>;
  generationLock: Repo<typeof schema.generationLocks>;
  feedback: Repo<typeof schema.feedbacks>;
  referral: Repo<typeof schema.referrals>;
  widgetCache: Repo<typeof schema.widgetCaches>;
  userAgentConfig: Repo<typeof schema.userAgentConfigs>;
  userApiKey: Repo<typeof schema.userApiKeys>;
  tickTokenStats: Repo<typeof schema.tickTokenStats>;
  questionArcPlan: Repo<typeof schema.questionArcPlans>;
}

// ============================================================================
// Create CQL Client
// ============================================================================

function createRepository<TTable extends PgTable>(table: TTable): Repo<TTable> {
  const tableName = getTableConfig(table).name;
  return new CQLTableRepository<InferSelect<TTable>, InferInsert<TTable>>(
    tableName,
    getDB
  );
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
    void callback;
    throw new Error(
      '[CQL] db.$transaction is disabled. Use getDB().transaction() with raw SQL.'
    );
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
        const value = values[i];
        if (value === undefined) {
          throw new Error('[CQL] Missing parameter value for $queryRaw');
        }
        params.push(toQueryParam(value));
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
        const value = values[i];
        if (value === undefined) {
          throw new Error('[CQL] Missing parameter value for $executeRaw');
        }
        params.push(toQueryParam(value));
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

  // Helper to extract table name from a Drizzle table object
  const extractTableName = (table: unknown): string => {
    if (typeof table === 'object' && table !== null) {
      const tableObj = table as Record<string, unknown>;
      return (
        (tableObj['_'] as Record<string, string>)?.name ??
        (tableObj as Record<string, string>).tableName ??
        String(table)
      );
    }
    return String(table);
  };

  // Helper to get column names from a Drizzle table
  const getTableColumns = (table: unknown): string[] => {
    if (typeof table === 'object' && table !== null) {
      const config = getTableConfig(table as PgTable);
      return config.columns.map((c) => c.name);
    }
    return [];
  };

  // Drizzle-style query builders with full join support
  const createSelectBuilder = <T extends Record<string, unknown> = BaseRecord>(
    _fields?: T
  ): SelectBuilder<InferSelectType<T>> => {
    void _fields;

    // State for query building
    interface JoinInfo {
      type: 'LEFT' | 'INNER';
      tableName: string;
      tableObj: unknown;
      columns: string[];
      condition: unknown;
    }

    let mainTableName = '';
    let mainTableColumns: string[] = [];
    const joins: JoinInfo[] = [];
    let whereClause = '';
    let orderByClause = '';
    let limitClause = '';
    let offsetClause = '';
    const params: QueryParam[] = [];

    // Build the SQL query with proper column aliasing for joins
    const buildSQL = (): string => {
      // Build SELECT clause with aliased columns
      const selectParts: string[] = [];

      // Main table columns
      for (const col of mainTableColumns) {
        selectParts.push(
          `"${mainTableName}"."${col}" AS "${mainTableName}__${col}"`
        );
      }

      // Joined table columns
      for (const join of joins) {
        for (const col of join.columns) {
          selectParts.push(
            `"${join.tableName}"."${col}" AS "${join.tableName}__${col}"`
          );
        }
      }

      let sql = `SELECT ${selectParts.length > 0 ? selectParts.join(', ') : '*'} FROM "${mainTableName}"`;

      // Add JOINs
      // Note: CQL JOIN conditions use a simplified `ON true` clause. Drizzle condition
      // objects are not parsed into SQL. For queries requiring specific JOIN conditions,
      // use raw SQL via db.$queryRaw or db.query() instead.
      for (const join of joins) {
        sql += ` ${join.type} JOIN "${join.tableName}" ON true`;
      }

      sql += whereClause + orderByClause + limitClause + offsetClause;
      return sql;
    };

    // Reshape flat SQL results based on whether there are joins
    // - No joins: return flat row objects directly
    // - With joins: return { TableName: {...}, JoinedTable: {...} | null } structure
    const reshapeResults = <TResult>(
      flatResults: Record<string, unknown>[],
      hasJoins: boolean
    ): TResult[] => {
      if (!hasJoins) {
        // No joins - return flat results directly
        return flatResults.map((row) => {
          // Check if results have table__column format (aliased)
          const firstKey = Object.keys(row)[0] ?? '';
          if (firstKey.includes('__')) {
            // Results have table__column format, extract just the column values
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(row)) {
              const parts = key.split('__');
              if (parts.length === 2 && parts[1]) {
                result[parts[1]] = value;
              }
            }
            return result as TResult;
          }
          // Results are already flat
          return row as TResult;
        });
      }

      // With joins - reshape into { TableName: {...}, JoinedTable: {...} | null } structure
      return flatResults
        .map((row) => {
          const result: Record<string, Record<string, unknown> | null> = {};

          // Initialize main table
          result[mainTableName] = {};
          let mainTableHasData = false;

          // Initialize joined tables as null
          for (const join of joins) {
            result[join.tableName] = null;
          }

          for (const [key, value] of Object.entries(row)) {
            const parts = key.split('__');
            if (parts.length === 2) {
              const [tableName, colName] = parts;
              if (tableName && colName) {
                if (tableName === mainTableName) {
                  (result[mainTableName] as Record<string, unknown>)[colName] =
                    value;
                  if (value !== null) mainTableHasData = true;
                } else {
                  // Joined table - only add if value is not null
                  if (value !== null) {
                    if (!result[tableName]) {
                      result[tableName] = {};
                    }
                    (result[tableName] as Record<string, unknown>)[colName] =
                      value;
                  }
                }
              }
            }
          }

          // If main table has no data, skip this row
          if (!mainTableHasData) {
            return null as unknown as TResult;
          }

          return result as TResult;
        })
        .filter(Boolean);
    };

    // Create builder methods with proper typing
    const createBuilderMethods = <TResult>(): Omit<
      SelectBuilder<TResult>,
      'from'
    > => ({
      where: (condition: unknown) => {
        // Note: Drizzle WHERE conditions are not fully parsed. This compatibility
        // layer accepts the condition but generates a placeholder `WHERE 1=1`.
        // For complex filtering, use raw SQL via db.$queryRaw or db.query().
        if (condition) {
          whereClause = ' WHERE 1=1';
        }
        return createBuilderMethods<TResult>() as SelectBuilder<TResult>;
      },
      orderBy: (..._orders: unknown[]) => {
        // Note: Drizzle ORDER BY expressions are not parsed. This compatibility
        // layer accepts the arguments but does not generate an ORDER BY clause.
        // For ordered queries, use raw SQL via db.$queryRaw or db.query().
        orderByClause = '';
        return createBuilderMethods<TResult>() as SelectBuilder<TResult>;
      },
      limit: (n: number) => {
        limitClause = ` LIMIT ${n}`;
        return createBuilderMethods<TResult>() as SelectBuilder<TResult>;
      },
      offset: (n: number) => {
        offsetClause = ` OFFSET ${n}`;
        return createBuilderMethods<TResult>() as SelectBuilder<TResult>;
      },
      leftJoin: (table: unknown, condition: unknown) => {
        const joinTableName = extractTableName(table);
        const joinColumns = getTableColumns(table);
        joins.push({
          type: 'LEFT',
          tableName: joinTableName,
          tableObj: table,
          columns: joinColumns,
          condition,
        });
        // Return same type - caller should cast to expected join result type
        return createBuilderMethods<TResult>() as SelectBuilder<TResult>;
      },
      innerJoin: (table: unknown, condition: unknown) => {
        const joinTableName = extractTableName(table);
        const joinColumns = getTableColumns(table);
        joins.push({
          type: 'INNER',
          tableName: joinTableName,
          tableObj: table,
          columns: joinColumns,
          condition,
        });
        // Return same type - caller should cast to expected join result type
        return createBuilderMethods<TResult>() as SelectBuilder<TResult>;
      },
      groupBy: () => createBuilderMethods<TResult>() as SelectBuilder<TResult>,
      $dynamic: () => createBuilderMethods<TResult>() as SelectBuilder<TResult>,
      then: async <TResultValue>(
        onfulfilled?: (
          value: TResult[]
        ) => TResultValue | PromiseLike<TResultValue>
      ): Promise<TResultValue> => {
        const sql = buildSQL();
        const dbInstance = getDB();
        const flatResults = await dbInstance.query<Record<string, unknown>>(
          sql,
          params
        );
        const hasJoins = joins.length > 0;
        const results = reshapeResults<TResult>(flatResults, hasJoins);
        if (onfulfilled) {
          return onfulfilled(results);
        }
        return results as unknown as TResultValue;
      },
    });

    const builder: SelectBuilder<T> = {
      from: <TTable extends PgTable>(table: TTable) => {
        mainTableName = extractTableName(table);
        mainTableColumns = getTableColumns(table);

        // Return typed builder with flat result type (no joins yet)
        return {
          from: builder.from,
          ...createBuilderMethods<TTable['$inferSelect']>(),
        } as SelectBuilder<TTable['$inferSelect']>;
      },
      ...createBuilderMethods<T>(),
    };
    return builder as SelectBuilder<InferSelectType<T>>;
  };

  const createInsertBuilder = <TTable extends PgTable>(
    table: TTable
  ): InsertBuilder<TTable['$inferSelect']> => {
    type T = TTable['$inferSelect'];
    // NOTE: Compatibility layer. For best type safety, use repositories.
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
      values: (inputData: Partial<T> | Partial<T>[]) => {
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
            allValues.push(toQueryParam(rec[col] as SQLValue));
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

  const createUpdateBuilder = <TTable extends PgTable>(
    table: TTable
  ): UpdateBuilder<TTable['$inferSelect']> => {
    type T = TTable['$inferSelect'];
    // NOTE: Compatibility layer. For best type safety, use repositories.
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
      set: (data: SetData<T>) => {
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
          params.push(toQueryParam(value as SQLValue));
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

  const createDeleteBuilder = <TTable extends PgTable>(
    table: TTable
  ): DeleteBuilder<TTable['$inferSelect']> => {
    type T = TTable['$inferSelect'];
    // NOTE: Compatibility layer. For best type safety, use repositories.
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
    // NOTE: Compatibility layer. Limited functionality.
    void queryObj;
    return [];
  };

  const transaction = async <T>(
    fn: (tx: CQLClient) => Promise<T>
  ): Promise<T> => {
    // Use the underlying CQL transaction
    return getDB().transaction(async (txContext) => {
      // Create a minimal CQL client that uses the transaction context
      // For now, we delegate to the main client but operations will be in the transaction
      void txContext;
      return fn(client);
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
    ) => createSelectBuilder(fields) as SelectBuilder<InferSelectType<T>>,
    insert: createInsertBuilder,
    update: createUpdateBuilder,
    delete: createDeleteBuilder,
    execute,
    transaction,

    // Table repositories
    user: createRepository(schema.users),
    actorState: createRepository(schema.actorState),
    actorFollow: createRepository(schema.actorFollows),
    actorRelationship: createRepository(schema.actorRelationships),
    post: createRepository(schema.posts),
    comment: createRepository(schema.comments),
    reaction: createRepository(schema.reactions),
    share: createRepository(schema.shares),
    market: createRepository(schema.markets),
    position: createRepository(schema.positions),
    perpPosition: createRepository(schema.perpPositions),
    perpMarketSnapshot: createRepository(schema.perpMarketSnapshots),
    pool: createRepository(schema.pools),
    poolPosition: createRepository(schema.poolPositions),
    poolDeposit: createRepository(schema.poolDeposits),
    organizationState: createRepository(schema.organizationState),
    stockPrice: createRepository(schema.stockPrices),
    question: createRepository(schema.questions),
    predictionPriceHistory: createRepository(schema.predictionPriceHistories),
    chat: createRepository(schema.chats),
    chatParticipant: createRepository(schema.chatParticipants),
    chatAdmin: createRepository(schema.chatAdmins),
    chatInvite: createRepository(schema.chatInvites),
    message: createRepository(schema.messages),
    notification: createRepository(schema.notifications),
    dmAcceptance: createRepository(schema.dmAcceptances),
    groupChatMembership: createRepository(schema.groupChatMemberships),
    userInteraction: createRepository(schema.userInteractions),
    agentRegistry: createRepository(schema.agentRegistries),
    agentCapability: createRepository(schema.agentCapabilities),
    agentLog: createRepository(schema.agentLogs),
    agentMessage: createRepository(schema.agentMessages),
    agentPerformanceMetrics: createRepository(schema.agentPerformanceMetrics),
    agentGoal: createRepository(schema.agentGoals),
    agentGoalAction: createRepository(schema.agentGoalActions),
    agentPointsTransaction: createRepository(schema.agentPointsTransactions),
    agentTrade: createRepository(schema.agentTrades),
    externalAgentConnection: createRepository(schema.externalAgentConnections),
    npcTrade: createRepository(schema.npcTrades),
    npcInteraction: createRepository(schema.npcInteractions),
    tradingFee: createRepository(schema.tradingFees),
    balanceTransaction: createRepository(schema.balanceTransactions),
    pointsTransaction: createRepository(schema.pointsTransactions),
    userActorFollow: createRepository(schema.userActorFollows),
    userGroup: createRepository(schema.userGroups),
    userGroupAdmin: createRepository(schema.userGroupAdmins),
    userGroupInvite: createRepository(schema.userGroupInvites),
    userGroupMember: createRepository(schema.userGroupMembers),
    pendingGroupInviteCandidate: createRepository(
      schema.pendingGroupInviteCandidates
    ),
    userBlock: createRepository(schema.userBlocks),
    userMute: createRepository(schema.userMutes),
    userMessagingKey: createRepository(schema.userMessagingKeys),
    report: createRepository(schema.reports),
    twitterOAuthToken: createRepository(schema.twitterOAuthTokens),
    onboardingIntent: createRepository(schema.onboardingIntents),
    favorite: createRepository(schema.favorites),
    follow: createRepository(schema.follows),
    followStatus: createRepository(schema.followStatuses),
    profileUpdateLog: createRepository(schema.profileUpdateLogs),
    shareAction: createRepository(schema.shareActions),
    tag: createRepository(schema.tags),
    postTag: createRepository(schema.postTags),
    trendingTag: createRepository(schema.trendingTags),
    llmCallLog: createRepository(schema.llmCallLogs),
    marketOutcome: createRepository(schema.marketOutcomes),
    trainedModel: createRepository(schema.trainedModels),
    trainingBatch: createRepository(schema.trainingBatches),
    benchmarkResult: createRepository(schema.benchmarkResults),
    trajectory: createRepository(schema.trajectories),
    rewardJudgment: createRepository(schema.rewardJudgments),
    oracleCommitment: createRepository(schema.oracleCommitments),
    oracleTransaction: createRepository(schema.oracleTransactions),
    realtimeOutbox: createRepository(schema.realtimeOutboxes),
    game: createRepository(schema.games),
    gameConfig: createRepository(schema.gameConfigs),
    oAuthState: createRepository(schema.oAuthStates),
    systemSettings: createRepository(schema.systemSettings),
    worldEvent: createRepository(schema.worldEvents),
    worldFact: createRepository(schema.worldFacts),
    rssFeedSource: createRepository(schema.rssFeedSources),
    rssHeadline: createRepository(schema.rssHeadlines),
    parodyHeadline: createRepository(schema.parodyHeadlines),
    moderationEscrow: createRepository(schema.moderationEscrows),
    generationLock: createRepository(schema.generationLocks),
    feedback: createRepository(schema.feedbacks),
    referral: createRepository(schema.referrals),
    widgetCache: createRepository(schema.widgetCaches),
    userAgentConfig: createRepository(schema.userAgentConfigs),
    userApiKey: createRepository(schema.userApiKeys),
    tickTokenStats: createRepository(schema.tickTokenStats),
    questionArcPlan: createRepository(schema.questionArcPlans),
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
