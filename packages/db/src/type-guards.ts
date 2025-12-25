/**
 * DB Type Guards
 *
 * Database-specific type guards. For base type guards, import from @babylon/shared.
 */

import {
  isDate,
  isJsonValue,
  isObject,
  isPlainObject,
  isUint8Array,
} from '@babylon/shared'

// Re-export base type guards for use within @babylon/db
export { isDate, isJsonValue, isObject, isPlainObject, isUint8Array }

import type { QueryParam } from '@jejunetwork/db'
import type { SQLValue } from './types'

// ============================================================================
// Column Reference Guards
// ============================================================================

/**
 * Column reference interface for query building.
 */
export interface ColumnLike {
  readonly name: string
  readonly table?: string
}

/**
 * Check if a value is a column reference object.
 * Column references have a `name` property and optionally a `table` property.
 */
export function isColumnLike(value: unknown): value is ColumnLike {
  if (typeof value !== 'object' || value === null) return false
  if (!('name' in value)) return false
  // After 'in' check, value has 'name' property
  return typeof value.name === 'string' && !isDate(value)
}

/**
 * Check if a value is a ColumnRef with _type marker.
 * Internal: Used by query builder for type narrowing.
 */
export function isTypedColumnRef(
  value: unknown,
): value is ColumnLike & { _type: 'column' } {
  if (!isColumnLike(value)) return false
  // After isColumnLike returns true, value is an object
  return '_type' in value && value._type === 'column'
}

/**
 * ColumnRef interface for type guard
 */
export interface ColumnRef {
  readonly _type: 'column'
  readonly name: string
  readonly table?: string
}

/**
 * Check if a value is a ColumnRef.
 */
export function isColumnRef(value: unknown): value is ColumnRef {
  if (!isObject(value)) return false
  return '_type' in value && value._type === 'column'
}

// ============================================================================
// SQL Value Guards
// ============================================================================

/**
 * Check if a value is a valid SQL primitive (not object/array).
 */
export function isSQLPrimitive(
  value: unknown,
): value is string | number | boolean | null | bigint {
  if (value === null) return true
  const type = typeof value
  return (
    type === 'string' ||
    type === 'number' ||
    type === 'boolean' ||
    type === 'bigint'
  )
}

/**
 * Check if a value is a valid SQLValue.
 */
export function isSQLValue(value: unknown): value is SQLValue {
  if (isSQLPrimitive(value)) return true
  if (isDate(value)) return true
  if (isUint8Array(value)) return true
  if (Array.isArray(value)) return true
  if (typeof value === 'object' && value !== null) return true
  return false
}

// ============================================================================
// JSON Value Guards
// ============================================================================

// Note: isPlainObject is imported from @babylon/shared

// ============================================================================
// Query Parameter Conversion
// ============================================================================

/**
 * Convert a value to a QueryParam, handling all valid types.
 * Returns null for undefined values.
 * Objects and arrays are JSON stringified.
 */
export function toQueryParam(value: unknown): QueryParam {
  if (value === undefined || value === null) return null
  if (isSQLPrimitive(value)) return value
  if (isDate(value)) return value.toISOString()
  if (isUint8Array(value)) return value
  // Objects and arrays are serialized to JSON
  return JSON.stringify(value)
}

/**
 * Convert a record's values to QueryParam array.
 * Values are coerced to SQLValue - objects/arrays are JSON stringified.
 */
export function recordToParams(record: Record<string, unknown>): QueryParam[] {
  return Object.values(record).map((v) => {
    // Handle SQLValue types directly
    if (v === undefined || v === null) return null
    if (isSQLPrimitive(v)) return v
    if (isDate(v)) return v.toISOString()
    if (isUint8Array(v)) return v
    // Objects and arrays are serialized to JSON
    return JSON.stringify(v)
  })
}

// ============================================================================
// Operation Type Guards
// ============================================================================

/**
 * Check if a value is an increment operation.
 */
export function isIncrementOp(value: unknown): value is { increment: number } {
  return (
    isPlainObject(value) &&
    'increment' in value &&
    typeof value.increment === 'number'
  )
}

/**
 * Check if a value is a decrement operation.
 */
export function isDecrementOp(value: unknown): value is { decrement: number } {
  return (
    isPlainObject(value) &&
    'decrement' in value &&
    typeof value.decrement === 'number'
  )
}

/**
 * Check if a value is a where condition operator object.
 */
export function isWhereOperator(
  value: unknown,
): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false
  const keys = Object.keys(value)
  const operatorKeys = [
    'equals',
    'not',
    'in',
    'notIn',
    'lt',
    'lte',
    'gt',
    'gte',
    'contains',
    'startsWith',
    'endsWith',
    'mode',
  ]
  return keys.some((k) => operatorKeys.includes(k))
}

// ============================================================================
// SQL Expression Guards
// ============================================================================

/**
 * SQL expression marker interface.
 */
export interface SQLExpressionMarker {
  readonly _type: 'sql'
  readonly template: string
  readonly values: QueryParam[]
}

/**
 * Check if a value is an SQL expression.
 */
export function isSQLExpressionMarker(
  value: unknown,
): value is SQLExpressionMarker {
  return (
    isPlainObject(value) &&
    '_type' in value &&
    value._type === 'sql' &&
    'template' in value &&
    typeof value.template === 'string'
  )
}

/**
 * SQL condition marker interface.
 */
export interface SQLConditionMarker {
  readonly _type: 'condition'
  toSQL(): { sql: string; params: QueryParam[] }
}

/**
 * Check if a value is an SQL condition.
 */
export function isSQLConditionMarker(
  value: unknown,
): value is SQLConditionMarker {
  return (
    isPlainObject(value) &&
    '_type' in value &&
    value._type === 'condition' &&
    'toSQL' in value &&
    typeof value.toSQL === 'function'
  )
}

// ============================================================================
// Table Reference Guards
// ============================================================================

/**
 * Table reference with name metadata.
 */
export interface TableRefLike {
  readonly _: { readonly name: string }
}

/**
 * Check if a value is a table reference.
 */
export function isTableRef(value: unknown): value is TableRefLike {
  return (
    isPlainObject(value) &&
    '_' in value &&
    isPlainObject(value._) &&
    'name' in value._ &&
    typeof value._.name === 'string'
  )
}

// ============================================================================
// Type Assertion Helpers
// ============================================================================

/**
 * Assert that a record has specific keys and return typed version.
 * This is a compile-time helper for working with generic records.
 */
export function asRecord<T extends Record<string, unknown>>(value: unknown): T {
  if (!isPlainObject(value)) {
    throw new Error('Value is not a plain object')
  }
  return value as T
}
