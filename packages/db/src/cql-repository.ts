/**
 * CQL Table Repository
 *
 * Provides an ORM-style API (findUnique, findMany, create, update, delete)
 * backed by CovenantSQL (CQL) instead of PostgreSQL.
 *
 * This replaces the Drizzle-based TableRepository for decentralized operation.
 */

import type { QueryParam } from '@jeju/db';
import {
  type DecentralizedDB,
  getDB,
  initializeDB,
  resetDB,
} from './decentralized/db';

// ============================================================================
// Types
// ============================================================================

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export type SQLValue =
  | string
  | number
  | boolean
  | null
  | Date
  | bigint
  | string[]
  | number[]
  | boolean[]
  | JsonValue
  | JsonValue[];

type DatabaseValue =
  | SQLValue
  | JsonValue
  | { [key: string]: DatabaseValue }
  | DatabaseValue[];

type WhereValue<T> =
  | T
  | {
      equals?: T;
      not?: T | { equals?: T };
      in?: T[];
      notIn?: T[];
      lt?: T;
      lte?: T;
      gt?: T;
      gte?: T;
      contains?: string;
      startsWith?: string;
      endsWith?: string;
      mode?: 'insensitive';
    }
  | null
  | undefined;

type WhereInput<TTable> = {
  [K in keyof TTable]?: WhereValue<TTable[K]>;
} & {
  AND?: WhereInput<TTable> | WhereInput<TTable>[];
  OR?: WhereInput<TTable>[];
  NOT?: WhereInput<TTable> | WhereInput<TTable>[];
};

type OrderByInput<TTable> = {
  [K in keyof TTable]?: 'asc' | 'desc';
};

type IncludeInput = Record<
  string,
  | boolean
  | {
      select?: Record<string, boolean>;
      include?: IncludeInput;
      where?: Record<string, SQLValue | WhereValue<SQLValue>>;
      take?: number;
      orderBy?: Record<string, 'asc' | 'desc'>;
    }
>;

type SelectInput = Record<string, boolean>;

interface FindOptions<TSelect> {
  where?: WhereInput<TSelect>;
  orderBy?: OrderByInput<TSelect> | OrderByInput<TSelect>[];
  take?: number;
  skip?: number;
  include?: IncludeInput;
  select?: SelectInput;
}

interface CreateOptions<TInsert> {
  data: TInsert;
  select?: SelectInput;
  include?: IncludeInput;
}

type UpdateData<TInsert> = {
  [K in keyof TInsert]?:
    | TInsert[K]
    | { increment: number }
    | { decrement: number };
};

interface UpdateOptions<TSelect, TInsert> {
  where: WhereInput<TSelect>;
  data: UpdateData<TInsert>;
  select?: SelectInput;
  include?: IncludeInput;
}

interface DeleteOptions<TSelect> {
  where: WhereInput<TSelect>;
  select?: SelectInput;
}

interface UpsertOptions<TSelect, TInsert> {
  where: WhereInput<TSelect>;
  create: TInsert;
  update: Partial<TInsert>;
  include?: IncludeInput;
}

// ============================================================================
// SQL Building Helpers
// ============================================================================

function buildWhereClause<
  TWhere extends Record<string, DatabaseValue | JsonValue>,
>(
  where: WhereInput<TWhere> | undefined,
  params: QueryParam[],
  paramOffset = 0
): { sql: string; newOffset: number } {
  if (!where) return { sql: '', newOffset: paramOffset };

  const conditions: string[] = [];
  let offset = paramOffset;

  for (const [key, value] of Object.entries(where)) {
    if (key === 'AND') {
      const andConditions = Array.isArray(value) ? value : [value];
      const andClauses: string[] = [];
      for (const w of andConditions) {
        const result = buildWhereClause(
          w as WhereInput<Record<string, DatabaseValue | JsonValue>>,
          params,
          offset
        );
        if (result.sql) {
          andClauses.push(`(${result.sql})`);
          offset = result.newOffset;
        }
      }
      if (andClauses.length > 0) {
        conditions.push(`(${andClauses.join(' AND ')})`);
      }
      continue;
    }

    if (key === 'OR') {
      const orConditions = value as WhereInput<
        Record<string, DatabaseValue | JsonValue>
      >[];
      const orClauses: string[] = [];
      for (const w of orConditions) {
        const result = buildWhereClause(w, params, offset);
        if (result.sql) {
          orClauses.push(`(${result.sql})`);
          offset = result.newOffset;
        }
      }
      if (orClauses.length > 0) {
        conditions.push(`(${orClauses.join(' OR ')})`);
      }
      continue;
    }

    if (key === 'NOT') {
      const result = buildWhereClause(
        value as WhereInput<Record<string, DatabaseValue | JsonValue>>,
        params,
        offset
      );
      if (result.sql) {
        conditions.push(`NOT (${result.sql})`);
        offset = result.newOffset;
      }
      continue;
    }

    if (value === null) {
      conditions.push(`"${key}" IS NULL`);
      continue;
    }

    if (value === undefined) continue;

    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      const ops = value as Record<string, DatabaseValue>;

      if ('equals' in ops) {
        if (ops.equals === null) {
          conditions.push(`"${key}" IS NULL`);
        } else {
          offset++;
          params.push(ops.equals as QueryParam);
          conditions.push(`"${key}" = $${offset}`);
        }
      }
      if ('not' in ops) {
        if (ops.not === null) {
          conditions.push(`"${key}" IS NOT NULL`);
        } else if (
          typeof ops.not === 'object' &&
          ops.not !== null &&
          'equals' in ops.not
        ) {
          const notEqualsValue = (ops.not as { equals: DatabaseValue }).equals;
          offset++;
          params.push(notEqualsValue as QueryParam);
          conditions.push(`"${key}" != $${offset}`);
        } else {
          offset++;
          params.push(ops.not as QueryParam);
          conditions.push(`"${key}" != $${offset}`);
        }
      }
      if ('in' in ops && Array.isArray(ops.in)) {
        const placeholders = ops.in.map(() => {
          offset++;
          return `$${offset}`;
        });
        params.push(...(ops.in as QueryParam[]));
        conditions.push(`"${key}" IN (${placeholders.join(', ')})`);
      }
      if ('notIn' in ops && Array.isArray(ops.notIn)) {
        const placeholders = ops.notIn.map(() => {
          offset++;
          return `$${offset}`;
        });
        params.push(...(ops.notIn as QueryParam[]));
        conditions.push(`"${key}" NOT IN (${placeholders.join(', ')})`);
      }
      if ('lt' in ops) {
        offset++;
        params.push(ops.lt as QueryParam);
        conditions.push(`"${key}" < $${offset}`);
      }
      if ('lte' in ops) {
        offset++;
        params.push(ops.lte as QueryParam);
        conditions.push(`"${key}" <= $${offset}`);
      }
      if ('gt' in ops) {
        offset++;
        params.push(ops.gt as QueryParam);
        conditions.push(`"${key}" > $${offset}`);
      }
      if ('gte' in ops) {
        offset++;
        params.push(ops.gte as QueryParam);
        conditions.push(`"${key}" >= $${offset}`);
      }
      if ('contains' in ops) {
        const mode = (ops as { mode?: string }).mode;
        offset++;
        params.push(`%${ops.contains}%` as QueryParam);
        if (mode === 'insensitive') {
          conditions.push(`"${key}" ILIKE $${offset}`);
        } else {
          conditions.push(`"${key}" LIKE $${offset}`);
        }
      }
      if ('startsWith' in ops) {
        const mode = (ops as { mode?: string }).mode;
        offset++;
        params.push(`${ops.startsWith}%` as QueryParam);
        if (mode === 'insensitive') {
          conditions.push(`"${key}" ILIKE $${offset}`);
        } else {
          conditions.push(`"${key}" LIKE $${offset}`);
        }
      }
      if ('endsWith' in ops) {
        const mode = (ops as { mode?: string }).mode;
        offset++;
        params.push(`%${ops.endsWith}` as QueryParam);
        if (mode === 'insensitive') {
          conditions.push(`"${key}" ILIKE $${offset}`);
        } else {
          conditions.push(`"${key}" LIKE $${offset}`);
        }
      }
    } else {
      offset++;
      params.push(value as QueryParam);
      conditions.push(`"${key}" = $${offset}`);
    }
  }

  return {
    sql: conditions.length > 0 ? conditions.join(' AND ') : '',
    newOffset: offset,
  };
}

function buildOrderByClause<TOrder extends Record<string, DatabaseValue>>(
  orderBy: OrderByInput<TOrder> | OrderByInput<TOrder>[] | undefined
): string {
  if (!orderBy) return '';

  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  const clauses: string[] = [];

  for (const order of orders) {
    for (const [key, direction] of Object.entries(order)) {
      clauses.push(`"${key}" ${direction?.toUpperCase() ?? 'ASC'}`);
    }
  }

  return clauses.length > 0 ? ` ORDER BY ${clauses.join(', ')}` : '';
}

// ============================================================================
// CQL Table Repository
// ============================================================================

export class CQLTableRepository<
  TSelect extends Record<string, DatabaseValue | JsonValue>,
  TInsert extends Record<string, DatabaseValue | JsonValue>,
> {
  constructor(
    private readonly tableName: string,
    private readonly getDbInstance: () => DecentralizedDB
  ) {}

  private get db(): DecentralizedDB {
    return this.getDbInstance();
  }

  async findUnique(options: FindOptions<TSelect>): Promise<TSelect | null> {
    const params: QueryParam[] = [];
    const { sql: whereSQL } = buildWhereClause(options.where, params);

    let query = `SELECT * FROM "${this.tableName}"`;
    if (whereSQL) {
      query += ` WHERE ${whereSQL}`;
    }
    query += ' LIMIT 1';

    const result = await this.db.queryOne<TSelect>(query, params);
    return result;
  }

  async findUniqueOrThrow(options: FindOptions<TSelect>): Promise<TSelect> {
    const result = await this.findUnique(options);
    if (!result) {
      throw new Error(`Record not found in ${this.tableName}`);
    }
    return result;
  }

  async findFirst(options: FindOptions<TSelect> = {}): Promise<TSelect | null> {
    const params: QueryParam[] = [];
    const { sql: whereSQL } = buildWhereClause(options.where, params);
    const orderBySQL = buildOrderByClause(options.orderBy);

    let query = `SELECT * FROM "${this.tableName}"`;
    if (whereSQL) {
      query += ` WHERE ${whereSQL}`;
    }
    query += orderBySQL;
    if (options.skip) {
      query += ` OFFSET ${options.skip}`;
    }
    query += ' LIMIT 1';

    return this.db.queryOne<TSelect>(query, params);
  }

  async findFirstOrThrow(options: FindOptions<TSelect> = {}): Promise<TSelect> {
    const result = await this.findFirst(options);
    if (!result) {
      throw new Error(`Record not found in ${this.tableName}`);
    }
    return result;
  }

  async findMany(options: FindOptions<TSelect> = {}): Promise<TSelect[]> {
    const params: QueryParam[] = [];
    const { sql: whereSQL } = buildWhereClause(options.where, params);
    const orderBySQL = buildOrderByClause(options.orderBy);

    let query = `SELECT * FROM "${this.tableName}"`;
    if (whereSQL) {
      query += ` WHERE ${whereSQL}`;
    }
    query += orderBySQL;
    if (options.take) {
      query += ` LIMIT ${options.take}`;
    }
    if (options.skip) {
      query += ` OFFSET ${options.skip}`;
    }

    return this.db.query<TSelect>(query, params);
  }

  async create(options: CreateOptions<TInsert>): Promise<TSelect> {
    const columns = Object.keys(options.data);
    const values = Object.values(options.data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const query = `INSERT INTO "${this.tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

    const result = await this.db.queryOne<TSelect>(
      query,
      values as QueryParam[]
    );
    if (!result) {
      throw new Error(`Failed to create record in ${this.tableName}`);
    }
    return result;
  }

  async createMany(options: {
    data: TInsert[];
    skipDuplicates?: boolean;
  }): Promise<{ count: number }> {
    if (options.data.length === 0) return { count: 0 };

    const firstRecord = options.data[0];
    if (!firstRecord) return { count: 0 };

    const columns = Object.keys(firstRecord);
    const allValues: QueryParam[] = [];
    const valueSets: string[] = [];

    options.data.forEach((record, rowIndex) => {
      const placeholders = columns.map((col, colIndex) => {
        allValues.push(record[col] as QueryParam);
        return `$${rowIndex * columns.length + colIndex + 1}`;
      });
      valueSets.push(`(${placeholders.join(', ')})`);
    });

    let query = `INSERT INTO "${this.tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES ${valueSets.join(', ')}`;

    if (options.skipDuplicates) {
      query += ' ON CONFLICT DO NOTHING';
    }

    await this.db.exec(query, allValues);
    return { count: options.data.length };
  }

  async update(options: UpdateOptions<TSelect, TInsert>): Promise<TSelect> {
    const params: QueryParam[] = [];
    const setClauses: string[] = [];
    let paramIndex = 0;

    for (const [key, value] of Object.entries(options.data)) {
      if (value === undefined) continue;

      if (
        typeof value === 'object' &&
        value !== null &&
        !(value instanceof Date)
      ) {
        if ('increment' in value) {
          setClauses.push(
            `"${key}" = "${key}" + ${(value as { increment: number }).increment}`
          );
        } else if ('decrement' in value) {
          setClauses.push(
            `"${key}" = "${key}" - ${(value as { decrement: number }).decrement}`
          );
        } else {
          paramIndex++;
          params.push(value as QueryParam);
          setClauses.push(`"${key}" = $${paramIndex}`);
        }
      } else {
        paramIndex++;
        params.push(value as QueryParam);
        setClauses.push(`"${key}" = $${paramIndex}`);
      }
    }

    const { sql: whereSQL, newOffset } = buildWhereClause(
      options.where,
      params,
      paramIndex
    );
    void newOffset; // consume the offset

    if (!whereSQL) {
      throw new Error('Update requires a where clause');
    }

    const query = `UPDATE "${this.tableName}" SET ${setClauses.join(', ')} WHERE ${whereSQL} RETURNING *`;

    const result = await this.db.queryOne<TSelect>(query, params);
    if (!result) {
      throw new Error(`Record not found for update in ${this.tableName}`);
    }
    return result;
  }

  async updateMany(
    options: UpdateOptions<TSelect, TInsert>
  ): Promise<{ count: number }> {
    const params: QueryParam[] = [];
    const setClauses: string[] = [];
    let paramIndex = 0;

    for (const [key, value] of Object.entries(options.data)) {
      if (value === undefined) continue;

      if (
        typeof value === 'object' &&
        value !== null &&
        !(value instanceof Date)
      ) {
        if ('increment' in value) {
          setClauses.push(
            `"${key}" = "${key}" + ${(value as { increment: number }).increment}`
          );
        } else if ('decrement' in value) {
          setClauses.push(
            `"${key}" = "${key}" - ${(value as { decrement: number }).decrement}`
          );
        } else {
          paramIndex++;
          params.push(value as QueryParam);
          setClauses.push(`"${key}" = $${paramIndex}`);
        }
      } else {
        paramIndex++;
        params.push(value as QueryParam);
        setClauses.push(`"${key}" = $${paramIndex}`);
      }
    }

    const { sql: whereSQL } = buildWhereClause(
      options.where,
      params,
      paramIndex
    );

    let query = `UPDATE "${this.tableName}" SET ${setClauses.join(', ')}`;
    if (whereSQL) {
      query += ` WHERE ${whereSQL}`;
    }

    const result = await this.db.exec(query, params);
    return { count: result.rowsAffected };
  }

  async delete(options: DeleteOptions<TSelect>): Promise<TSelect> {
    const params: QueryParam[] = [];
    const { sql: whereSQL } = buildWhereClause(options.where, params);

    if (!whereSQL) {
      throw new Error('Delete requires a where clause');
    }

    const query = `DELETE FROM "${this.tableName}" WHERE ${whereSQL} RETURNING *`;

    const result = await this.db.queryOne<TSelect>(query, params);
    if (!result) {
      throw new Error(`Record not found for delete in ${this.tableName}`);
    }
    return result;
  }

  async deleteMany(
    options: DeleteOptions<TSelect> = {} as DeleteOptions<TSelect>
  ): Promise<{ count: number }> {
    const params: QueryParam[] = [];
    const { sql: whereSQL } = buildWhereClause(options.where, params);

    let query = `DELETE FROM "${this.tableName}"`;
    if (whereSQL) {
      query += ` WHERE ${whereSQL}`;
    }

    const result = await this.db.exec(query, params);
    return { count: result.rowsAffected };
  }

  async upsert(options: UpsertOptions<TSelect, TInsert>): Promise<TSelect> {
    const params: QueryParam[] = [];
    const { sql: whereSQL } = buildWhereClause(options.where, params);

    // Try to find existing record
    let existingQuery = `SELECT * FROM "${this.tableName}"`;
    if (whereSQL) {
      existingQuery += ` WHERE ${whereSQL}`;
    }
    existingQuery += ' LIMIT 1';

    const existing = await this.db.queryOne<TSelect>(existingQuery, params);

    if (existing) {
      return this.update({
        where: options.where,
        data: options.update as UpdateData<TInsert>,
        include: options.include,
      });
    }
    return this.create({
      data: options.create,
      include: options.include,
    });
  }

  async count(options: { where?: WhereInput<TSelect> } = {}): Promise<number> {
    const params: QueryParam[] = [];
    const { sql: whereSQL } = buildWhereClause(options.where, params);

    let query = `SELECT COUNT(*) as count FROM "${this.tableName}"`;
    if (whereSQL) {
      query += ` WHERE ${whereSQL}`;
    }

    const result = await this.db.queryOne<{ count: number | string | bigint }>(
      query,
      params
    );
    return Number(result?.count ?? 0);
  }

  async aggregate(options: {
    where?: WhereInput<TSelect>;
    _count?: boolean | { _all?: boolean };
    _sum?: SelectInput;
    _avg?: SelectInput;
    _min?: SelectInput;
    _max?: SelectInput;
  }): Promise<{
    _count?: { _all: number } | number;
    _sum?: Record<string, number | null>;
    _avg?: Record<string, number | null>;
    _min?: Record<string, number | null>;
    _max?: Record<string, number | null>;
  }> {
    const params: QueryParam[] = [];
    const { sql: whereSQL } = buildWhereClause(options.where, params);
    const result: {
      _count?: { _all: number } | number;
      _sum?: Record<string, number | null>;
      _avg?: Record<string, number | null>;
      _min?: Record<string, number | null>;
      _max?: Record<string, number | null>;
    } = {};

    if (options._count) {
      let query = `SELECT COUNT(*) as count FROM "${this.tableName}"`;
      if (whereSQL) {
        query += ` WHERE ${whereSQL}`;
      }
      const countResult = await this.db.queryOne<{
        count: number | string | bigint;
      }>(query, params);
      result._count = { _all: Number(countResult?.count ?? 0) };
    }

    if (options._sum) {
      const sumResult: Record<string, number | null> = {};
      for (const [key, shouldSum] of Object.entries(options._sum)) {
        if (shouldSum) {
          let query = `SELECT SUM("${key}") as sum FROM "${this.tableName}"`;
          if (whereSQL) {
            query += ` WHERE ${whereSQL}`;
          }
          const queryResult = await this.db.queryOne<{ sum: number | null }>(
            query,
            [...params]
          );
          sumResult[key] =
            queryResult?.sum !== null ? Number(queryResult?.sum) : null;
        }
      }
      result._sum = sumResult;
    }

    if (options._avg) {
      const avgResult: Record<string, number | null> = {};
      for (const [key, shouldAvg] of Object.entries(options._avg)) {
        if (shouldAvg) {
          let query = `SELECT AVG("${key}") as avg FROM "${this.tableName}"`;
          if (whereSQL) {
            query += ` WHERE ${whereSQL}`;
          }
          const queryResult = await this.db.queryOne<{ avg: number | null }>(
            query,
            [...params]
          );
          avgResult[key] =
            queryResult?.avg !== null ? Number(queryResult?.avg) : null;
        }
      }
      result._avg = avgResult;
    }

    if (options._min) {
      const minResult: Record<string, number | null> = {};
      for (const [key, shouldMin] of Object.entries(options._min)) {
        if (shouldMin) {
          let query = `SELECT MIN("${key}") as min FROM "${this.tableName}"`;
          if (whereSQL) {
            query += ` WHERE ${whereSQL}`;
          }
          const queryResult = await this.db.queryOne<{ min: number | null }>(
            query,
            [...params]
          );
          minResult[key] =
            queryResult?.min !== null ? Number(queryResult?.min) : null;
        }
      }
      result._min = minResult;
    }

    if (options._max) {
      const maxResult: Record<string, number | null> = {};
      for (const [key, shouldMax] of Object.entries(options._max)) {
        if (shouldMax) {
          let query = `SELECT MAX("${key}") as max FROM "${this.tableName}"`;
          if (whereSQL) {
            query += ` WHERE ${whereSQL}`;
          }
          const queryResult = await this.db.queryOne<{ max: number | null }>(
            query,
            [...params]
          );
          maxResult[key] =
            queryResult?.max !== null ? Number(queryResult?.max) : null;
        }
      }
      result._max = maxResult;
    }

    return result;
  }

  async groupBy<TKey extends keyof TSelect>(options: {
    by: TKey[];
    where?: WhereInput<TSelect>;
    _count?: SelectInput | boolean;
    _sum?: SelectInput;
    _avg?: SelectInput;
    _min?: SelectInput;
    _max?: SelectInput;
    orderBy?: OrderByInput<TSelect>;
    take?: number;
  }): Promise<Array<Record<string, DatabaseValue | JsonValue>>> {
    const params: QueryParam[] = [];
    const { sql: whereSQL } = buildWhereClause(options.where, params);

    const selectFields: string[] = options.by.map((key) => `"${String(key)}"`);

    if (options._count) {
      selectFields.push('COUNT(*) as "_count"');
    }

    if (options._sum) {
      for (const [key, shouldSum] of Object.entries(options._sum)) {
        if (shouldSum) {
          selectFields.push(`SUM("${key}") as "_sum_${key}"`);
        }
      }
    }

    if (options._avg) {
      for (const [key, shouldAvg] of Object.entries(options._avg)) {
        if (shouldAvg) {
          selectFields.push(`AVG("${key}") as "_avg_${key}"`);
        }
      }
    }

    if (options._min) {
      for (const [key, shouldMin] of Object.entries(options._min)) {
        if (shouldMin) {
          selectFields.push(`MIN("${key}") as "_min_${key}"`);
        }
      }
    }

    if (options._max) {
      for (const [key, shouldMax] of Object.entries(options._max)) {
        if (shouldMax) {
          selectFields.push(`MAX("${key}") as "_max_${key}"`);
        }
      }
    }

    let query = `SELECT ${selectFields.join(', ')} FROM "${this.tableName}"`;
    if (whereSQL) {
      query += ` WHERE ${whereSQL}`;
    }
    query += ` GROUP BY ${options.by.map((k) => `"${String(k)}"`).join(', ')}`;
    query += buildOrderByClause(options.orderBy);
    if (options.take) {
      query += ` LIMIT ${options.take}`;
    }

    const results = await this.db.query<
      Record<string, DatabaseValue | JsonValue>
    >(query, params);
    return results;
  }
}

// ============================================================================
// Re-exports
// ============================================================================

export { getDB, initializeDB, resetDB };
export type { DecentralizedDB };
