/**
 * Drizzle-Compatible Transaction Layer
 *
 * Provides Drizzle-like chainable API that converts to raw SQL for CQL.
 * This allows existing code using `tx.update(table).set({}).where()` to work
 * with the CQL backend without changes.
 */

import type { ExecResult, QueryParam } from '@jejunetwork/db';
import {
  and,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
} from 'drizzle-orm';
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core';

// Use a broader table type that accepts any PgTable
type AnyPgTable = PgTable<TableConfig>;

// ============================================================================
// Types
// ============================================================================

export type DrizzleSQLValue =
  | string
  | number
  | boolean
  | null
  | Date
  | bigint
  | string[]
  | number[]
  | boolean[]
  | undefined;

export interface DrizzleCondition {
  toSQL(): { sql: string; params: QueryParam[] };
}

export interface TransactionExecutor {
  query<T>(sql: string, params?: QueryParam[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: QueryParam[]): Promise<T | null>;
  exec(sql: string, params?: QueryParam[]): Promise<ExecResult>;
}

// ============================================================================
// Query Builders
// ============================================================================

class SelectBuilder<T> {
  private tableName: string;
  private whereClause: string = '';
  private whereParams: QueryParam[] = [];
  private orderByClause: string = '';
  private limitValue: number | null = null;
  private executor: TransactionExecutor;

  constructor(table: AnyPgTable, executor: TransactionExecutor) {
    // Extract table name from Drizzle table object
    this.tableName = (table as unknown as { _: { name: string } })._.name;
    this.executor = executor;
  }

  where(condition: ReturnType<typeof eq | typeof and | typeof or>): this {
    const { sql, params } = serializeCondition(condition);
    this.whereClause = sql;
    this.whereParams = params;
    return this;
  }

  orderBy(
    ...columns: Array<{ column: string; direction: 'asc' | 'desc' }>
  ): this {
    this.orderByClause = columns
      .map((c) => `"${c.column}" ${c.direction.toUpperCase()}`)
      .join(', ');
    return this;
  }

  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  async then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    let sql = `SELECT * FROM "${this.tableName}"`;
    if (this.whereClause) {
      sql += ` WHERE ${this.whereClause}`;
    }
    if (this.orderByClause) {
      sql += ` ORDER BY ${this.orderByClause}`;
    }
    if (this.limitValue !== null) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    const result = await this.executor.query<T>(sql, this.whereParams);
    return onfulfilled ? onfulfilled(result) : (result as unknown as TResult1);
  }
}

class UpdateBuilder<T> {
  private tableName: string;
  private setData: Record<string, DrizzleSQLValue> = {};
  private whereClause: string = '';
  private whereParams: QueryParam[] = [];
  private executor: TransactionExecutor;

  constructor(table: AnyPgTable, executor: TransactionExecutor) {
    this.tableName = (table as unknown as { _: { name: string } })._.name;
    this.executor = executor;
  }

  set(data: Partial<T>): this {
    this.setData = data as Record<string, DrizzleSQLValue>;
    return this;
  }

  where(condition: ReturnType<typeof eq | typeof and | typeof or>): this {
    const { sql, params } = serializeCondition(condition);
    this.whereClause = sql;
    this.whereParams = params;
    return this;
  }

  async then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const columns = Object.keys(this.setData);
    const values = Object.values(this.setData);
    const setClauses = columns.map((col, i) => `"${col}" = $${i + 1}`);

    // Adjust where params offset
    const adjustedWhere = this.whereClause.replace(
      /\$(\d+)/g,
      (_, num) => `$${parseInt(num, 10) + columns.length}`
    );

    let sql = `UPDATE "${this.tableName}" SET ${setClauses.join(', ')}`;
    if (adjustedWhere) {
      sql += ` WHERE ${adjustedWhere}`;
    }
    sql += ' RETURNING *';

    const result = await this.executor.query<T>(sql, [
      ...(values as QueryParam[]),
      ...this.whereParams,
    ]);
    return onfulfilled ? onfulfilled(result) : (result as unknown as TResult1);
  }
}

class InsertBuilder<T> {
  private tableName: string;
  private data: Record<string, DrizzleSQLValue>[] = [];
  private executor: TransactionExecutor;

  constructor(table: AnyPgTable, executor: TransactionExecutor) {
    this.tableName = (table as unknown as { _: { name: string } })._.name;
    this.executor = executor;
  }

  values(data: Partial<T> | Partial<T>[]): this {
    this.data = (Array.isArray(data) ? data : [data]) as Record<
      string,
      DrizzleSQLValue
    >[];
    return this;
  }

  async then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    if (this.data.length === 0) {
      return onfulfilled ? onfulfilled([]) : ([] as unknown as TResult1);
    }

    const firstRecord = this.data[0];
    if (!firstRecord) {
      return onfulfilled ? onfulfilled([]) : ([] as unknown as TResult1);
    }

    const columns = Object.keys(firstRecord);
    const allValues: QueryParam[] = [];
    const valueSets: string[] = [];

    this.data.forEach((record, rowIndex) => {
      const placeholders = columns.map((col, colIndex) => {
        allValues.push(record[col] as QueryParam);
        return `$${rowIndex * columns.length + colIndex + 1}`;
      });
      valueSets.push(`(${placeholders.join(', ')})`);
    });

    const sql = `INSERT INTO "${this.tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES ${valueSets.join(', ')} RETURNING *`;

    const result = await this.executor.query<T>(sql, allValues);
    return onfulfilled ? onfulfilled(result) : (result as unknown as TResult1);
  }
}

class DeleteBuilder<T> {
  private tableName: string;
  private whereClause: string = '';
  private whereParams: QueryParam[] = [];
  private executor: TransactionExecutor;

  constructor(table: AnyPgTable, executor: TransactionExecutor) {
    this.tableName = (table as unknown as { _: { name: string } })._.name;
    this.executor = executor;
  }

  where(condition: ReturnType<typeof eq | typeof and | typeof or>): this {
    const { sql, params } = serializeCondition(condition);
    this.whereClause = sql;
    this.whereParams = params;
    return this;
  }

  async then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    let sql = `DELETE FROM "${this.tableName}"`;
    if (this.whereClause) {
      sql += ` WHERE ${this.whereClause}`;
    }
    sql += ' RETURNING *';

    const result = await this.executor.query<T>(sql, this.whereParams);
    return onfulfilled ? onfulfilled(result) : (result as unknown as TResult1);
  }
}

// ============================================================================
// Condition Serialization
// ============================================================================

function serializeCondition(
  condition: ReturnType<
    | typeof eq
    | typeof and
    | typeof or
    | typeof gt
    | typeof gte
    | typeof lt
    | typeof lte
    | typeof ne
    | typeof inArray
    | typeof isNull
  >
): { sql: string; params: QueryParam[] } {
  // Handle null/undefined
  if (!condition) {
    return { sql: '', params: [] };
  }

  // Drizzle conditions have a getSQL() method that returns SQL chunks
  // We need to serialize these to raw SQL
  const chunks = (
    condition as unknown as { getSQL(): { queryChunks: unknown[] } }
  ).getSQL?.();

  if (!chunks?.queryChunks) {
    // Fallback for simple conditions
    return serializeSimpleCondition(condition);
  }

  return serializeChunks(chunks.queryChunks);
}

function serializeSimpleCondition(condition: unknown): {
  sql: string;
  params: QueryParam[];
} {
  // Try to extract from the condition object structure
  const cond = condition as {
    _?: { column?: { name: string }; value?: unknown; operator?: string };
    column?: { name: string };
    value?: unknown;
    operator?: string;
  };

  const column = cond._?.column?.name ?? cond.column?.name;
  const value = cond._?.value ?? cond.value;
  const operator = cond._?.operator ?? cond.operator ?? '=';

  if (!column) {
    return { sql: '1=1', params: [] };
  }

  return { sql: `"${column}" ${operator} $1`, params: [value as QueryParam] };
}

function serializeChunks(chunks: unknown[]): {
  sql: string;
  params: QueryParam[];
} {
  const sqlParts: string[] = [];
  const params: QueryParam[] = [];
  let paramIndex = 1;

  for (const chunk of chunks) {
    if (typeof chunk === 'string') {
      sqlParts.push(chunk);
    } else if (chunk && typeof chunk === 'object') {
      const c = chunk as { name?: string; value?: unknown };
      if ('name' in c && c.name) {
        // Column reference
        sqlParts.push(`"${c.name}"`);
      } else if ('value' in c) {
        // Parameter value
        sqlParts.push(`$${paramIndex++}`);
        params.push(c.value as QueryParam);
      }
    }
  }

  return { sql: sqlParts.join(''), params };
}

// ============================================================================
// Drizzle-Compatible Transaction
// ============================================================================

export class DrizzleTransaction implements TransactionExecutor {
  private executor: TransactionExecutor;

  constructor(executor: TransactionExecutor) {
    this.executor = executor;
  }

  // Raw SQL methods (from TransactionContext)
  query<T>(sql: string, params?: QueryParam[]): Promise<T[]> {
    return this.executor.query<T>(sql, params);
  }

  queryOne<T>(sql: string, params?: QueryParam[]): Promise<T | null> {
    return this.executor.queryOne<T>(sql, params);
  }

  exec(sql: string, params?: QueryParam[]): Promise<ExecResult> {
    return this.executor.exec(sql, params);
  }

  // Drizzle-style chainable methods
  // select() can optionally take field mappings like db.select({ col: table.col })
  select<T extends Record<string, unknown> = Record<string, unknown>>(
    _fields?: T
  ): { from: (table: AnyPgTable) => SelectBuilder<T> } {
    // Note: _fields is used for TypeScript type inference but the actual
    // SQL always selects *, and we let TypeScript narrow the result type
    return {
      from: (table: AnyPgTable) => new SelectBuilder<T>(table, this),
    };
  }

  update<T>(table: AnyPgTable): UpdateBuilder<T> {
    return new UpdateBuilder<T>(table, this);
  }

  insert<T>(table: AnyPgTable): InsertBuilder<T> {
    return new InsertBuilder<T>(table, this);
  }

  delete<T>(table: AnyPgTable): DeleteBuilder<T> {
    return new DeleteBuilder<T>(table, this);
  }
}

// ============================================================================
// Export compatibility helpers
// ============================================================================

export function createDrizzleTransaction(
  executor: TransactionExecutor
): DrizzleTransaction {
  return new DrizzleTransaction(executor);
}
