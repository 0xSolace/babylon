/**
 * Drizzle-Compatible Query Builders
 *
 * Provides Drizzle-like query builders that translate to raw SQL.
 * This allows gradual migration from Drizzle without changing existing code patterns.
 */

import type { QueryParam } from '@jejunetwork/db'
import { getTableName } from '../table-registry'
import { isColumnRef as isColumnRefFromGuards } from '../type-guards'

// ============================================================================
// Types
// ============================================================================

export type SQLValue =
  | string
  | number
  | boolean
  | null
  | Date
  | bigint
  | Uint8Array
  | Record<string, unknown>
  | SQLValue[]

type Executor = {
  query: <T>(sql: string, params?: QueryParam[]) => Promise<T[]>
  queryOne: <T>(sql: string, params?: QueryParam[]) => Promise<T | null>
  exec: (
    sql: string,
    params?: QueryParam[],
  ) => Promise<{ rowsAffected: number }>
}

// ============================================================================
// SQL Condition Types
// ============================================================================

interface SQLCondition {
  readonly type:
    | 'eq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'like'
    | 'ilike'
    | 'in'
    | 'notIn'
    | 'isNull'
    | 'isNotNull'
    | 'and'
    | 'or'
    | 'not'
    | 'between'
    | 'raw'
  readonly column?: string
  readonly value?: SQLValue
  readonly values?: SQLValue[]
  readonly conditions?: SQLCondition[]
  readonly sql?: string
  readonly params?: QueryParam[]
}

// ============================================================================
// Column Input Type
// ============================================================================

/** Column input - accepts string, object with name, or undefined from index access */
type ColumnInput = string | { name: string } | undefined

/** Get column name from various input types */
function getColName(column: ColumnInput): string {
  if (!column) throw new Error('Column reference is undefined')
  return typeof column === 'string' ? column : column.name
}

// ============================================================================
// Condition Builders
// ============================================================================

export function eq<T extends SQLValue>(
  column: ColumnInput,
  value: T,
): SQLCondition {
  return { type: 'eq', column: getColName(column), value }
}

export function ne<T extends SQLValue>(
  column: ColumnInput,
  value: T,
): SQLCondition {
  return { type: 'ne', column: getColName(column), value }
}

export function gt<T extends SQLValue>(
  column: ColumnInput,
  value: T,
): SQLCondition {
  return { type: 'gt', column: getColName(column), value }
}

export function gte<T extends SQLValue>(
  column: ColumnInput,
  value: T,
): SQLCondition {
  return { type: 'gte', column: getColName(column), value }
}

export function lt<T extends SQLValue>(
  column: ColumnInput,
  value: T,
): SQLCondition {
  return { type: 'lt', column: getColName(column), value }
}

export function lte<T extends SQLValue>(
  column: ColumnInput,
  value: T,
): SQLCondition {
  return { type: 'lte', column: getColName(column), value }
}

export function like(column: ColumnInput, pattern: string): SQLCondition {
  return { type: 'like', column: getColName(column), value: pattern }
}

export function ilike(column: ColumnInput, pattern: string): SQLCondition {
  return { type: 'ilike', column: getColName(column), value: pattern }
}

export function inArray<T extends SQLValue>(
  column: ColumnInput,
  values: T[],
): SQLCondition {
  return {
    type: 'in',
    column: getColName(column),
    values,
  }
}

export function notInArray<T extends SQLValue>(
  column: ColumnInput,
  values: T[],
): SQLCondition {
  return {
    type: 'notIn',
    column: getColName(column),
    values,
  }
}

export function isNull(column: ColumnInput): SQLCondition {
  return { type: 'isNull', column: getColName(column) }
}

export function isNotNull(column: ColumnInput): SQLCondition {
  return { type: 'isNotNull', column: getColName(column) }
}

export function between<T extends SQLValue>(
  column: ColumnInput,
  min: T,
  max: T,
): SQLCondition {
  return {
    type: 'between',
    column: getColName(column),
    values: [min, max],
  }
}

export function and(...conditions: (SQLCondition | undefined)[]): SQLCondition {
  const filtered = conditions.filter((c): c is SQLCondition => c !== undefined)
  return { type: 'and', conditions: filtered }
}

export function or(...conditions: (SQLCondition | undefined)[]): SQLCondition {
  const filtered = conditions.filter((c): c is SQLCondition => c !== undefined)
  return { type: 'or', conditions: filtered }
}

export function not(condition: SQLCondition): SQLCondition {
  return { type: 'not', conditions: [condition] }
}

/** Column reference type */
interface ColumnRef {
  name: string
}

// Use isColumnRef from type-guards
const isColumnRef = isColumnRefFromGuards

export function sql(
  strings: TemplateStringsArray,
  ...values: (SQLValue | ColumnRef | undefined)[]
): SQLCondition {
  let sqlStr = ''
  const params: QueryParam[] = []
  let paramIndex = 1

  strings.forEach((str, i) => {
    sqlStr += str
    const val = values[i]
    if (val !== undefined && val !== null) {
      // Column references are embedded directly as quoted identifiers
      if (isColumnRef(val)) {
        sqlStr += `"${val.name}"`
      } else {
        // val is SQLValue at this point (not ColumnRef, not undefined, not null)
        params.push(toQueryParam(val as SQLValue))
        sqlStr += `$${paramIndex++}`
      }
    }
  })

  return { type: 'raw', sql: sqlStr, params }
}

// ============================================================================
// Parameter Conversion
// ============================================================================

function toQueryParam(value: SQLValue): QueryParam {
  if (value === null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value
  if (value instanceof Uint8Array) return value
  if (value instanceof Date) return value.toISOString()
  return JSON.stringify(value)
}

// ============================================================================
// Condition Serialization
// ============================================================================

interface SerializedCondition {
  sql: string
  params: QueryParam[]
}

function serializeCondition(
  condition: SQLCondition,
  paramOffset: number,
): SerializedCondition {
  // Guard against undefined/null conditions
  if (!condition || condition.type === undefined) {
    return { sql: '1=1', params: [] }
  }

  const idx = paramOffset
  const params: QueryParam[] = []

  switch (condition.type) {
    case 'eq':
      params.push(toQueryParam(condition.value ?? null))
      return { sql: `"${condition.column}" = $${idx}`, params }

    case 'ne':
      params.push(toQueryParam(condition.value ?? null))
      return { sql: `"${condition.column}" != $${idx}`, params }

    case 'gt':
      params.push(toQueryParam(condition.value ?? null))
      return { sql: `"${condition.column}" > $${idx}`, params }

    case 'gte':
      params.push(toQueryParam(condition.value ?? null))
      return { sql: `"${condition.column}" >= $${idx}`, params }

    case 'lt':
      params.push(toQueryParam(condition.value ?? null))
      return { sql: `"${condition.column}" < $${idx}`, params }

    case 'lte':
      params.push(toQueryParam(condition.value ?? null))
      return { sql: `"${condition.column}" <= $${idx}`, params }

    case 'like':
      params.push(toQueryParam(condition.value ?? null))
      return { sql: `"${condition.column}" LIKE $${idx}`, params }

    case 'ilike':
      params.push(toQueryParam(condition.value ?? null))
      return { sql: `LOWER("${condition.column}") LIKE LOWER($${idx})`, params }

    case 'in': {
      const values = condition.values ?? []
      const placeholders = values.map((v, i) => {
        params.push(toQueryParam(v))
        return `$${idx + i}`
      })
      return {
        sql: `"${condition.column}" IN (${placeholders.join(', ')})`,
        params,
      }
    }

    case 'notIn': {
      const values = condition.values ?? []
      const placeholders = values.map((v, i) => {
        params.push(toQueryParam(v))
        return `$${idx + i}`
      })
      return {
        sql: `"${condition.column}" NOT IN (${placeholders.join(', ')})`,
        params,
      }
    }

    case 'isNull':
      return { sql: `"${condition.column}" IS NULL`, params: [] }

    case 'isNotNull':
      return { sql: `"${condition.column}" IS NOT NULL`, params: [] }

    case 'between': {
      const min = condition.values?.[0]
      const max = condition.values?.[1]
      if (min === undefined || max === undefined) {
        throw new Error('[SQL] BETWEEN requires two values')
      }
      params.push(toQueryParam(min))
      params.push(toQueryParam(max))
      return {
        sql: `"${condition.column}" BETWEEN $${idx} AND $${idx + 1}`,
        params,
      }
    }

    case 'and': {
      if (!condition.conditions?.length) return { sql: '1=1', params: [] }
      const parts: string[] = []
      let offset = idx
      for (const c of condition.conditions) {
        const result = serializeCondition(c, offset)
        parts.push(result.sql)
        params.push(...result.params)
        offset += result.params.length
      }
      return { sql: `(${parts.join(' AND ')})`, params }
    }

    case 'or': {
      if (!condition.conditions?.length) return { sql: '1=0', params: [] }
      const parts: string[] = []
      let offset = idx
      for (const c of condition.conditions) {
        const result = serializeCondition(c, offset)
        parts.push(result.sql)
        params.push(...result.params)
        offset += result.params.length
      }
      return { sql: `(${parts.join(' OR ')})`, params }
    }

    case 'not': {
      const notCondition = condition.conditions?.[0]
      if (!notCondition) {
        throw new Error('[SQL] NOT requires a condition')
      }
      const inner = serializeCondition(notCondition, idx)
      return { sql: `NOT (${inner.sql})`, params: inner.params }
    }

    case 'raw':
      return { sql: condition.sql ?? '', params: condition.params ?? [] }

    default:
      throw new Error(
        `Unknown condition type: ${(condition as SQLCondition).type}`,
      )
  }
}

// ============================================================================
// Typed Table Reference
// ============================================================================

/**
 * Symbol used to carry the row type on table references
 */
export const TABLE_ROW_TYPE = Symbol.for('sqlit:RowType')

/**
 * Typed table reference that carries the row type.
 * Supports multiple patterns:
 * - TypedTable from table-registry (uses __schema)
 * - TypedTableRef from typed-tables (uses $inferSelect)
 */
export interface TypedTableRef<TRow> {
  _: { name: string }
  /** Phantom type for schema inference (typed-tables pattern) */
  readonly $inferSelect?: TRow
  /** Phantom type for schema inference (table-registry pattern) */
  readonly __schema?: TRow
  [column: string]: { name: string } | TRow | undefined
}

/**
 * Extract row type from a typed table reference.
 * Supports both __schema and $inferSelect patterns.
 */
export type InferTableRow<T> = T extends { readonly $inferSelect: infer R }
  ? R
  : T extends { readonly __schema?: infer R }
    ? R extends undefined
      ? Record<string, unknown>
      : R
    : Record<string, unknown>

// ============================================================================
// Query Builders
// ============================================================================

export class SelectBuilder<T extends Record<string, unknown>>
  implements PromiseLike<T[]>
{
  private _table = ''
  private _fields = '*'
  private _where: SQLCondition | null = null
  private _orderBy: string[] = []
  private _limit: number | null = null
  private _offset: number | null = null
  private _joins: string[] = []
  private _groupBy: string[] = []

  constructor(
    private executor: Executor,
    fields?: Record<string, unknown>,
  ) {
    if (fields) {
      this._fields = Object.keys(fields)
        .map((k) => `"${k}"`)
        .join(', ')
    }
  }

  from<
    TTable extends TypedTableRef<TRow>,
    TRow extends Record<string, unknown>,
  >(table: TTable): SelectBuilder<InferTableRow<TTable>>
  from(table: object | string): SelectBuilder<T>
  from(table: object | string): SelectBuilder<T> {
    this._table = typeof table === 'string' ? table : getTableName(table)
    return this
  }

  innerJoin(
    table: object | string,
    condition: SQLCondition | undefined,
  ): SelectBuilder<T> {
    const joinTable = typeof table === 'string' ? table : getTableName(table)
    if (condition) {
      const condResult = serializeCondition(condition, 1)
      this._joins.push(`INNER JOIN "${joinTable}" ON ${condResult.sql}`)
    } else {
      this._joins.push(`INNER JOIN "${joinTable}"`)
    }
    return this
  }

  leftJoin(
    table: object | string,
    condition: SQLCondition | undefined,
  ): SelectBuilder<T> {
    const joinTable = typeof table === 'string' ? table : getTableName(table)
    if (condition) {
      const condResult = serializeCondition(condition, 1)
      this._joins.push(`LEFT JOIN "${joinTable}" ON ${condResult.sql}`)
    } else {
      this._joins.push(`LEFT JOIN "${joinTable}"`)
    }
    return this
  }

  groupBy(...columns: (string | { name: string })[]): SelectBuilder<T> {
    for (const col of columns) {
      const colName = typeof col === 'string' ? col : col.name
      this._groupBy.push(`"${colName}"`)
    }
    return this
  }

  where(condition: SQLCondition | undefined): SelectBuilder<T> {
    if (condition) this._where = condition
    return this
  }

  orderBy(
    column: string | { name: string },
    direction: 'asc' | 'desc' = 'asc',
  ): SelectBuilder<T> {
    const colName = typeof column === 'string' ? column : column.name
    this._orderBy.push(`"${colName}" ${direction.toUpperCase()}`)
    return this
  }

  limit(n: number): SelectBuilder<T> {
    this._limit = n
    return this
  }

  offset(n: number): SelectBuilder<T> {
    this._offset = n
    return this
  }

  private build(): { sql: string; params: QueryParam[] } {
    let sql = `SELECT ${this._fields} FROM "${this._table}"`
    const params: QueryParam[] = []

    // Add joins
    if (this._joins.length) {
      sql += ` ${this._joins.join(' ')}`
    }

    if (this._where) {
      const whereResult = serializeCondition(this._where, params.length + 1)
      sql += ` WHERE ${whereResult.sql}`
      params.push(...whereResult.params)
    }

    if (this._groupBy.length) {
      sql += ` GROUP BY ${this._groupBy.join(', ')}`
    }

    if (this._orderBy.length) {
      sql += ` ORDER BY ${this._orderBy.join(', ')}`
    }

    if (this._limit !== null) {
      sql += ` LIMIT ${this._limit}`
    }

    if (this._offset !== null) {
      sql += ` OFFSET ${this._offset}`
    }

    return { sql, params }
  }

  async execute(): Promise<T[]> {
    const { sql, params } = this.build()
    return this.executor.query<T>(sql, params)
  }

  // biome-ignore lint/suspicious/noThenProperty: Required for PromiseLike implementation
  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }
}

export class InsertBuilder<T extends Record<string, unknown>>
  implements PromiseLike<T[]>
{
  private _table = ''
  private _values: Record<string, SQLValue>[] = []
  private _returning = false
  private _onConflict: 'doNothing' | 'doUpdate' | null = null
  private _conflictTarget: string[] = []
  private _conflictUpdate: Record<string, SQLValue> = {}

  constructor(
    private executor: Executor,
    table: object | string,
  ) {
    this._table = typeof table === 'string' ? table : getTableName(table)
  }

  values(
    data: Record<string, SQLValue> | Record<string, SQLValue>[],
  ): InsertBuilder<T> {
    this._values = Array.isArray(data) ? data : [data]
    return this
  }

  returning(): InsertBuilder<T> {
    this._returning = true
    return this
  }

  onConflictDoNothing(opts?: {
    target?: ColumnInput | ColumnInput[]
  }): InsertBuilder<T> {
    this._onConflict = 'doNothing'
    if (opts?.target) {
      const targets = Array.isArray(opts.target) ? opts.target : [opts.target]
      this._conflictTarget = targets.map(getColName)
    }
    return this
  }

  onConflictDoUpdate(opts: {
    target?: ColumnInput | ColumnInput[]
    set: Record<string, SQLValue>
  }): InsertBuilder<T> {
    this._onConflict = 'doUpdate'
    if (opts.target) {
      const targets = Array.isArray(opts.target) ? opts.target : [opts.target]
      this._conflictTarget = targets.map(getColName)
    }
    this._conflictUpdate = opts.set
    return this
  }

  private build(): { sql: string; params: QueryParam[] } {
    const firstRow = this._values[0]
    if (!firstRow) {
      throw new Error('[InsertBuilder] No values provided')
    }

    const columns = Object.keys(firstRow)
    const params: QueryParam[] = []
    const valueGroups: string[] = []

    for (const row of this._values) {
      const placeholders: string[] = []
      for (const col of columns) {
        const value = row[col]
        params.push(value !== undefined ? toQueryParam(value) : null)
        placeholders.push(`$${params.length}`)
      }
      valueGroups.push(`(${placeholders.join(', ')})`)
    }

    let sql = `INSERT INTO "${this._table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES ${valueGroups.join(', ')}`

    // Handle ON CONFLICT
    if (this._onConflict === 'doNothing') {
      if (this._conflictTarget.length > 0) {
        sql += ` ON CONFLICT (${this._conflictTarget.map((c) => `"${c}"`).join(', ')}) DO NOTHING`
      } else {
        sql += ' ON CONFLICT DO NOTHING'
      }
    } else if (this._onConflict === 'doUpdate') {
      const updateParts: string[] = []
      for (const [col, val] of Object.entries(this._conflictUpdate)) {
        params.push(toQueryParam(val))
        updateParts.push(`"${col}" = $${params.length}`)
      }
      if (this._conflictTarget.length > 0) {
        sql += ` ON CONFLICT (${this._conflictTarget.map((c) => `"${c}"`).join(', ')}) DO UPDATE SET ${updateParts.join(', ')}`
      } else {
        sql += ` ON CONFLICT DO UPDATE SET ${updateParts.join(', ')}`
      }
    }

    if (this._returning) {
      sql += ' RETURNING *'
    }

    return { sql, params }
  }

  async execute(): Promise<T[]> {
    const { sql, params } = this.build()
    if (this._returning) {
      return this.executor.query<T>(sql, params)
    }
    await this.executor.exec(sql, params)
    return []
  }

  // biome-ignore lint/suspicious/noThenProperty: Required for PromiseLike implementation
  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }
}

export class UpdateBuilder<T extends Record<string, unknown>>
  implements PromiseLike<T[]>
{
  private _table = ''
  private _set: Record<string, SQLValue> = {}
  private _where: SQLCondition | null = null
  private _returning = false

  constructor(
    private executor: Executor,
    table: object | string,
  ) {
    this._table = typeof table === 'string' ? table : getTableName(table)
  }

  set(data: Record<string, SQLValue>): UpdateBuilder<T> {
    this._set = data
    return this
  }

  where(condition: SQLCondition | undefined): UpdateBuilder<T> {
    if (condition) this._where = condition
    return this
  }

  returning(): UpdateBuilder<T> {
    this._returning = true
    return this
  }

  private build(): { sql: string; params: QueryParam[] } {
    const params: QueryParam[] = []
    const setParts: string[] = []

    for (const [col, val] of Object.entries(this._set)) {
      params.push(toQueryParam(val))
      setParts.push(`"${col}" = $${params.length}`)
    }

    let sql = `UPDATE "${this._table}" SET ${setParts.join(', ')}`

    if (this._where) {
      const whereResult = serializeCondition(this._where, params.length + 1)
      sql += ` WHERE ${whereResult.sql}`
      params.push(...whereResult.params)
    }

    if (this._returning) {
      sql += ' RETURNING *'
    }

    return { sql, params }
  }

  async execute(): Promise<T[]> {
    const { sql, params } = this.build()
    if (this._returning) {
      return this.executor.query<T>(sql, params)
    }
    await this.executor.exec(sql, params)
    return []
  }

  // biome-ignore lint/suspicious/noThenProperty: Required for PromiseLike implementation
  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }
}

export class DeleteBuilder<T extends Record<string, unknown>>
  implements PromiseLike<T[]>
{
  private _table = ''
  private _where: SQLCondition | null = null
  private _returning = false

  constructor(
    private executor: Executor,
    table: object | string,
  ) {
    this._table = typeof table === 'string' ? table : getTableName(table)
  }

  where(condition: SQLCondition | undefined): DeleteBuilder<T> {
    if (condition) this._where = condition
    return this
  }

  returning(): DeleteBuilder<T> {
    this._returning = true
    return this
  }

  private build(): { sql: string; params: QueryParam[] } {
    let sql = `DELETE FROM "${this._table}"`
    const params: QueryParam[] = []

    if (this._where) {
      const whereResult = serializeCondition(this._where, 1)
      sql += ` WHERE ${whereResult.sql}`
      params.push(...whereResult.params)
    }

    if (this._returning) {
      sql += ' RETURNING *'
    }

    return { sql, params }
  }

  async execute(): Promise<T[]> {
    const { sql, params } = this.build()
    if (this._returning) {
      return this.executor.query<T>(sql, params)
    }
    await this.executor.exec(sql, params)
    return []
  }

  // biome-ignore lint/suspicious/noThenProperty: Required for PromiseLike implementation
  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }
}

// ============================================================================
// Query Transaction (Drizzle-like interface)
// ============================================================================

export interface QueryTransaction {
  select: <TFields extends Record<string, unknown> | undefined = undefined>(
    fields?: TFields,
  ) => {
    from: <
      TTable extends TypedTableRef<TRow>,
      TRow extends Record<string, unknown>,
    >(
      table: TTable,
    ) => SelectBuilder<
      TFields extends undefined ? InferTableRow<TTable> : TFields
    >
  }
  insert: (table: object | string) => InsertBuilder<Record<string, unknown>>
  update: (table: object | string) => UpdateBuilder<Record<string, unknown>>
  delete: (table: object | string) => DeleteBuilder<Record<string, unknown>>
}

export function createQueryTransaction(executor: Executor): QueryTransaction {
  return {
    select: <TFields extends Record<string, unknown> | undefined = undefined>(
      fields?: TFields,
    ) => ({
      from: <
        TTable extends TypedTableRef<TRow>,
        TRow extends Record<string, unknown>,
      >(
        table: TTable,
      ): SelectBuilder<
        TFields extends undefined ? InferTableRow<TTable> : TFields
      > => {
        type ResultType = TFields extends undefined
          ? InferTableRow<TTable>
          : TFields
        const builder = new SelectBuilder<ResultType>(executor, fields)
        builder.from(table)
        return builder
      },
    }),
    insert: (table: object | string) =>
      new InsertBuilder<Record<string, unknown>>(executor, table),
    update: (table: object | string) =>
      new UpdateBuilder<Record<string, unknown>>(executor, table),
    delete: (table: object | string) =>
      new DeleteBuilder<Record<string, unknown>>(executor, table),
  }
}
