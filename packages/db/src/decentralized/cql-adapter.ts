/**
 * CovenantSQL Adapter - Drizzle-like interface over CQL
 *
 * Provides familiar query patterns for Babylon while using
 * the real @jeju/db backend.
 */

import type { CQLClient, CQLConnection, QueryParam } from '@jeju/db';
import { getCQL } from '@jeju/db';

// Babylon-compatible types
export type SQLValue = QueryParam;

export interface SelectOptions {
  where?: string;
  whereParams?: SQLValue[];
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export interface CQLAdapter {
  select<T>(table: string, options?: SelectOptions): Promise<T[]>;
  selectOne<T>(
    table: string,
    where: string,
    params: SQLValue[]
  ): Promise<T | null>;
  insert<T extends Record<string, SQLValue>>(
    table: string,
    data: T
  ): Promise<string>;
  insertMany<T extends Record<string, SQLValue>>(
    table: string,
    data: T[]
  ): Promise<number>;
  update(
    table: string,
    data: Record<string, SQLValue>,
    where: string,
    params: SQLValue[]
  ): Promise<number>;
  delete(table: string, where: string, params: SQLValue[]): Promise<number>;
  count(table: string, where?: string, params?: SQLValue[]): Promise<number>;
  exists(table: string, where: string, params: SQLValue[]): Promise<boolean>;
  query<T>(sql: string, params?: SQLValue[]): Promise<T[]>;
  transaction<T>(fn: (tx: CQLTransactionAdapter) => Promise<T>): Promise<T>;
  initialize(): Promise<void>;
  close(): Promise<void>;
  getClient(): CQLClient;
}

export interface CQLTransactionAdapter {
  select<T>(table: string, options?: SelectOptions): Promise<T[]>;
  selectOne<T>(
    table: string,
    where: string,
    params: SQLValue[]
  ): Promise<T | null>;
  insert<T extends Record<string, SQLValue>>(
    table: string,
    data: T
  ): Promise<string>;
  update(
    table: string,
    data: Record<string, SQLValue>,
    where: string,
    params: SQLValue[]
  ): Promise<number>;
  delete(table: string, where: string, params: SQLValue[]): Promise<number>;
}

class CQLAdapterImpl implements CQLAdapter {
  private client: CQLClient | null = null;
  private conn: CQLConnection | null = null;

  async initialize(): Promise<void> {
    this.client = getCQL();
    const healthy = await this.client.isHealthy();
    if (!healthy) {
      throw new Error(
        '[CQLAdapter] CovenantSQL is not healthy. Cannot proceed.'
      );
    }
    // Get a connection from the pool
    this.conn = await this.client.connect();
  }

  getClient(): CQLClient {
    if (!this.client) {
      throw new Error('[CQLAdapter] Not initialized. Call initialize() first.');
    }
    return this.client;
  }

  private getConnection(): CQLConnection {
    if (!this.conn) {
      throw new Error('[CQLAdapter] Not initialized. Call initialize() first.');
    }
    return this.conn;
  }

  async select<T>(table: string, options: SelectOptions = {}): Promise<T[]> {
    let sql = `SELECT * FROM "${table}"`;
    const params: SQLValue[] = [];

    if (options.where) {
      sql += ` WHERE ${options.where}`;
      if (options.whereParams) {
        params.push(...options.whereParams);
      }
    }

    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }

    if (options.limit !== undefined) {
      sql += ` LIMIT ${options.limit}`;
    }

    if (options.offset !== undefined) {
      sql += ` OFFSET ${options.offset}`;
    }

    const result = await this.getConnection().query<T>(sql, params);
    return result.rows;
  }

  async selectOne<T>(
    table: string,
    where: string,
    params: SQLValue[]
  ): Promise<T | null> {
    const sql = `SELECT * FROM "${table}" WHERE ${where} LIMIT 1`;
    const result = await this.getConnection().query<T>(sql, params);
    return result.rows[0] ?? null;
  }

  async insert<T extends Record<string, SQLValue>>(
    table: string,
    data: T
  ): Promise<string> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING id`;

    const result = await this.getConnection().exec(sql, values);
    return result.lastInsertId?.toString() ?? '';
  }

  async insertMany<T extends Record<string, SQLValue>>(
    table: string,
    data: T[]
  ): Promise<number> {
    if (data.length === 0) return 0;

    const columns = Object.keys(data[0] as Record<string, SQLValue>);
    const allValues: SQLValue[] = [];
    const valueGroups: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const record = data[i] as Record<string, SQLValue>;
      const startIdx = i * columns.length;
      const placeholders = columns
        .map((_, j) => `$${startIdx + j + 1}`)
        .join(', ');
      valueGroups.push(`(${placeholders})`);

      for (const col of columns) {
        allValues.push(record[col] as SQLValue);
      }
    }

    const sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES ${valueGroups.join(', ')}`;
    const result = await this.getConnection().exec(sql, allValues);
    return result.rowsAffected;
  }

  async update(
    table: string,
    data: Record<string, SQLValue>,
    where: string,
    params: SQLValue[]
  ): Promise<number> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns
      .map((col, i) => `"${col}" = $${i + 1}`)
      .join(', ');
    const adjustedWhere = this.adjustPlaceholders(where, columns.length);

    const sql = `UPDATE "${table}" SET ${setClause} WHERE ${adjustedWhere}`;
    const result = await this.getConnection().exec(sql, [...values, ...params]);
    return result.rowsAffected;
  }

  async delete(
    table: string,
    where: string,
    params: SQLValue[]
  ): Promise<number> {
    const sql = `DELETE FROM "${table}" WHERE ${where}`;
    const result = await this.getConnection().exec(sql, params);
    return result.rowsAffected;
  }

  async count(
    table: string,
    where?: string,
    params?: SQLValue[]
  ): Promise<number> {
    const sql = where
      ? `SELECT COUNT(*) as count FROM "${table}" WHERE ${where}`
      : `SELECT COUNT(*) as count FROM "${table}"`;
    const result = await this.getConnection().query<{ count: number }>(
      sql,
      params
    );
    return result.rows[0]?.count ?? 0;
  }

  async exists(
    table: string,
    where: string,
    params: SQLValue[]
  ): Promise<boolean> {
    const sql = `SELECT 1 FROM "${table}" WHERE ${where} LIMIT 1`;
    const result = await this.getConnection().query(sql, params);
    return result.rowCount > 0;
  }

  async query<T>(sql: string, params: SQLValue[] = []): Promise<T[]> {
    const result = await this.getConnection().query<T>(sql, params);
    return result.rows;
  }

  async transaction<T>(
    fn: (tx: CQLTransactionAdapter) => Promise<T>
  ): Promise<T> {
    const jejuTx = await this.getConnection().beginTransaction();

    const txAdapter: CQLTransactionAdapter = {
      select: async <U>(
        table: string,
        options: SelectOptions = {}
      ): Promise<U[]> => {
        let sql = `SELECT * FROM "${table}"`;
        const params: SQLValue[] = [];

        if (options.where) {
          sql += ` WHERE ${options.where}`;
          if (options.whereParams) params.push(...options.whereParams);
        }
        if (options.orderBy) sql += ` ORDER BY ${options.orderBy}`;
        if (options.limit !== undefined) sql += ` LIMIT ${options.limit}`;
        if (options.offset !== undefined) sql += ` OFFSET ${options.offset}`;

        const result = await jejuTx.query<U>(sql, params);
        return result.rows;
      },

      selectOne: async <U>(
        table: string,
        where: string,
        params: SQLValue[]
      ): Promise<U | null> => {
        const sql = `SELECT * FROM "${table}" WHERE ${where} LIMIT 1`;
        const result = await jejuTx.query<U>(sql, params);
        return result.rows[0] ?? null;
      },

      insert: async <U extends Record<string, SQLValue>>(
        table: string,
        data: U
      ): Promise<string> => {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING id`;
        const result = await jejuTx.exec(sql, values);
        return result.lastInsertId?.toString() ?? '';
      },

      update: async (
        table: string,
        data: Record<string, SQLValue>,
        where: string,
        params: SQLValue[]
      ): Promise<number> => {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const setClause = columns
          .map((col, i) => `"${col}" = $${i + 1}`)
          .join(', ');
        const adjustedWhere = where.replace(
          /\$(\d+)/g,
          (_, num) => `$${parseInt(num, 10) + columns.length}`
        );
        const sql = `UPDATE "${table}" SET ${setClause} WHERE ${adjustedWhere}`;
        const result = await jejuTx.exec(sql, [...values, ...params]);
        return result.rowsAffected;
      },

      delete: async (
        table: string,
        where: string,
        params: SQLValue[]
      ): Promise<number> => {
        const sql = `DELETE FROM "${table}" WHERE ${where}`;
        const result = await jejuTx.exec(sql, params);
        return result.rowsAffected;
      },
    };

    try {
      const result = await fn(txAdapter);
      await jejuTx.commit();
      return result;
    } catch (error) {
      await jejuTx.rollback();
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.conn) {
      await this.conn.close();
      this.conn = null;
    }
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  private adjustPlaceholders(sql: string, offset: number): string {
    return sql.replace(
      /\$(\d+)/g,
      (_, num) => `$${parseInt(num, 10) + offset}`
    );
  }
}

// Singleton instance
let adapter: CQLAdapter | null = null;

export function getCQLAdapter(): CQLAdapter {
  if (!adapter) {
    adapter = new CQLAdapterImpl();
  }
  return adapter;
}

export async function initializeCQLAdapter(): Promise<CQLAdapter> {
  const a = getCQLAdapter();
  await a.initialize();
  return a;
}

export function resetCQLAdapter(): void {
  if (adapter) {
    adapter.close();
    adapter = null;
  }
}

// Re-export from real Jeju CQL
export { getCQL as getCQLClient, resetCQL as resetCQLClient } from '@jeju/db';
