/**
 * CQL Query Builder Fuzz Tests
 *
 * Comprehensive fuzzing and edge case testing for Babylon CQL query builders.
 * Tests SQL helpers and builder classes with extreme inputs.
 */

import { describe, expect, test } from 'bun:test'
import {
  and,
  asc,
  avg,
  between,
  col,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isColumnRef,
  isNotNull,
  isNull,
  isSQLCondition,
  isSQLExpression,
  like,
  lt,
  lte,
  max,
  min,
  ne,
  not,
  notExists,
  notInArray,
  or,
  sql,
  sum,
} from '../sql-helpers'

// ============================================================================
// Test Data Generators
// ============================================================================

function randomString(length: number): string {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return result
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomBool(): boolean {
  return Math.random() > 0.5
}

const EDGE_CASE_STRINGS = [
  '',
  ' ',
  '  ',
  '\t',
  '\n',
  'null',
  'NULL',
  'undefined',
  'true',
  'false',
  "'; DROP TABLE users; --",
  "' OR '1'='1",
  "'",
  '"',
  '\\',
  '%',
  '_',
  '日本語',
  '🎉🔥💯',
  'a'.repeat(1000),
]

const EDGE_CASE_NUMBERS = [
  0,
  -0,
  1,
  -1,
  0.1,
  -0.1,
  Number.MAX_SAFE_INTEGER,
  Number.MIN_SAFE_INTEGER,
  Number.MAX_VALUE,
  Number.MIN_VALUE,
]

// ============================================================================
// SQL Condition Helpers Tests
// ============================================================================

describe('SQL Condition Helpers - eq', () => {
  test('should create equality condition with string', () => {
    const condition = eq('name', 'Alice')
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"name" = $1')
    expect(params).toEqual(['Alice'])
  })

  test('should create equality condition with number', () => {
    const condition = eq('age', 25)
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"age" = $1')
    expect(params).toEqual([25])
  })

  test('should create IS NULL for null value', () => {
    const condition = eq('deletedAt', null)
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"deletedAt" IS NULL')
    expect(params).toEqual([])
  })

  test('should handle column reference', () => {
    const column = col('name')
    const condition = eq(column, 'test')
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"name" = $1')
    expect(params).toEqual(['test'])
  })

  test('should handle all edge case strings', () => {
    for (const str of EDGE_CASE_STRINGS) {
      const condition = eq('field', str)
      const { sql, params } = condition.toSQL()

      expect(sql).toBe('"field" = $1')
      expect(params).toEqual([str])
    }
  })

  test('should handle all edge case numbers', () => {
    for (const num of EDGE_CASE_NUMBERS) {
      const condition = eq('field', num)
      const { sql, params } = condition.toSQL()

      expect(sql).toBe('"field" = $1')
      expect(params).toEqual([num])
    }
  })
})

describe('SQL Condition Helpers - ne', () => {
  test('should create not-equal condition', () => {
    const condition = ne('status', 'deleted')
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"status" != $1')
    expect(params).toEqual(['deleted'])
  })

  test('should create IS NOT NULL for null value', () => {
    const condition = ne('deletedAt', null)
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"deletedAt" IS NOT NULL')
    expect(params).toEqual([])
  })
})

describe('SQL Condition Helpers - Comparison Operators', () => {
  test('gt should create greater-than condition', () => {
    const condition = gt('age', 18)
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"age" > $1')
    expect(params).toEqual([18])
  })

  test('gte should create greater-than-or-equal condition', () => {
    const condition = gte('age', 18)
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"age" >= $1')
    expect(params).toEqual([18])
  })

  test('lt should create less-than condition', () => {
    const condition = lt('age', 65)
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"age" < $1')
    expect(params).toEqual([65])
  })

  test('lte should create less-than-or-equal condition', () => {
    const condition = lte('age', 65)
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"age" <= $1')
    expect(params).toEqual([65])
  })

  test('comparison operators should handle edge case numbers', () => {
    for (const num of EDGE_CASE_NUMBERS) {
      expect(() => gt('f', num).toSQL()).not.toThrow()
      expect(() => gte('f', num).toSQL()).not.toThrow()
      expect(() => lt('f', num).toSQL()).not.toThrow()
      expect(() => lte('f', num).toSQL()).not.toThrow()
    }
  })
})

describe('SQL Condition Helpers - Null Checks', () => {
  test('isNull should create IS NULL condition', () => {
    const condition = isNull('deletedAt')
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"deletedAt" IS NULL')
    expect(params).toEqual([])
  })

  test('isNotNull should create IS NOT NULL condition', () => {
    const condition = isNotNull('confirmedAt')
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"confirmedAt" IS NOT NULL')
    expect(params).toEqual([])
  })

  test('should work with column references', () => {
    const column = col('status')
    const nullCondition = isNull(column)
    const notNullCondition = isNotNull(column)

    expect(nullCondition.toSQL().sql).toBe('"status" IS NULL')
    expect(notNullCondition.toSQL().sql).toBe('"status" IS NOT NULL')
  })
})

describe('SQL Condition Helpers - Array Operators', () => {
  test('inArray should create IN condition', () => {
    const condition = inArray('status', ['active', 'pending', 'approved'])
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"status" IN ($1, $2, $3)')
    expect(params).toEqual(['active', 'pending', 'approved'])
  })

  test('inArray with empty array should return FALSE', () => {
    const condition = inArray('status', [])
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('FALSE')
    expect(params).toEqual([])
  })

  test('inArray with single value', () => {
    const condition = inArray('id', [42])
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"id" IN ($1)')
    expect(params).toEqual([42])
  })

  test('notInArray should create NOT IN condition', () => {
    const condition = notInArray('status', ['deleted', 'banned'])
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"status" NOT IN ($1, $2)')
    expect(params).toEqual(['deleted', 'banned'])
  })

  test('notInArray with empty array should return TRUE', () => {
    const condition = notInArray('status', [])
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('TRUE')
    expect(params).toEqual([])
  })

  test('inArray should handle large arrays', () => {
    const values = Array.from({ length: 1000 }, (_, i) => `value${i}`)
    const condition = inArray('field', values)
    const { sql, params } = condition.toSQL()

    expect(params.length).toBe(1000)
    expect(sql).toContain('IN (')
  })

  test('inArray should handle edge case values', () => {
    const condition = inArray('field', EDGE_CASE_STRINGS)
    const { params } = condition.toSQL()

    expect(params).toEqual(EDGE_CASE_STRINGS)
  })
})

describe('SQL Condition Helpers - String Operators', () => {
  test('like should create LIKE condition', () => {
    const condition = like('name', '%test%')
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"name" LIKE $1')
    expect(params).toEqual(['%test%'])
  })

  test('ilike should create ILIKE condition', () => {
    const condition = ilike('name', '%test%')
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"name" ILIKE $1')
    expect(params).toEqual(['%test%'])
  })

  test('between should create BETWEEN condition', () => {
    const condition = between('age', 18, 65)
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"age" BETWEEN $1 AND $2')
    expect(params).toEqual([18, 65])
  })

  test('between should work with strings', () => {
    const condition = between('name', 'A', 'M')
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"name" BETWEEN $1 AND $2')
    expect(params).toEqual(['A', 'M'])
  })

  test('like patterns should be passed as-is', () => {
    const patterns = ['%test', 'test%', '%test%', 'te_st', 'te%st']
    for (const pattern of patterns) {
      const condition = like('field', pattern)
      const { params } = condition.toSQL()
      expect(params[0]).toBe(pattern)
    }
  })
})

describe('SQL Condition Helpers - Logical Operators', () => {
  test('and should combine conditions with AND', () => {
    const condition = and(eq('name', 'Alice'), eq('age', 25))
    const { sql, params } = condition.toSQL()

    expect(sql).toContain('AND')
    expect(sql).toContain('"name" = $1')
    expect(sql).toContain('"age" = $2')
    expect(params).toEqual(['Alice', 25])
  })

  test('and should handle undefined/null conditions', () => {
    const condition = and(eq('name', 'Alice'), undefined, null, eq('age', 25))
    const { sql, params } = condition.toSQL()

    expect(sql).toContain('AND')
    expect(params).toEqual(['Alice', 25])
  })

  test('and with empty conditions should return empty', () => {
    const condition = and()
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('')
    expect(params).toEqual([])
  })

  test('or should combine conditions with OR', () => {
    const condition = or(eq('name', 'Alice'), eq('name', 'Bob'))
    const { sql, params } = condition.toSQL()

    expect(sql).toContain('OR')
    expect(params).toEqual(['Alice', 'Bob'])
  })

  test('or should handle undefined/null conditions', () => {
    const condition = or(eq('a', 1), undefined, null, eq('b', 2))
    const { sql, params } = condition.toSQL()

    expect(sql).toContain('OR')
    expect(params).toEqual([1, 2])
  })

  test('or with empty conditions should return empty', () => {
    const condition = or()
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('')
    expect(params).toEqual([])
  })

  test('not should negate condition', () => {
    const condition = not(eq('status', 'deleted'))
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('NOT ("status" = $1)')
    expect(params).toEqual(['deleted'])
  })

  test('not with empty condition should return empty', () => {
    const condition = not(and())
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('')
    expect(params).toEqual([])
  })

  test('deeply nested logical operators', () => {
    const condition = and(
      eq('status', 'active'),
      or(and(gte('age', 18), lte('age', 65)), eq('verified', true)),
      not(eq('banned', true)),
    )

    const { sql, params } = condition.toSQL()

    expect(sql).toContain('AND')
    expect(sql).toContain('OR')
    expect(sql).toContain('NOT')
    expect(params.length).toBe(5)
  })

  test('parameter numbering should be correct across nested conditions', () => {
    const condition = and(eq('a', 1), or(eq('b', 2), eq('c', 3)), eq('d', 4))

    const { sql, params } = condition.toSQL()

    expect(params).toEqual([1, 2, 3, 4])
    expect(sql).toContain('$1')
    expect(sql).toContain('$2')
    expect(sql).toContain('$3')
    expect(sql).toContain('$4')
  })
})

describe('SQL Condition Helpers - Existence Operators', () => {
  test('exists should create EXISTS condition', () => {
    const condition = exists('SELECT 1 FROM users WHERE id = $1', [123])
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('EXISTS (SELECT 1 FROM users WHERE id = $1)')
    expect(params).toEqual([123])
  })

  test('notExists should create NOT EXISTS condition', () => {
    const condition = notExists('SELECT 1 FROM bans WHERE user_id = $1', [456])
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('NOT EXISTS (SELECT 1 FROM bans WHERE user_id = $1)')
    expect(params).toEqual([456])
  })

  test('exists without params', () => {
    const condition = exists('SELECT 1')
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('EXISTS (SELECT 1)')
    expect(params).toEqual([])
  })
})

// ============================================================================
// SQL Expression Tests
// ============================================================================

describe('SQL Template Literal', () => {
  test('should create SQL expression with parameters', () => {
    const amount = 100
    const expr = sql`balance - ${amount}`

    expect(expr._type).toBe('sql')
    expect(expr.template).toBe('balance - $1')
    expect(expr.values).toEqual([100])
  })

  test('should handle multiple parameters', () => {
    const expr = sql`price * ${1.1} + ${5}`

    expect(expr.template).toBe('price * $1 + $2')
    expect(expr.values).toEqual([1.1, 5])
  })

  test('should handle no parameters', () => {
    const expr = sql`NOW()`

    expect(expr.template).toBe('NOW()')
    expect(expr.values).toEqual([])
  })

  test('should handle string parameters', () => {
    const prefix = 'user_'
    const expr = sql`CONCAT(${prefix}, id)`

    expect(expr.template).toBe('CONCAT($1, id)')
    expect(expr.values).toEqual(['user_'])
  })
})

// ============================================================================
// Aggregate Functions Tests
// ============================================================================

describe('Aggregate Functions', () => {
  test('count() without column should return COUNT(*)', () => {
    const expr = count()

    expect(expr.template).toBe('COUNT(*)')
    expect(expr.values).toEqual([])
  })

  test('count(column) should return COUNT(column)', () => {
    const expr = count('id')

    // count() with string column uses unquoted column name
    expect(expr.template).toBe('COUNT(id)')
    expect(expr.values).toEqual([])
  })

  test('count with column ref', () => {
    const column = col('user_id')
    const expr = count(column)

    expect(expr.template).toBe('COUNT("user_id")')
  })

  test('sum should return SUM(column)', () => {
    const expr = sum('amount')

    expect(expr.template).toBe('SUM("amount")')
    expect(expr.values).toEqual([])
  })

  test('avg should return AVG(column)', () => {
    const expr = avg('score')

    expect(expr.template).toBe('AVG("score")')
    expect(expr.values).toEqual([])
  })

  test('min should return MIN(column)', () => {
    const expr = min('price')

    expect(expr.template).toBe('MIN("price")')
    expect(expr.values).toEqual([])
  })

  test('max should return MAX(column)', () => {
    const expr = max('price')

    expect(expr.template).toBe('MAX("price")')
    expect(expr.values).toEqual([])
  })
})

// ============================================================================
// Order By Helpers Tests
// ============================================================================

describe('Order By Helpers', () => {
  test('asc should create ascending order', () => {
    const order = asc('name')

    expect(order.column).toBe('name')
    expect(order.direction).toBe('asc')
  })

  test('desc should create descending order', () => {
    const order = desc('createdAt')

    expect(order.column).toBe('createdAt')
    expect(order.direction).toBe('desc')
  })

  test('asc with column ref', () => {
    const column = col('priority')
    const order = asc(column)

    expect(order.column).toBe('priority')
    expect(order.direction).toBe('asc')
  })

  test('desc with column ref', () => {
    const column = col('updatedAt')
    const order = desc(column)

    expect(order.column).toBe('updatedAt')
    expect(order.direction).toBe('desc')
  })
})

// ============================================================================
// Column Reference Tests
// ============================================================================

describe('Column Reference', () => {
  test('col should create simple column reference', () => {
    const column = col('name')

    expect(column.name).toBe('name')
    expect(column.table).toBeUndefined()
    expect(column._type).toBe('column')
  })

  test('col should create qualified column reference', () => {
    const column = col('id', 'users')

    expect(column.name).toBe('id')
    expect(column.table).toBe('users')
  })

  test('col should work with special characters in name', () => {
    const column = col('created_at')

    expect(column.name).toBe('created_at')
  })
})

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('Type Guards', () => {
  test('isSQLCondition should identify conditions', () => {
    expect(isSQLCondition(eq('a', 1))).toBe(true)
    expect(isSQLCondition(and(eq('a', 1)))).toBe(true)
    expect(isSQLCondition(or(eq('a', 1)))).toBe(true)
    expect(isSQLCondition(not(eq('a', 1)))).toBe(true)
  })

  test('isSQLCondition should reject non-conditions', () => {
    expect(isSQLCondition(null)).toBe(false)
    expect(isSQLCondition(undefined)).toBe(false)
    expect(isSQLCondition('string')).toBe(false)
    expect(isSQLCondition(123)).toBe(false)
    expect(isSQLCondition({})).toBe(false)
    expect(isSQLCondition([])).toBe(false)
  })

  test('isSQLExpression should identify expressions', () => {
    expect(isSQLExpression(sql`NOW()`)).toBe(true)
    expect(isSQLExpression(count())).toBe(true)
    expect(isSQLExpression(sum('amount'))).toBe(true)
  })

  test('isSQLExpression should reject non-expressions', () => {
    expect(isSQLExpression(null)).toBe(false)
    expect(isSQLExpression(undefined)).toBe(false)
    expect(isSQLExpression(eq('a', 1))).toBe(false)
    expect(isSQLExpression('string')).toBe(false)
  })

  test('isColumnRef should identify column references', () => {
    expect(isColumnRef(col('name'))).toBe(true)
    expect(isColumnRef(col('id', 'users'))).toBe(true)
  })

  test('isColumnRef should reject non-columns', () => {
    expect(isColumnRef(null)).toBe(false)
    expect(isColumnRef(undefined)).toBe(false)
    expect(isColumnRef('name')).toBe(false)
    expect(isColumnRef(eq('a', 1))).toBe(false)
  })
})

// ============================================================================
// Fuzzing Tests
// ============================================================================

describe('Fuzzing - Random Inputs', () => {
  test('eq should handle random strings', () => {
    for (let i = 0; i < 100; i++) {
      const str = randomString(randomInt(0, 50))
      const condition = eq('field', str)
      const { sql, params } = condition.toSQL()

      expect(sql).toBe('"field" = $1')
      expect(params).toEqual([str])
    }
  })

  test('eq should handle random numbers', () => {
    for (let i = 0; i < 100; i++) {
      const num = randomInt(-1000000, 1000000)
      const condition = eq('field', num)
      const { sql, params } = condition.toSQL()

      expect(sql).toBe('"field" = $1')
      expect(params).toEqual([num])
    }
  })

  test('inArray should handle random arrays', () => {
    for (let i = 0; i < 50; i++) {
      const values = Array.from({ length: randomInt(1, 20) }, () =>
        randomString(10),
      )
      const condition = inArray('field', values)
      const { params } = condition.toSQL()

      expect(params).toEqual(values)
    }
  })

  test('and should handle random number of conditions', () => {
    for (let i = 0; i < 50; i++) {
      const numConditions = randomInt(1, 10)
      const conditions = Array.from({ length: numConditions }, (_, j) =>
        eq(`field${j}`, randomString(5)),
      )

      const combined = and(...conditions)
      const { sql, params } = combined.toSQL()

      expect(params.length).toBe(numConditions)
      if (numConditions > 1) {
        expect(sql).toContain('AND')
      }
    }
  })

  test('or should handle random number of conditions', () => {
    for (let i = 0; i < 50; i++) {
      const numConditions = randomInt(1, 10)
      const conditions = Array.from({ length: numConditions }, (_, j) =>
        eq(`field${j}`, randomInt(0, 100)),
      )

      const combined = or(...conditions)
      const { sql, params } = combined.toSQL()

      expect(params.length).toBe(numConditions)
      if (numConditions > 1) {
        expect(sql).toContain('OR')
      }
    }
  })

  test('complex random queries', () => {
    for (let i = 0; i < 50; i++) {
      const conditions: ReturnType<typeof eq>[] = []

      // Add random eq conditions
      for (let j = 0; j < randomInt(1, 3); j++) {
        conditions.push(eq(`field${j}`, randomString(5)))
      }

      // Maybe add comparison
      if (randomBool()) {
        conditions.push(gt('age', randomInt(1, 100)))
      }

      // Maybe add IN
      if (randomBool()) {
        conditions.push(
          inArray(
            'status',
            Array.from({ length: randomInt(1, 5) }, () => randomString(3)),
          ),
        )
      }

      // Combine with AND
      const query = and(...conditions)
      const { sql, params } = query.toSQL()

      // Should produce valid SQL
      expect(typeof sql).toBe('string')
      expect(Array.isArray(params)).toBe(true)
    }
  })
})

// ============================================================================
// SQL Injection Prevention Tests
// ============================================================================

describe('SQL Injection Prevention', () => {
  const injectionAttempts = [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    '1; DELETE FROM users',
    "' UNION SELECT * FROM secrets --",
    '/**/OR/**/1=1',
    "'; EXEC xp_cmdshell('dir'); --",
    "' AND 1=CONVERT(int, (SELECT TOP 1 password FROM users))--",
  ]

  test('eq should parameterize injection attempts', () => {
    for (const attempt of injectionAttempts) {
      const condition = eq('field', attempt)
      const { sql, params } = condition.toSQL()

      // SQL should be safe template
      expect(sql).toBe('"field" = $1')
      // Dangerous content in params, not SQL
      expect(params).toEqual([attempt])
      expect(sql).not.toContain(attempt)
    }
  })

  test('like should parameterize injection attempts', () => {
    for (const attempt of injectionAttempts) {
      const condition = like('field', attempt)
      const { sql, params } = condition.toSQL()

      expect(sql).toBe('"field" LIKE $1')
      expect(params).toEqual([attempt])
      expect(sql).not.toContain(attempt)
    }
  })

  test('inArray should parameterize injection attempts', () => {
    const condition = inArray('field', injectionAttempts)
    const { sql, params } = condition.toSQL()

    expect(sql).toContain('IN (')
    expect(params).toEqual(injectionAttempts)

    for (const attempt of injectionAttempts) {
      expect(sql).not.toContain(attempt)
    }
  })

  test('between should parameterize injection attempts', () => {
    const condition = between(
      'field',
      injectionAttempts[0],
      injectionAttempts[1],
    )
    const { sql, params } = condition.toSQL()

    expect(sql).toBe('"field" BETWEEN $1 AND $2')
    expect(params).toEqual([injectionAttempts[0], injectionAttempts[1]])
  })
})

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  test('should handle 1000 simple conditions efficiently', () => {
    const start = performance.now()

    for (let i = 0; i < 1000; i++) {
      const condition = eq('field', `value${i}`)
      condition.toSQL()
    }

    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(500)
  })

  test('should handle large AND chains', () => {
    const conditions = Array.from({ length: 100 }, (_, i) => eq(`field${i}`, i))

    const start = performance.now()
    const combined = and(...conditions)
    combined.toSQL()
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
  })

  test('should handle large IN arrays', () => {
    const values = Array.from({ length: 10000 }, (_, i) => `value${i}`)

    const start = performance.now()
    const condition = inArray('field', values)
    const { params } = condition.toSQL()
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(500)
    expect(params.length).toBe(10000)
  })

  test('should handle deeply nested conditions', () => {
    let condition = eq('leaf', 'value')

    for (let i = 0; i < 20; i++) {
      condition = and(eq(`level${i}`, i), or(condition, eq('alt', i)))
    }

    const start = performance.now()
    condition.toSQL()
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
  })
})
