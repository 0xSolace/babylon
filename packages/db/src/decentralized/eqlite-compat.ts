/**
 * EQLite-Compatible Query Builders
 *
 * Provides query builders that translate to raw SQL.
 * These query builders work with EQLite backend.
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
// Column Reference Type
// ============================================================================

/** Column reference - accepts string, object with name, or undefined from index access */
type ColumnInput = string | { name: string } | undefined

/** Get column name from various input types */
function getColumnName(column: ColumnInput): string {
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
  return { type: 'eq', column: getColumnName(column), value }
}

export function ne<T extends SQLValue>(
  column: ColumnInput,
  value: T,
): SQLCondition {
  return { type: 'ne', column: getColumnName(column), value }
}

export function gt<T extends SQLValue>(
  column: ColumnInput,
  value: T,
): SQLCondition {
  return { type: 'gt', column: getColumnName(column), value }
}

export function gte<T extends SQLValue>(
  column: ColumnInput,
  value: T,
): SQLCondition {
  return {
    type: 'gte',
    column: getColumnName(column),
    value,
  }
}

export function lt<T extends SQLValue>(
  column: ColumnInput,
  value: T,
): SQLCondition {
  return { type: 'lt', column: getColumnName(column), value }
}

export function lte<T extends SQLValue>(
  column: ColumnInput,
  value: T,
): SQLCondition {
  return {
    type: 'lte',
    column: getColumnName(column),
    value,
  }
}

export function like(column: ColumnInput, pattern: string): SQLCondition {
  return { type: 'like', column: getColumnName(column), value: pattern }
}

export function ilike(column: ColumnInput, pattern: string): SQLCondition {
  return { type: 'ilike', column: getColumnName(column), value: pattern }
}

export function inArray<T extends SQLValue>(
  column: ColumnInput,
  values: T[],
): SQLCondition {
  return {
    type: 'in',
    column: getColumnName(column),
    values,
  }
}

export function notInArray<T extends SQLValue>(
  column: ColumnInput,
  values: T[],
): SQLCondition {
  return {
    type: 'notIn',
    column: getColumnName(column),
    values,
  }
}

export function isNull(column: ColumnInput): SQLCondition {
  return { type: 'isNull', column: getColumnName(column) }
}

export function isNotNull(column: ColumnInput): SQLCondition {
  return { type: 'isNotNull', column: getColumnName(column) }
}

export function between<T extends SQLValue>(
  column: ColumnInput,
  min: T,
  max: T,
): SQLCondition {
  return {
    type: 'between',
    column: getColumnName(column),
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
    if (i < values.length && values[i] !== undefined) {
      const val = values[i]
      // Column references are embedded directly as quoted identifiers
      if (isColumnRef(val)) {
        sqlStr += `"${val.name}"`
      } else if (val !== undefined) {
        // val is SQLValue at this point (not ColumnRef, not undefined)
        params.push(toQueryParam(val))
        sqlStr += `$${paramIndex++}`
      }
    }
  })

  return { type: 'raw', sql: sqlStr, params }
}

// ============================================================================
// Parameter Conversion
// ============================================================================

function toQueryParam(value: unknown): QueryParam {
  if (value === null || value === undefined) return null
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

  from(table: object | string): SelectBuilder<T> {
    this._table = typeof table === 'string' ? table : getTableName(table)
    return this
  }

  where(condition: SQLCondition): SelectBuilder<T> {
    this._where = condition
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

    if (this._where) {
      const whereResult = serializeCondition(this._where, 1)
      sql += ` WHERE ${whereResult.sql}`
      params.push(...whereResult.params)
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
        // row[col] is SQLValue by construction (_values type is Record<string, SQLValue>[])
        // The value exists because we iterate over keys from the first row
        const value = row[col] as SQLValue
        params.push(toQueryParam(value))
        placeholders.push(`$${params.length}`)
      }
      valueGroups.push(`(${placeholders.join(', ')})`)
    }

    let sql = `INSERT INTO "${this._table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES ${valueGroups.join(', ')}`

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

  where(condition: SQLCondition): UpdateBuilder<T> {
    this._where = condition
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

  where(condition: SQLCondition): DeleteBuilder<T> {
    this._where = condition
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
// Query Transaction Interface
// ============================================================================

export interface QueryTransaction {
  select: <T extends Record<string, unknown> | undefined = undefined>(
    fields?: T,
  ) => {
    from: (table: object | string) => SelectBuilder<Record<string, unknown>>
  }
  insert: (table: object | string) => InsertBuilder<Record<string, unknown>>
  update: (table: object | string) => UpdateBuilder<Record<string, unknown>>
  delete: (table: object | string) => DeleteBuilder<Record<string, unknown>>
}

export function createQueryTransaction(executor: Executor): QueryTransaction {
  return {
    select: <T extends Record<string, unknown> | undefined = undefined>(
      fields?: T,
    ) => ({
      from: (table: object | string) =>
        new SelectBuilder<Record<string, unknown>>(executor, fields).from(
          table,
        ),
    }),
    insert: (table: object | string) =>
      new InsertBuilder<Record<string, unknown>>(executor, table),
    update: (table: object | string) =>
      new UpdateBuilder<Record<string, unknown>>(executor, table),
    delete: (table: object | string) =>
      new DeleteBuilder<Record<string, unknown>>(executor, table),
  }
}
