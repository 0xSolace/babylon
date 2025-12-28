/**
 * Native SQL Helpers
 *
 * Provides SQL condition builders (eq, and, or, etc).
 * These work directly with EQLite.
 */

import type { QueryParam } from '@jejunetwork/db'
import type {
  ColumnRef as BaseColumnRef,
  TypedColumnRef,
} from './table-registry'

// ============================================================================
// SQL Condition Types
// ============================================================================

/**
 * SQL condition that can be serialized to a parameterized query.
 */
export interface SQLCondition {
  /** Convert to SQL with parameters */
  toSQL(): { sql: string; params: QueryParam[] }
  /** Type marker for condition objects */
  _type: 'condition'
}

/**
 * Column reference for building conditions.
 * This is compatible with both plain ColumnRef and TypedColumnRef<T>.
 * The TypedColumnRef carries type information through __columnType for inference.
 */
export type ColumnRef = BaseColumnRef | TypedColumnRef<unknown>

/** Column input - accepts string, object with name, or undefined from index access */
export type ColumnInput = ColumnRef | string | { name: string } | undefined

/** Get column name from various input types */
function getColName(column: ColumnInput): string {
  if (!column) throw new Error('Column reference is undefined')
  return typeof column === 'string' ? column : column.name
}

/** Column reference that can appear in queries */
interface ColumnLike {
  name: string
  table?: string
}

/** Extended value type that includes Date for convenience */
export type ParamValue = QueryParam | Date | ColumnLike

/** Check if value is a column-like reference */
function isColumnLike(value: unknown): value is ColumnLike {
  if (typeof value !== 'object' || value === null) return false
  if (!('name' in value)) return false
  if ('toISOString' in value) return false // Exclude Date objects
  // After 'in' check, value has 'name' property that we can access safely
  return typeof value.name === 'string'
}

/** Convert value to QueryParam, handling Date conversion. Returns null if undefined/null. */
function toParam(value: ParamValue | undefined | null): QueryParam {
  if (value === undefined || value === null) return null
  if (value instanceof Date) return value.toISOString()
  // Column refs should not be converted to params - they're handled separately
  if (isColumnLike(value))
    throw new Error(
      `Column ref "${value.name}" should not be passed to toParam`,
    )
  return value
}

/** Format a column reference to SQL */
function formatColRef(col: ColumnLike): string {
  if (col.table) return `"${col.table}"."${col.name}"`
  return `"${col.name}"`
}

/**
 * SQL expression that can be used in queries.
 * The T parameter represents the result type (e.g., number for count(), string for concat()).
 */
export interface SQLExpression<T = unknown> {
  /** The SQL template */
  template: string
  /** Parameter values */
  values: QueryParam[]
  /** Type marker */
  _type: 'sql'
  /** Phantom type for result type inference */
  readonly __columnType?: T
}

// ============================================================================
// Column Reference
// ============================================================================

/**
 * Create a column reference.
 *
 * @param name - Column name
 * @param table - Optional table name
 */
export function col(name: string, table?: string): ColumnRef {
  return { name, table, _type: 'column' }
}

function formatColumn(column: ColumnRef | string): string {
  if (typeof column === 'string') {
    return `"${column}"`
  }
  if (column.table) {
    return `"${column.table}"."${column.name}"`
  }
  return `"${column.name}"`
}

// ============================================================================
// Comparison Operators
// ============================================================================

/**
 * Create an equality condition (column = value).
 * If value is a column ref, creates a col1 = col2 join condition.
 */
export function eq(
  column: ColumnInput,
  value: ParamValue | null,
): SQLCondition {
  const colName = getColName(column)

  // Check if value is a column ref (for join conditions)
  if (value !== null && isColumnLike(value)) {
    const rightCol = formatColRef(value)
    return {
      _type: 'condition',
      toSQL() {
        return { sql: `"${colName}" = ${rightCol}`, params: [] }
      },
    }
  }

  const param = toParam(value)
  return {
    _type: 'condition',
    toSQL() {
      if (param === null) {
        return { sql: `"${colName}" IS NULL`, params: [] }
      }
      return { sql: `"${colName}" = $1`, params: [param] }
    },
  }
}

/**
 * Create a not-equal condition (column != value).
 */
export function ne(
  column: ColumnInput,
  value: ParamValue | null,
): SQLCondition {
  const colName = getColName(column)
  const param = toParam(value)
  return {
    _type: 'condition',
    toSQL() {
      if (param === null) {
        return { sql: `"${colName}" IS NOT NULL`, params: [] }
      }
      return { sql: `"${colName}" != $1`, params: [param] }
    },
  }
}

/**
 * Create a greater-than condition (column > value).
 */
export function gt(column: ColumnInput, value: ParamValue): SQLCondition {
  const colName = getColName(column)
  const param = toParam(value)
  return {
    _type: 'condition',
    toSQL() {
      return { sql: `"${colName}" > $1`, params: [param] }
    },
  }
}

/**
 * Create a greater-than-or-equal condition (column >= value).
 */
export function gte(column: ColumnInput, value: ParamValue): SQLCondition {
  const colName = getColName(column)
  const param = toParam(value)
  return {
    _type: 'condition',
    toSQL() {
      return { sql: `"${colName}" >= $1`, params: [param] }
    },
  }
}

/**
 * Create a less-than condition (column < value).
 */
export function lt(column: ColumnInput, value: ParamValue): SQLCondition {
  const colName = getColName(column)
  const param = toParam(value)
  return {
    _type: 'condition',
    toSQL() {
      return { sql: `"${colName}" < $1`, params: [param] }
    },
  }
}

/**
 * Create a less-than-or-equal condition (column <= value).
 */
export function lte(column: ColumnInput, value: ParamValue): SQLCondition {
  const colName = getColName(column)
  const param = toParam(value)
  return {
    _type: 'condition',
    toSQL() {
      return { sql: `"${colName}" <= $1`, params: [param] }
    },
  }
}

// ============================================================================
// Null Checks
// ============================================================================

/**
 * Create an IS NULL condition.
 */
export function isNull(column: ColumnInput): SQLCondition {
  const colName = getColName(column)
  return {
    _type: 'condition',
    toSQL() {
      return { sql: `"${colName}" IS NULL`, params: [] }
    },
  }
}

/**
 * Create an IS NOT NULL condition.
 */
export function isNotNull(column: ColumnInput): SQLCondition {
  const colName = getColName(column)
  return {
    _type: 'condition',
    toSQL() {
      return { sql: `"${colName}" IS NOT NULL`, params: [] }
    },
  }
}

// ============================================================================
// Array Operators
// ============================================================================

/**
 * Create an IN condition (column IN (values)).
 */
export function inArray(
  column: ColumnInput,
  values: ParamValue[],
): SQLCondition {
  const colName = getColName(column)
  const params = values.map(toParam)
  return {
    _type: 'condition',
    toSQL() {
      if (params.length === 0) {
        return { sql: 'FALSE', params: [] }
      }
      const placeholders = params.map((_, i) => `$${i + 1}`).join(', ')
      return { sql: `"${colName}" IN (${placeholders})`, params }
    },
  }
}

/**
 * Create a NOT IN condition (column NOT IN (values)).
 */
export function notInArray(
  column: ColumnInput,
  values: ParamValue[],
): SQLCondition {
  const colName = getColName(column)
  const params = values.map(toParam)
  return {
    _type: 'condition',
    toSQL() {
      if (params.length === 0) {
        return { sql: 'TRUE', params: [] }
      }
      const placeholders = params.map((_, i) => `$${i + 1}`).join(', ')
      return { sql: `"${colName}" NOT IN (${placeholders})`, params }
    },
  }
}

// ============================================================================
// String Operators
// ============================================================================

/**
 * Create a LIKE condition.
 */
export function like(column: ColumnInput, pattern: string): SQLCondition {
  const colName = getColName(column)
  return {
    _type: 'condition',
    toSQL() {
      return { sql: `"${colName}" LIKE $1`, params: [pattern] }
    },
  }
}

/**
 * Create a case-insensitive ILIKE condition.
 */
export function ilike(column: ColumnInput, pattern: string): SQLCondition {
  const colName = getColName(column)
  return {
    _type: 'condition',
    toSQL() {
      return { sql: `"${colName}" ILIKE $1`, params: [pattern] }
    },
  }
}

/**
 * Create a BETWEEN condition (column BETWEEN low AND high).
 */
export function between(
  column: ColumnInput,
  low: ParamValue,
  high: ParamValue,
): SQLCondition {
  const colName = getColName(column)
  const lowParam = toParam(low)
  const highParam = toParam(high)
  return {
    _type: 'condition',
    toSQL() {
      return {
        sql: `"${colName}" BETWEEN $1 AND $2`,
        params: [lowParam, highParam],
      }
    },
  }
}

// ============================================================================
// Logical Operators
// ============================================================================

/**
 * Combine conditions with AND.
 */
export function and(
  ...conditions: (SQLCondition | undefined | null)[]
): SQLCondition {
  const validConditions = conditions.filter(
    (c): c is SQLCondition => c !== undefined && c !== null,
  )
  return {
    _type: 'condition',
    toSQL() {
      if (validConditions.length === 0) {
        return { sql: '', params: [] }
      }

      const parts: string[] = []
      const allParams: QueryParam[] = []
      let paramOffset = 0

      for (const cond of validConditions) {
        const { sql, params } = cond.toSQL()
        if (sql) {
          // Adjust parameter placeholders
          const adjustedSql = sql.replace(/\$(\d+)/g, (_, num) => {
            return `$${parseInt(num, 10) + paramOffset}`
          })
          parts.push(`(${adjustedSql})`)
          allParams.push(...params)
          paramOffset += params.length
        }
      }

      return { sql: parts.join(' AND '), params: allParams }
    },
  }
}

/**
 * Combine conditions with OR.
 */
export function or(
  ...conditions: (SQLCondition | undefined | null)[]
): SQLCondition {
  const validConditions = conditions.filter(
    (c): c is SQLCondition => c !== undefined && c !== null,
  )
  return {
    _type: 'condition',
    toSQL() {
      if (validConditions.length === 0) {
        return { sql: '', params: [] }
      }

      const parts: string[] = []
      const allParams: QueryParam[] = []
      let paramOffset = 0

      for (const cond of validConditions) {
        const { sql, params } = cond.toSQL()
        if (sql) {
          // Adjust parameter placeholders
          const adjustedSql = sql.replace(/\$(\d+)/g, (_, num) => {
            return `$${parseInt(num, 10) + paramOffset}`
          })
          parts.push(`(${adjustedSql})`)
          allParams.push(...params)
          paramOffset += params.length
        }
      }

      return { sql: parts.join(' OR '), params: allParams }
    },
  }
}

/**
 * Negate a condition with NOT.
 */
export function not(condition: SQLCondition): SQLCondition {
  return {
    _type: 'condition',
    toSQL() {
      const { sql, params } = condition.toSQL()
      if (!sql) {
        return { sql: '', params: [] }
      }
      return { sql: `NOT (${sql})`, params }
    },
  }
}

// ============================================================================
// Existence Operators
// ============================================================================

/**
 * Create an EXISTS condition with a subquery.
 */
export function exists(
  subquery: string,
  params: QueryParam[] = [],
): SQLCondition {
  return {
    _type: 'condition',
    toSQL() {
      return { sql: `EXISTS (${subquery})`, params }
    },
  }
}

/**
 * Create a NOT EXISTS condition with a subquery.
 */
export function notExists(
  subquery: string,
  params: QueryParam[] = [],
): SQLCondition {
  return {
    _type: 'condition',
    toSQL() {
      return { sql: `NOT EXISTS (${subquery})`, params }
    },
  }
}

// ============================================================================
// SQL Template Literal
// ============================================================================

/**
 * Create a raw SQL expression with parameterized values.
 *
 * @example
 * ```typescript
 * const expr = sql`balance - ${amount}`
 * ```
 */
export function sql(
  strings: TemplateStringsArray,
  ...values: (ParamValue | ColumnLike | undefined)[]
): SQLExpression {
  let template = ''
  const params: QueryParam[] = []
  let paramIndex = 1

  strings.forEach((str, i) => {
    template += str
    const value = values[i]
    if (i < values.length && value !== undefined) {
      // Column references are embedded directly as quoted identifiers
      if (isColumnLike(value)) {
        template += `"${value.name}"`
      } else {
        // value is ParamValue at this point
        params.push(toParam(value))
        template += `$${paramIndex++}`
      }
    }
  })

  return {
    template,
    values: params,
    _type: 'sql',
  }
}

// ============================================================================
// Aggregate Functions
// ============================================================================

/**
 * Create a COUNT(*) expression.
 */
export function count(column?: ColumnRef | string): SQLExpression<number> {
  if (!column) {
    return { template: 'COUNT(*)', values: [], _type: 'sql' }
  }
  const colName = typeof column === 'string' ? column : formatColumn(column)
  return { template: `COUNT(${colName})`, values: [], _type: 'sql' }
}

/**
 * Create a SUM expression.
 */
export function sum(column: ColumnRef | string): SQLExpression<number> {
  const colName =
    typeof column === 'string' ? `"${column}"` : formatColumn(column)
  return { template: `SUM(${colName})`, values: [], _type: 'sql' }
}

/**
 * Create an AVG expression.
 */
export function avg(column: ColumnRef | string): SQLExpression<number> {
  const colName =
    typeof column === 'string' ? `"${column}"` : formatColumn(column)
  return { template: `AVG(${colName})`, values: [], _type: 'sql' }
}

/**
 * Create a MIN expression.
 */
export function min<T = unknown>(column: ColumnRef | string): SQLExpression<T> {
  const colName =
    typeof column === 'string' ? `"${column}"` : formatColumn(column)
  return { template: `MIN(${colName})`, values: [], _type: 'sql' }
}

/**
 * Create a MAX expression.
 */
export function max<T = unknown>(column: ColumnRef | string): SQLExpression<T> {
  const colName =
    typeof column === 'string' ? `"${column}"` : formatColumn(column)
  return { template: `MAX(${colName})`, values: [], _type: 'sql' }
}

// ============================================================================
// Order By Helpers
// ============================================================================

/**
 * Create ascending order expression.
 */
export function asc(column: ColumnInput): { column: string; direction: 'asc' } {
  return { column: getColName(column), direction: 'asc' }
}

/**
 * Create descending order expression.
 */
export function desc(column: ColumnInput): {
  column: string
  direction: 'desc'
} {
  return { column: getColName(column), direction: 'desc' }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is an SQLCondition.
 */
export function isSQLCondition(value: unknown): value is SQLCondition {
  if (typeof value !== 'object' || value === null) return false
  if (!('_type' in value)) return false
  // After 'in' check, value has _type property accessible
  return (
    value._type === 'condition' &&
    'toSQL' in value &&
    typeof value.toSQL === 'function'
  )
}

/**
 * Check if a value is an SQLExpression.
 */
export function isSQLExpression(value: unknown): value is SQLExpression {
  if (typeof value !== 'object' || value === null) return false
  if (!('_type' in value)) return false
  // After 'in' check, value has _type property accessible
  return value._type === 'sql'
}

/**
 * Check if a value is a ColumnRef.
 */
export function isColumnRef(value: unknown): value is ColumnRef {
  if (typeof value !== 'object' || value === null) return false
  if (!('_type' in value)) return false
  // After 'in' check, value has _type property accessible
  return value._type === 'column'
}
