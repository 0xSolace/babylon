/**
 * CQL Database Client
 *
 * This is the PRIMARY database interface for Babylon.
 * ALL database operations go through CQL (CovenantSQL).
 *
 * API:
 * - Raw SQL: db.query(sql, params), db.exec(sql, params)
 * - Template literals: db.$queryRaw`SELECT * FROM users WHERE id = ${id}`
 * - Repositories: db.user.findUnique({ where: { id } })
 * - Transactions: db.transaction(async (tx) => { ... })
 * - Query builders: db.select().from(table).where(eq(col, val))
 */

import type { ExecResult, QueryParam } from '@jejunetwork/db'
import {
  CQLTableRepository,
  getDB,
  initializeDB,
  resetDB,
  type SQLValue,
} from './cql-repository'
import {
  isSQLExpression,
  type SQLCondition,
  type SQLExpression,
} from './sql-helpers'
import { getTableName, TABLE_NAMES } from './table-registry'

// ============================================================================
// Query Builder Types
// ============================================================================

type QueryBuilderSQLValue =
  | string
  | number
  | boolean
  | null
  | Date
  | bigint
  | string[]
  | number[]
  | boolean[]
  | undefined

interface TransactionExecutor {
  query<T>(sql: string, params?: QueryParam[]): Promise<T[]>
  queryOne<T>(sql: string, params?: QueryParam[]): Promise<T | null>
  exec(sql: string, params?: QueryParam[]): Promise<ExecResult>
}

// ============================================================================
// Type Definitions
// ============================================================================

/** Table input type - supports strings and table reference objects with optional schema */
type TableInput =
  | string
  | { _?: { name?: string }; readonly __schema?: unknown }
  | { _?: { name?: string }; readonly $inferSelect?: unknown }

/**
 * Helper type to extract non-undefined type from a union with undefined.
 * `Market | undefined` -> `Market`
 */
type ExcludeUndefined<T> = T extends undefined ? never : T

/**
 * Infer schema type from a table reference.
 * Supports multiple table reference patterns:
 * - TypedTable<TSchema> with __schema phantom property
 * - TypedTableRef<TSchema> with $inferSelect phantom property
 * - Plain objects with schema metadata
 *
 * The key insight is that optional properties like `__schema?: T` get inferred
 * as `T | undefined`, so we use ExcludeUndefined to extract the actual type.
 */
type InferTableSchema<T> =
  // Check for $inferSelect first (TypedTableRef pattern - more explicit)
  T extends { readonly $inferSelect: infer S }
    ? ExcludeUndefined<S> extends Record<string, unknown>
      ? ExcludeUndefined<S>
      : Record<string, unknown>
    : // Check for __schema property (TypedTable from table-registry pattern)
      T extends { readonly __schema?: infer S }
      ? ExcludeUndefined<S> extends Record<string, unknown>
        ? ExcludeUndefined<S>
        : Record<string, unknown>
      : // Fallback for string table names or untyped tables
        Record<string, unknown>

/**
 * Extract the column type from a TypedColumnRef.
 * TypedColumnRef<number> -> number
 *
 * Note: Uses NonNullable to handle the optional __columnType property.
 */
type InferColumnType<T> = T extends { __columnType?: infer V }
  ? NonNullable<V>
  : T extends { readonly __columnType?: infer V }
    ? NonNullable<V>
    : T

/**
 * Map a fields object to its result types by extracting column types.
 * { a: TypedColumnRef<string>, b: TypedColumnRef<number> } -> { a: string, b: number }
 */
type MapFieldsToTypes<T> = {
  [K in keyof T]: InferColumnType<T[K]>
}

// ============================================================================
// Query Builders
// ============================================================================

export class SelectBuilder<T> {
  private tableName: string
  private joinClauses: string[] = []
  private whereClause: string = ''
  private whereParams: QueryParam[] = []
  private orderByClause: string = ''
  private limitValue: number | null = null
  private offsetValue: number | null = null
  private executor: TransactionExecutor

  constructor(table: TableInput, executor: TransactionExecutor) {
    // TableInput is string | object, getTableName accepts both
    this.tableName = getTableName(table)
    this.executor = executor
  }

  where(condition: SQLCondition): this {
    const { sql, params } = condition.toSQL()
    this.whereClause = sql
    this.whereParams = params
    return this
  }

  orderBy(
    ...columns: Array<{ column: string; direction: 'asc' | 'desc' }>
  ): this {
    const parts: string[] = []
    for (const col of columns) {
      if (typeof col === 'object' && col !== null && 'column' in col) {
        parts.push(`"${col.column}" ${col.direction.toUpperCase()}`)
      }
    }
    if (parts.length > 0) {
      this.orderByClause = parts.join(', ')
    }
    return this
  }

  limit(n: number): this {
    this.limitValue = n
    return this
  }

  offset(n: number): this {
    this.offsetValue = n
    return this
  }

  leftJoin(table: object | string, _condition: SQLCondition): this {
    const tableName = getTableName(table)
    this.joinClauses.push(`LEFT JOIN "${tableName}" ON true`)
    return this
  }

  innerJoin(table: object | string, _condition: SQLCondition): this {
    const tableName = getTableName(table)
    this.joinClauses.push(`INNER JOIN "${tableName}" ON true`)
    return this
  }

  rightJoin(table: object | string, _condition: SQLCondition): this {
    const tableName = getTableName(table)
    this.joinClauses.push(`RIGHT JOIN "${tableName}" ON true`)
    return this
  }

  // biome-ignore lint/suspicious/noThenProperty: Intentional promise-like interface for compatibility
  async then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: Error) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    let sql = `SELECT * FROM "${this.tableName}"`
    if (this.joinClauses.length > 0) {
      sql += ` ${this.joinClauses.join(' ')}`
    }
    if (this.whereClause) {
      sql += ` WHERE ${this.whereClause}`
    }
    if (this.orderByClause) {
      sql += ` ORDER BY ${this.orderByClause}`
    }
    if (this.limitValue !== null) {
      sql += ` LIMIT ${this.limitValue}`
    }
    if (this.offsetValue !== null) {
      sql += ` OFFSET ${this.offsetValue}`
    }

    const result = await this.executor.query<T>(sql, this.whereParams)
    return onfulfilled ? onfulfilled(result) : (result as TResult1)
  }
}

type SetDataValue<T> = T | SQLExpression
type SetData<T> = { [K in keyof T]?: SetDataValue<T[K]> }

export class UpdateBuilder<T> {
  private tableName: string
  private setData: Record<string, QueryBuilderSQLValue | SQLExpression> = {}
  private whereClause: string = ''
  private whereParams: QueryParam[] = []
  private executor: TransactionExecutor

  constructor(table: object | string, executor: TransactionExecutor) {
    this.tableName = getTableName(table)
    this.executor = executor
  }

  set(data: SetData<T>): this {
    this.setData = data as Record<string, QueryBuilderSQLValue | SQLExpression>
    return this
  }

  where(condition: SQLCondition): this {
    const { sql, params } = condition.toSQL()
    this.whereClause = sql
    this.whereParams = params
    return this
  }

  returning(): Promise<T[]> {
    return this.execute()
  }

  private async execute(): Promise<T[]> {
    const columns = Object.keys(this.setData)
    const setClauses: string[] = []
    const values: QueryParam[] = []
    let paramIndex = 0

    for (const col of columns) {
      const value = this.setData[col]
      if (isSQLExpression(value)) {
        // SQL expression - inline it with adjusted placeholders
        let expr = value.template
        for (const v of value.values) {
          paramIndex++
          values.push(v)
          expr = expr.replace(/\$\d+/, `$${paramIndex}`)
        }
        setClauses.push(`"${col}" = ${expr}`)
      } else {
        paramIndex++
        values.push(toQueryParam(value))
        setClauses.push(`"${col}" = $${paramIndex}`)
      }
    }

    // Adjust where clause parameter placeholders
    const adjustedWhere = this.whereClause.replace(
      /\$(\d+)/g,
      (_, num) => `$${parseInt(num, 10) + paramIndex}`,
    )

    let sql = `UPDATE "${this.tableName}" SET ${setClauses.join(', ')}`
    if (adjustedWhere) {
      sql += ` WHERE ${adjustedWhere}`
    }
    sql += ' RETURNING *'

    return this.executor.query<T>(sql, [...values, ...this.whereParams])
  }

  // biome-ignore lint/suspicious/noThenProperty: Intentional promise-like interface for compatibility
  async then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: Error) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const result = await this.execute()
    return onfulfilled ? onfulfilled(result) : (result as TResult1)
  }
}

export class InsertBuilder<T> {
  private tableName: string
  private data: Record<string, QueryBuilderSQLValue>[] = []
  private executor: TransactionExecutor
  private conflictAction: 'nothing' | 'update' | null = null
  private conflictSet: Record<string, QueryBuilderSQLValue | SQLExpression> = {}

  constructor(table: object | string, executor: TransactionExecutor) {
    this.tableName = getTableName(table)
    this.executor = executor
  }

  values(data: Partial<T> | Partial<T>[]): this {
    this.data = (Array.isArray(data) ? data : [data]) as Record<
      string,
      QueryBuilderSQLValue
    >[]
    return this
  }

  onConflictDoNothing(_options?: { target?: object }): this {
    this.conflictAction = 'nothing'
    return this
  }

  onConflictDoUpdate(options: { target?: object; set: SetData<T> }): this {
    this.conflictAction = 'update'
    this.conflictSet = options.set as Record<
      string,
      QueryBuilderSQLValue | SQLExpression
    >
    return this
  }

  returning(): Promise<T[]> {
    return this.execute()
  }

  private async execute(): Promise<T[]> {
    if (this.data.length === 0) return []

    const firstRecord = this.data[0]
    if (!firstRecord) return []

    const columns = Object.keys(firstRecord)
    const allValues: QueryParam[] = []
    const valueSets: string[] = []

    this.data.forEach((record, rowIndex) => {
      const placeholders = columns.map((col, colIndex) => {
        allValues.push(toQueryParam(record[col]))
        return `$${rowIndex * columns.length + colIndex + 1}`
      })
      valueSets.push(`(${placeholders.join(', ')})`)
    })

    let sql = `INSERT INTO "${this.tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES ${valueSets.join(', ')}`

    if (this.conflictAction === 'nothing') {
      sql += ' ON CONFLICT DO NOTHING'
    } else if (
      this.conflictAction === 'update' &&
      Object.keys(this.conflictSet).length > 0
    ) {
      const setClauses: string[] = []
      for (const [key, value] of Object.entries(this.conflictSet)) {
        if (isSQLExpression(value)) {
          setClauses.push(`"${key}" = EXCLUDED."${key}"`)
        } else {
          allValues.push(toQueryParam(value))
          setClauses.push(`"${key}" = $${allValues.length}`)
        }
      }
      sql += ` ON CONFLICT DO UPDATE SET ${setClauses.join(', ')}`
    }

    sql += ' RETURNING *'
    return this.executor.query<T>(sql, allValues)
  }

  // biome-ignore lint/suspicious/noThenProperty: Intentional promise-like interface for compatibility
  async then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: Error) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const result = await this.execute()
    return onfulfilled ? onfulfilled(result) : (result as TResult1)
  }
}

export class DeleteBuilder<T> {
  private tableName: string
  private whereClause: string = ''
  private whereParams: QueryParam[] = []
  private executor: TransactionExecutor

  constructor(table: object | string, executor: TransactionExecutor) {
    this.tableName = getTableName(table)
    this.executor = executor
  }

  where(condition: SQLCondition): this {
    const { sql, params } = condition.toSQL()
    this.whereClause = sql
    this.whereParams = params
    return this
  }

  returning(): Promise<T[]> {
    return this.execute()
  }

  private async execute(): Promise<T[]> {
    let sql = `DELETE FROM "${this.tableName}"`
    if (this.whereClause) {
      sql += ` WHERE ${this.whereClause}`
    }
    sql += ' RETURNING *'

    return this.executor.query<T>(sql, this.whereParams)
  }

  // biome-ignore lint/suspicious/noThenProperty: Intentional promise-like interface for compatibility
  async then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: Error) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const result = await this.execute()
    return onfulfilled ? onfulfilled(result) : (result as TResult1)
  }
}

// ============================================================================
// Query Transaction
// ============================================================================

class QueryTransaction implements TransactionExecutor {
  private executor: TransactionExecutor

  constructor(executor: TransactionExecutor) {
    this.executor = executor
  }

  query<T>(sql: string, params?: QueryParam[]): Promise<T[]> {
    return this.executor.query<T>(sql, params)
  }

  queryOne<T>(sql: string, params?: QueryParam[]): Promise<T | null> {
    return this.executor.queryOne<T>(sql, params)
  }

  exec(sql: string, params?: QueryParam[]): Promise<ExecResult> {
    return this.executor.exec(sql, params)
  }

  select<TFields extends Record<string, unknown> | undefined = undefined>(
    fields?: TFields,
  ): {
    from: <TTable extends TableInput>(
      table: TTable,
    ) => SelectBuilder<
      TFields extends Record<string, unknown>
        ? MapFieldsToTypes<TFields>
        : InferTableSchema<TTable>
    >
  } {
    void fields // Fields used for column selection
    return {
      from: <TTable extends TableInput>(table: TTable) =>
        new SelectBuilder<
          TFields extends Record<string, unknown>
            ? MapFieldsToTypes<TFields>
            : InferTableSchema<TTable>
        >(table, this),
    }
  }

  update<T>(table: object | string): UpdateBuilder<T> {
    return new UpdateBuilder<T>(table, this)
  }

  insert<T>(table: object | string): InsertBuilder<T> {
    return new InsertBuilder<T>(table, this)
  }

  delete<T>(table: object | string): DeleteBuilder<T> {
    return new DeleteBuilder<T>(table, this)
  }
}

export function createQueryTransaction(
  executor: TransactionExecutor,
): QueryTransaction {
  return new QueryTransaction(executor)
}

export { QueryTransaction }

export type { InferTableSchema, TableInput }

// ============================================================================
// Table Type Definitions
// ============================================================================

type Repo<TSelect, TInsert = Partial<TSelect>> = CQLTableRepository<
  TSelect,
  TInsert
>

function toQueryParam(value: SQLValue | undefined): QueryParam {
  if (value === undefined || value === null) {
    return null
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value as QueryParam
  }

  if (value instanceof Uint8Array) {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return JSON.stringify(value)
}

// ============================================================================
// CQL Client Interface
// ============================================================================

// Import schema types from cql-schema-types for repository typing
import type * as SchemaTypes from './cql-schema-types'

export interface CQLClient {
  // Connection management
  $connect: () => Promise<void>
  $disconnect: () => Promise<void>

  // Raw query methods (template literal)
  $queryRaw: <T = Record<string, SQLValue>>(
    strings: TemplateStringsArray,
    ...values: SQLValue[]
  ) => Promise<T[]>
  $executeRaw: (
    strings: TemplateStringsArray,
    ...values: SQLValue[]
  ) => Promise<number>

  // Direct SQL methods
  query: <T>(sql: string, params?: QueryParam[]) => Promise<T[]>
  queryOne: <T>(sql: string, params?: QueryParam[]) => Promise<T | null>
  exec: (
    sql: string,
    params?: QueryParam[],
  ) => Promise<{ rowsAffected: number }>

  // Transaction support
  transaction: <T>(fn: (tx: CQLClient) => Promise<T>) => Promise<T>

  // Query builders - use typed tables for proper type inference
  select: <TFields extends Record<string, unknown> | undefined = undefined>(
    fields?: TFields,
  ) => {
    from: <TTable extends TableInput>(
      table: TTable,
    ) => SelectBuilder<
      TFields extends Record<string, unknown>
        ? MapFieldsToTypes<TFields>
        : InferTableSchema<TTable>
    >
  }
  selectDistinct: <
    TFields extends Record<string, unknown> | undefined = undefined,
  >(
    fields?: TFields,
  ) => {
    from: <TTable extends TableInput>(
      table: TTable,
    ) => SelectBuilder<
      TFields extends Record<string, unknown>
        ? MapFieldsToTypes<TFields>
        : InferTableSchema<TTable>
    >
  }
  selectDistinctOn: <
    TFields extends Record<string, unknown> | undefined = undefined,
  >(
    columns: unknown[],
    fields?: TFields,
  ) => {
    from: <TTable extends TableInput>(
      table: TTable,
    ) => SelectBuilder<
      TFields extends Record<string, unknown>
        ? MapFieldsToTypes<TFields>
        : InferTableSchema<TTable>
    >
  }
  insert: <T extends Record<string, unknown> = Record<string, unknown>>(
    table: object | string,
  ) => InsertBuilder<T>
  update: <T extends Record<string, unknown> = Record<string, unknown>>(
    table: object | string,
  ) => UpdateBuilder<T>
  delete: <T extends Record<string, unknown> = Record<string, unknown>>(
    table: object | string,
  ) => DeleteBuilder<T>

  // Table repositories (Prisma-like API)
  user: Repo<SchemaTypes.User, SchemaTypes.UserInsert>
  actorState: Repo<SchemaTypes.ActorStateRow>
  actorFollow: Repo<SchemaTypes.ActorFollow>
  actorRelationship: Repo<SchemaTypes.ActorRelationship>
  post: Repo<SchemaTypes.Post, SchemaTypes.PostInsert>
  comment: Repo<SchemaTypes.Comment>
  reaction: Repo<SchemaTypes.Reaction>
  share: Repo<SchemaTypes.Share>
  market: Repo<SchemaTypes.Market, SchemaTypes.MarketInsert>
  position: Repo<SchemaTypes.Position, SchemaTypes.PositionInsert>
  perpPosition: Repo<SchemaTypes.PerpPosition>
  perpMarketSnapshot: Repo<SchemaTypes.PerpMarketSnapshot>
  pool: Repo<SchemaTypes.Pool>
  poolPosition: Repo<SchemaTypes.PoolPosition>
  poolDeposit: Repo<SchemaTypes.PoolDeposit>
  organizationState: Repo<SchemaTypes.OrganizationStateRow>
  stockPrice: Repo<SchemaTypes.StockPrice>
  question: Repo<SchemaTypes.Question>
  predictionPriceHistory: Repo<SchemaTypes.PredictionPriceHistory>
  chat: Repo<SchemaTypes.Chat, SchemaTypes.ChatInsert>
  chatParticipant: Repo<SchemaTypes.ChatParticipant>
  chatAdmin: Repo<SchemaTypes.ChatAdmin>
  chatInvite: Repo<SchemaTypes.ChatInvite>
  message: Repo<SchemaTypes.Message, SchemaTypes.MessageInsert>
  notification: Repo<SchemaTypes.Notification, SchemaTypes.NotificationInsert>
  dmAcceptance: Repo<SchemaTypes.DMAcceptance>
  groupChatMembership: Repo<SchemaTypes.GroupChatMembership>
  userInteraction: Repo<SchemaTypes.UserInteraction>
  agentRegistry: Repo<
    SchemaTypes.AgentRegistry,
    SchemaTypes.AgentRegistryInsert
  >
  agentCapability: Repo<SchemaTypes.AgentCapability>
  agentLog: Repo<SchemaTypes.AgentLog, SchemaTypes.AgentLogInsert>
  agentMessage: Repo<SchemaTypes.AgentMessage, SchemaTypes.AgentMessageInsert>
  agentPerformanceMetrics: Repo<SchemaTypes.AgentPerformanceMetrics>
  agentGoal: Repo<SchemaTypes.AgentGoal>
  agentGoalAction: Repo<SchemaTypes.AgentGoalAction>
  agentPointsTransaction: Repo<SchemaTypes.AgentPointsTransaction>
  agentTrade: Repo<SchemaTypes.AgentTrade>
  externalAgentConnection: Repo<SchemaTypes.ExternalAgentConnection>
  dailyEngagement: Repo<SchemaTypes.DailyEngagement>
  npcTrade: Repo<SchemaTypes.NPCTrade>
  npcInteraction: Repo<SchemaTypes.NPCInteraction>
  tradingFee: Repo<SchemaTypes.TradingFee>
  balanceTransaction: Repo<SchemaTypes.BalanceTransaction>
  pointsTransaction: Repo<SchemaTypes.PointsTransaction>
  userActorFollow: Repo<SchemaTypes.UserActorFollow>
  userGroup: Repo<SchemaTypes.UserGroup>
  userGroupAdmin: Repo<SchemaTypes.UserGroupAdmin>
  userGroupInvite: Repo<SchemaTypes.UserGroupInvite>
  userGroupMember: Repo<SchemaTypes.UserGroupMember>
  pendingGroupInviteCandidate: Repo<SchemaTypes.PendingGroupInviteCandidate>
  userBlock: Repo<SchemaTypes.UserBlock>
  userMute: Repo<SchemaTypes.UserMute>
  userMessagingKey: Repo<SchemaTypes.UserMessagingKey>
  report: Repo<SchemaTypes.Report>
  twitterOAuthToken: Repo<SchemaTypes.TwitterOAuthToken>
  onboardingIntent: Repo<SchemaTypes.OnboardingIntent>
  favorite: Repo<SchemaTypes.Favorite>
  follow: Repo<SchemaTypes.Follow>
  followStatus: Repo<SchemaTypes.FollowStatus>
  profileUpdateLog: Repo<SchemaTypes.ProfileUpdateLog>
  shareAction: Repo<SchemaTypes.ShareAction>
  tag: Repo<SchemaTypes.Tag>
  postTag: Repo<SchemaTypes.PostTag>
  trendingTag: Repo<SchemaTypes.TrendingTag>
  llmCallLog: Repo<SchemaTypes.LlmCallLog>
  marketOutcome: Repo<SchemaTypes.MarketOutcome>
  trainedModel: Repo<SchemaTypes.TrainedModel>
  trainingBatch: Repo<SchemaTypes.TrainingBatch>
  benchmarkResult: Repo<SchemaTypes.BenchmarkResult>
  trajectory: Repo<SchemaTypes.Trajectory>
  rewardJudgment: Repo<SchemaTypes.RewardJudgment>
  oracleCommitment: Repo<SchemaTypes.OracleCommitment>
  oracleTransaction: Repo<SchemaTypes.OracleTransaction>
  realtimeOutbox: Repo<SchemaTypes.RealtimeOutbox>
  game: Repo<SchemaTypes.Game>
  gameConfig: Repo<SchemaTypes.GameConfig>
  oAuthState: Repo<SchemaTypes.OAuthState>
  systemSettings: Repo<SchemaTypes.SystemSettings>
  worldEvent: Repo<SchemaTypes.WorldEvent>
  worldFact: Repo<SchemaTypes.WorldFact>
  rssFeedSource: Repo<SchemaTypes.RSSFeedSource>
  rssHeadline: Repo<SchemaTypes.RSSHeadline>
  parodyHeadline: Repo<SchemaTypes.ParodyHeadline>
  moderationEscrow: Repo<SchemaTypes.ModerationEscrow>
  generationLock: Repo<SchemaTypes.GenerationLock>
  feedback: Repo<SchemaTypes.Feedback>
  referral: Repo<SchemaTypes.Referral>
  widgetCache: Repo<SchemaTypes.WidgetCache>
  userAgentConfig: Repo<SchemaTypes.UserAgentConfig>
  userApiKey: Repo<SchemaTypes.UserApiKey>
  tickTokenStats: Repo<SchemaTypes.TickTokenStats>
  questionArcPlan: Repo<SchemaTypes.QuestionArcPlan>
}

// ============================================================================
// Create CQL Client
// ============================================================================

// Factory for creating typed repositories
function repo<TSelect, TInsert = Partial<TSelect>>(
  tableName: string,
): Repo<TSelect, TInsert> {
  return new CQLTableRepository<TSelect, TInsert>(tableName, getDB)
}

export function createCQLClient(): CQLClient {
  const $connect = async (): Promise<void> => {
    await initializeDB()
  }

  const $disconnect = async (): Promise<void> => {
    resetDB()
  }

  const $queryRaw = async <T = Record<string, SQLValue>>(
    strings: TemplateStringsArray,
    ...values: SQLValue[]
  ): Promise<T[]> => {
    const dbInstance = getDB()
    let sql = ''
    const params: QueryParam[] = []
    strings.forEach((str, i) => {
      sql += str
      if (i < values.length) {
        const value = values[i]
        if (value === undefined) {
          throw new Error('[CQL] Missing parameter value for $queryRaw')
        }
        params.push(toQueryParam(value))
        sql += `$${i + 1}`
      }
    })
    return dbInstance.query<T>(sql, params)
  }

  const $executeRaw = async (
    strings: TemplateStringsArray,
    ...values: SQLValue[]
  ): Promise<number> => {
    const dbInstance = getDB()
    let sql = ''
    const params: QueryParam[] = []
    strings.forEach((str, i) => {
      sql += str
      if (i < values.length) {
        const value = values[i]
        if (value === undefined) {
          throw new Error('[CQL] Missing parameter value for $executeRaw')
        }
        params.push(toQueryParam(value))
        sql += `$${i + 1}`
      }
    })
    const result = await dbInstance.exec(sql, params)
    return result.rowsAffected
  }

  const query = async <T>(sql: string, params?: QueryParam[]): Promise<T[]> => {
    return getDB().query<T>(sql, params)
  }

  const queryOne = async <T>(
    sql: string,
    params?: QueryParam[],
  ): Promise<T | null> => {
    return getDB().queryOne<T>(sql, params)
  }

  const exec = async (
    sql: string,
    params?: QueryParam[],
  ): Promise<{ rowsAffected: number }> => {
    return getDB().exec(sql, params)
  }

  const transaction = async <T>(
    fn: (tx: CQLClient) => Promise<T>,
  ): Promise<T> => {
    return getDB().transaction(async () => {
      return fn(client)
    })
  }

  // Create executor for QueryTransaction
  const createExecutor = () => ({
    query: <T>(sql: string, params?: QueryParam[]): Promise<T[]> =>
      getDB().query<T>(sql, params),
    queryOne: <T>(sql: string, params?: QueryParam[]): Promise<T | null> =>
      getDB().queryOne<T>(sql, params),
    exec: (sql: string, params?: QueryParam[]) => getDB().exec(sql, params),
  })

  // Query builders delegate to QueryTransaction which parses conditions
  const queryTx = createQueryTransaction(createExecutor())

  const client: CQLClient = {
    $connect,
    $disconnect,
    $queryRaw,
    $executeRaw,
    query,
    queryOne,
    exec,
    transaction,

    // Query builders (delegate to query transaction with type assertions)
    select: queryTx.select.bind(queryTx) as CQLClient['select'],
    selectDistinct: queryTx.select.bind(queryTx) as CQLClient['selectDistinct'],
    selectDistinctOn: (<
      T extends Record<string, unknown> = Record<string, unknown>,
    >(
      _columns: unknown[],
      _fields?: T,
    ) => queryTx.select(_fields)) as CQLClient['selectDistinctOn'],
    insert: queryTx.insert.bind(queryTx) as CQLClient['insert'],
    update: queryTx.update.bind(queryTx) as CQLClient['update'],
    delete: queryTx.delete.bind(queryTx) as CQLClient['delete'],

    // Table repositories
    user: repo<SchemaTypes.User, SchemaTypes.UserInsert>(TABLE_NAMES.users),
    actorState: repo<SchemaTypes.ActorStateRow>(TABLE_NAMES.actorState),
    actorFollow: repo<SchemaTypes.ActorFollow>(TABLE_NAMES.actorFollows),
    actorRelationship: repo<SchemaTypes.ActorRelationship>(
      TABLE_NAMES.actorRelationships,
    ),
    post: repo<SchemaTypes.Post, SchemaTypes.PostInsert>(TABLE_NAMES.posts),
    comment: repo<SchemaTypes.Comment>(TABLE_NAMES.comments),
    reaction: repo<SchemaTypes.Reaction>(TABLE_NAMES.reactions),
    share: repo<SchemaTypes.Share>(TABLE_NAMES.shares),
    market: repo<SchemaTypes.Market, SchemaTypes.MarketInsert>(
      TABLE_NAMES.markets,
    ),
    position: repo<SchemaTypes.Position, SchemaTypes.PositionInsert>(
      TABLE_NAMES.positions,
    ),
    perpPosition: repo<SchemaTypes.PerpPosition>(TABLE_NAMES.perpPositions),
    perpMarketSnapshot: repo<SchemaTypes.PerpMarketSnapshot>(
      TABLE_NAMES.perpMarketSnapshots,
    ),
    pool: repo<SchemaTypes.Pool>(TABLE_NAMES.pools),
    poolPosition: repo<SchemaTypes.PoolPosition>(TABLE_NAMES.poolPositions),
    poolDeposit: repo<SchemaTypes.PoolDeposit>(TABLE_NAMES.poolDeposits),
    organizationState: repo<SchemaTypes.OrganizationStateRow>(
      TABLE_NAMES.organizationState,
    ),
    stockPrice: repo<SchemaTypes.StockPrice>(TABLE_NAMES.stockPrices),
    question: repo<SchemaTypes.Question>(TABLE_NAMES.questions),
    predictionPriceHistory: repo<SchemaTypes.PredictionPriceHistory>(
      TABLE_NAMES.predictionPriceHistories,
    ),
    chat: repo<SchemaTypes.Chat, SchemaTypes.ChatInsert>(TABLE_NAMES.chats),
    chatParticipant: repo<SchemaTypes.ChatParticipant>(
      TABLE_NAMES.chatParticipants,
    ),
    chatAdmin: repo<SchemaTypes.ChatAdmin>(TABLE_NAMES.chatAdmins),
    chatInvite: repo<SchemaTypes.ChatInvite>(TABLE_NAMES.chatInvites),
    message: repo<SchemaTypes.Message, SchemaTypes.MessageInsert>(
      TABLE_NAMES.messages,
    ),
    notification: repo<
      SchemaTypes.Notification,
      SchemaTypes.NotificationInsert
    >(TABLE_NAMES.notifications),
    dmAcceptance: repo<SchemaTypes.DMAcceptance>(TABLE_NAMES.dmAcceptances),
    groupChatMembership: repo<SchemaTypes.GroupChatMembership>(
      TABLE_NAMES.groupChatMemberships,
    ),
    userInteraction: repo<SchemaTypes.UserInteraction>(
      TABLE_NAMES.userInteractions,
    ),
    agentRegistry: repo<
      SchemaTypes.AgentRegistry,
      SchemaTypes.AgentRegistryInsert
    >(TABLE_NAMES.agentRegistries),
    agentCapability: repo<SchemaTypes.AgentCapability>(
      TABLE_NAMES.agentCapabilities,
    ),
    agentLog: repo<SchemaTypes.AgentLog, SchemaTypes.AgentLogInsert>(
      TABLE_NAMES.agentLogs,
    ),
    agentMessage: repo<
      SchemaTypes.AgentMessage,
      SchemaTypes.AgentMessageInsert
    >(TABLE_NAMES.agentMessages),
    agentPerformanceMetrics: repo<SchemaTypes.AgentPerformanceMetrics>(
      TABLE_NAMES.agentPerformanceMetrics,
    ),
    agentGoal: repo<SchemaTypes.AgentGoal>(TABLE_NAMES.agentGoals),
    agentGoalAction: repo<SchemaTypes.AgentGoalAction>(
      TABLE_NAMES.agentGoalActions,
    ),
    agentPointsTransaction: repo<SchemaTypes.AgentPointsTransaction>(
      TABLE_NAMES.agentPointsTransactions,
    ),
    agentTrade: repo<SchemaTypes.AgentTrade>(TABLE_NAMES.agentTrades),
    externalAgentConnection: repo<SchemaTypes.ExternalAgentConnection>(
      TABLE_NAMES.externalAgentConnections,
    ),
    dailyEngagement: repo<SchemaTypes.DailyEngagement>(
      TABLE_NAMES.dailyEngagement,
    ),
    npcTrade: repo<SchemaTypes.NPCTrade>(TABLE_NAMES.npcTrades),
    npcInteraction: repo<SchemaTypes.NPCInteraction>(
      TABLE_NAMES.npcInteractions,
    ),
    tradingFee: repo<SchemaTypes.TradingFee>(TABLE_NAMES.tradingFees),
    balanceTransaction: repo<SchemaTypes.BalanceTransaction>(
      TABLE_NAMES.balanceTransactions,
    ),
    pointsTransaction: repo<SchemaTypes.PointsTransaction>(
      TABLE_NAMES.pointsTransactions,
    ),
    userActorFollow: repo<SchemaTypes.UserActorFollow>(
      TABLE_NAMES.userActorFollows,
    ),
    userGroup: repo<SchemaTypes.UserGroup>(TABLE_NAMES.userGroups),
    userGroupAdmin: repo<SchemaTypes.UserGroupAdmin>(
      TABLE_NAMES.userGroupAdmins,
    ),
    userGroupInvite: repo<SchemaTypes.UserGroupInvite>(
      TABLE_NAMES.userGroupInvites,
    ),
    userGroupMember: repo<SchemaTypes.UserGroupMember>(
      TABLE_NAMES.userGroupMembers,
    ),
    pendingGroupInviteCandidate: repo<SchemaTypes.PendingGroupInviteCandidate>(
      TABLE_NAMES.pendingGroupInviteCandidates,
    ),
    userBlock: repo<SchemaTypes.UserBlock>(TABLE_NAMES.userBlocks),
    userMute: repo<SchemaTypes.UserMute>(TABLE_NAMES.userMutes),
    userMessagingKey: repo<SchemaTypes.UserMessagingKey>(
      TABLE_NAMES.userMessagingKeys,
    ),
    report: repo<SchemaTypes.Report>(TABLE_NAMES.reports),
    twitterOAuthToken: repo<SchemaTypes.TwitterOAuthToken>(
      TABLE_NAMES.twitterOAuthTokens,
    ),
    onboardingIntent: repo<SchemaTypes.OnboardingIntent>(
      TABLE_NAMES.onboardingIntents,
    ),
    favorite: repo<SchemaTypes.Favorite>(TABLE_NAMES.favorites),
    follow: repo<SchemaTypes.Follow>(TABLE_NAMES.follows),
    followStatus: repo<SchemaTypes.FollowStatus>(TABLE_NAMES.followStatuses),
    profileUpdateLog: repo<SchemaTypes.ProfileUpdateLog>(
      TABLE_NAMES.profileUpdateLogs,
    ),
    shareAction: repo<SchemaTypes.ShareAction>(TABLE_NAMES.shareActions),
    tag: repo<SchemaTypes.Tag>(TABLE_NAMES.tags),
    postTag: repo<SchemaTypes.PostTag>(TABLE_NAMES.postTags),
    trendingTag: repo<SchemaTypes.TrendingTag>(TABLE_NAMES.trendingTags),
    llmCallLog: repo<SchemaTypes.LlmCallLog>(TABLE_NAMES.llmCallLogs),
    marketOutcome: repo<SchemaTypes.MarketOutcome>(TABLE_NAMES.marketOutcomes),
    trainedModel: repo<SchemaTypes.TrainedModel>(TABLE_NAMES.trainedModels),
    trainingBatch: repo<SchemaTypes.TrainingBatch>(TABLE_NAMES.trainingBatches),
    benchmarkResult: repo<SchemaTypes.BenchmarkResult>(
      TABLE_NAMES.benchmarkResults,
    ),
    trajectory: repo<SchemaTypes.Trajectory>(TABLE_NAMES.trajectories),
    rewardJudgment: repo<SchemaTypes.RewardJudgment>(
      TABLE_NAMES.rewardJudgments,
    ),
    oracleCommitment: repo<SchemaTypes.OracleCommitment>(
      TABLE_NAMES.oracleCommitments,
    ),
    oracleTransaction: repo<SchemaTypes.OracleTransaction>(
      TABLE_NAMES.oracleTransactions,
    ),
    realtimeOutbox: repo<SchemaTypes.RealtimeOutbox>(
      TABLE_NAMES.realtimeOutboxes,
    ),
    game: repo<SchemaTypes.Game>(TABLE_NAMES.games),
    gameConfig: repo<SchemaTypes.GameConfig>(TABLE_NAMES.gameConfigs),
    oAuthState: repo<SchemaTypes.OAuthState>(TABLE_NAMES.oAuthStates),
    systemSettings: repo<SchemaTypes.SystemSettings>(
      TABLE_NAMES.systemSettings,
    ),
    worldEvent: repo<SchemaTypes.WorldEvent>(TABLE_NAMES.worldEvents),
    worldFact: repo<SchemaTypes.WorldFact>(TABLE_NAMES.worldFacts),
    rssFeedSource: repo<SchemaTypes.RSSFeedSource>(TABLE_NAMES.rssFeedSources),
    rssHeadline: repo<SchemaTypes.RSSHeadline>(TABLE_NAMES.rssHeadlines),
    parodyHeadline: repo<SchemaTypes.ParodyHeadline>(
      TABLE_NAMES.parodyHeadlines,
    ),
    moderationEscrow: repo<SchemaTypes.ModerationEscrow>(
      TABLE_NAMES.moderationEscrows,
    ),
    generationLock: repo<SchemaTypes.GenerationLock>(
      TABLE_NAMES.generationLocks,
    ),
    feedback: repo<SchemaTypes.Feedback>(TABLE_NAMES.feedbacks),
    referral: repo<SchemaTypes.Referral>(TABLE_NAMES.referrals),
    widgetCache: repo<SchemaTypes.WidgetCache>(TABLE_NAMES.widgetCaches),
    userAgentConfig: repo<SchemaTypes.UserAgentConfig>(
      TABLE_NAMES.userAgentConfigs,
    ),
    userApiKey: repo<SchemaTypes.UserApiKey>(TABLE_NAMES.userApiKeys),
    tickTokenStats: repo<SchemaTypes.TickTokenStats>(
      TABLE_NAMES.tickTokenStats,
    ),
    questionArcPlan: repo<SchemaTypes.QuestionArcPlan>(
      TABLE_NAMES.questionArcPlans,
    ),
  }

  return client
}

// ============================================================================
// Singleton Export
// ============================================================================

let clientInstance: CQLClient | null = null

export function getCQLClient(): CQLClient {
  if (!clientInstance) {
    clientInstance = createCQLClient()
  }
  return clientInstance
}

export function resetCQLClient(): void {
  clientInstance = null
  resetDB()
}

// ============================================================================
// Lazy Proxy for Default Export
// ============================================================================

function createLazyCQLProxy(): CQLClient {
  const handler: ProxyHandler<CQLClient> = {
    get(_target, prop: string | symbol) {
      const client = getCQLClient()
      const value = client[prop as keyof CQLClient]
      if (typeof value === 'function') {
        return value.bind(client)
      }
      return value
    },
  }

  return new Proxy({} as CQLClient, handler)
}

export const db: CQLClient = createLazyCQLProxy()
