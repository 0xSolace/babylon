/**
 * SQLite Encrypted State Store
 *
 * Local-first SQLite database for decentralized operation.
 * Features:
 * - Encrypted at-rest storage using TEE-derived keys
 * - IPFS backup and restore
 * - Key-value state storage
 * - Checkpoint versioning
 *
 * This provides a bridge between local operation and decentralized persistence.
 * State is stored locally in SQLite, encrypted, and synced to IPFS.
 */

import { Database } from 'bun:sqlite';
import { logger } from '@babylon/shared';
import type { Hex } from 'viem';
import { keccak256, toBytes } from 'viem';
import { getBabylonEnclave } from '../tee/babylon-enclave';
import { getJejuStorageClient, isJejuStorageAvailable } from './jeju-storage';

// ============================================================================
// Types
// ============================================================================

export interface SqliteStoreConfig {
  /** Database file path */
  dbPath: string;
  /** Enable encryption (requires TEE enclave) */
  encrypted: boolean;
  /** Auto-sync to IPFS */
  autoSync: boolean;
  /** Sync interval in ms */
  syncIntervalMs: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

export interface StateEntry {
  key: string;
  value: string;
  version: number;
  updatedAt: number;
  hash: Hex;
}

export interface SyncStatus {
  lastSyncAt: number;
  pendingChanges: number;
  lastIpfsCid: string | null;
  syncInProgress: boolean;
}

// ============================================================================
// SQLite Encrypted State Store
// ============================================================================

export class SqliteEncryptedStore {
  private config: SqliteStoreConfig;
  private db: Database | null = null;
  private encryptionKey: Uint8Array | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private pendingChanges = 0;
  private lastSyncAt = 0;
  private lastIpfsCid: string | null = null;
  private syncInProgress = false;

  constructor(config: Partial<SqliteStoreConfig> = {}) {
    this.config = {
      dbPath: config.dbPath ?? ':memory:',
      encrypted: config.encrypted ?? true,
      autoSync: config.autoSync ?? true,
      syncIntervalMs: config.syncIntervalMs ?? 5 * 60 * 1000, // 5 minutes
      verbose: config.verbose ?? false,
    };
  }

  /**
   * Initialize the store
   */
  async initialize(): Promise<void> {
    // Initialize encryption key from TEE if enabled
    if (this.config.encrypted) {
      const enclave = await getBabylonEnclave({ verbose: this.config.verbose });
      const attestation = enclave.getAttestation();
      this.encryptionKey = new Uint8Array(
        Buffer.from(attestation.measurement.slice(2), 'hex')
      );
    }

    // Open SQLite database
    this.db = new Database(this.config.dbPath);

    // Create schema
    this.createSchema();

    // Start auto-sync if enabled
    if (this.config.autoSync && this.config.syncIntervalMs > 0) {
      this.syncTimer = setInterval(
        () => this.syncToIpfs(),
        this.config.syncIntervalMs
      );
    }

    this.log('Store initialized', { dbPath: this.config.dbPath });
  }

  /**
   * Close the store
   */
  async close(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    // Final sync before closing
    if (this.pendingChanges > 0) {
      await this.syncToIpfs();
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.log('Store closed');
  }

  /**
   * Set a value
   */
  async set(key: string, value: object): Promise<void> {
    if (!this.db) {
      throw new Error('Store not initialized');
    }

    const serialized = JSON.stringify(value);
    const data = this.config.encrypted
      ? await this.encrypt(serialized)
      : serialized;
    const hash = keccak256(toBytes(serialized));

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO state (key, value, version, updated_at, hash)
      VALUES (?, ?, COALESCE((SELECT version + 1 FROM state WHERE key = ?), 1), ?, ?)
    `);

    stmt.run(key, data, key, Date.now(), hash);
    this.pendingChanges++;

    this.log('Set value', { key, hash });
  }

  /**
   * Get a value
   */
  async get<T extends object>(key: string): Promise<T | null> {
    if (!this.db) {
      throw new Error('Store not initialized');
    }

    const stmt = this.db.prepare('SELECT value, hash FROM state WHERE key = ?');
    const row = stmt.get(key) as { value: string; hash: string } | null;

    if (!row) return null;

    const serialized = this.config.encrypted
      ? await this.decrypt(row.value)
      : row.value;

    return JSON.parse(serialized) as T;
  }

  /**
   * Delete a value
   */
  async delete(key: string): Promise<void> {
    if (!this.db) {
      throw new Error('Store not initialized');
    }

    const stmt = this.db.prepare('DELETE FROM state WHERE key = ?');
    stmt.run(key);
    this.pendingChanges++;

    this.log('Deleted value', { key });
  }

  /**
   * List all keys
   */
  async keys(prefix?: string): Promise<string[]> {
    if (!this.db) {
      throw new Error('Store not initialized');
    }

    const stmt = prefix
      ? this.db.prepare('SELECT key FROM state WHERE key LIKE ?')
      : this.db.prepare('SELECT key FROM state');

    const rows = prefix
      ? (stmt.all(`${prefix}%`) as { key: string }[])
      : (stmt.all() as { key: string }[]);

    return rows.map((r) => r.key);
  }

  /**
   * Get all entries
   */
  async getAll(): Promise<Map<string, object>> {
    if (!this.db) {
      throw new Error('Store not initialized');
    }

    const stmt = this.db.prepare('SELECT key, value FROM state');
    const rows = stmt.all() as { key: string; value: string }[];

    const result = new Map<string, object>();
    for (const row of rows) {
      const serialized = this.config.encrypted
        ? await this.decrypt(row.value)
        : row.value;
      result.set(row.key, JSON.parse(serialized));
    }

    return result;
  }

  /**
   * Sync to IPFS
   */
  async syncToIpfs(): Promise<string | null> {
    if (!isJejuStorageAvailable()) {
      this.log('IPFS storage not available, skipping sync');
      return null;
    }

    if (this.syncInProgress) {
      this.log('Sync already in progress, skipping');
      return null;
    }

    this.syncInProgress = true;

    const storage = getJejuStorageClient();
    if (!storage) {
      this.syncInProgress = false;
      return null;
    }

    // Export database state
    const snapshot = await this.exportSnapshot();
    const snapshotJson = JSON.stringify(snapshot);

    // Encrypt the entire snapshot if encryption is enabled
    const data = this.config.encrypted
      ? await this.encrypt(snapshotJson)
      : snapshotJson;

    // Upload to IPFS
    const result = await storage.uploadImage({
      file: Buffer.from(data),
      filename: `sqlite-snapshot-${Date.now()}.json`,
      contentType: 'application/json',
      folder: 'sqlite-snapshots',
      metadata: {
        timestamp: String(Date.now()),
        encrypted: String(this.config.encrypted),
        entryCount: String(snapshot.entries.length),
      },
    });

    this.lastIpfsCid = result.cid;
    this.lastSyncAt = Date.now();
    this.pendingChanges = 0;
    this.syncInProgress = false;

    this.log('Synced to IPFS', { cid: result.cid });

    return result.cid;
  }

  /**
   * Restore from IPFS
   */
  async restoreFromIpfs(cid: string): Promise<void> {
    if (!isJejuStorageAvailable()) {
      throw new Error('IPFS storage not available');
    }

    const storage = getJejuStorageClient();
    if (!storage) {
      throw new Error('Storage client not available');
    }

    // Download snapshot
    const data = await storage.download(cid);
    const snapshotJson = this.config.encrypted
      ? await this.decrypt(data.toString('utf-8'))
      : data.toString('utf-8');

    const snapshot = JSON.parse(snapshotJson) as {
      version: number;
      entries: StateEntry[];
    };

    // Import snapshot
    await this.importSnapshot(snapshot);

    this.lastIpfsCid = cid;
    this.log('Restored from IPFS', {
      cid,
      entryCount: snapshot.entries.length,
    });
  }

  /**
   * Export snapshot
   */
  async exportSnapshot(): Promise<{ version: number; entries: StateEntry[] }> {
    if (!this.db) {
      throw new Error('Store not initialized');
    }

    const stmt = this.db.prepare(
      'SELECT key, value, version, updated_at, hash FROM state'
    );
    const rows = stmt.all() as {
      key: string;
      value: string;
      version: number;
      updated_at: number;
      hash: string;
    }[];

    const entries: StateEntry[] = rows.map((row) => ({
      key: row.key,
      value: row.value,
      version: row.version,
      updatedAt: row.updated_at,
      hash: row.hash as Hex,
    }));

    // Get max version
    const versionStmt = this.db.prepare(
      'SELECT MAX(version) as max_version FROM state'
    );
    const versionRow = versionStmt.get() as { max_version: number | null };

    return {
      version: versionRow.max_version ?? 0,
      entries,
    };
  }

  /**
   * Import snapshot
   */
  async importSnapshot(snapshot: {
    version: number;
    entries: StateEntry[];
  }): Promise<void> {
    if (!this.db) {
      throw new Error('Store not initialized');
    }

    // Clear existing data
    this.db.run('DELETE FROM state');

    // Insert entries
    const stmt = this.db.prepare(
      'INSERT INTO state (key, value, version, updated_at, hash) VALUES (?, ?, ?, ?, ?)'
    );

    for (const entry of snapshot.entries) {
      stmt.run(
        entry.key,
        entry.value,
        entry.version,
        entry.updatedAt,
        entry.hash
      );
    }

    this.log('Imported snapshot', { entryCount: snapshot.entries.length });
  }

  /**
   * Get sync status
   */
  getSyncStatus(): SyncStatus {
    return {
      lastSyncAt: this.lastSyncAt,
      pendingChanges: this.pendingChanges,
      lastIpfsCid: this.lastIpfsCid,
      syncInProgress: this.syncInProgress,
    };
  }

  /**
   * Force sync
   */
  async forceSync(): Promise<string | null> {
    return this.syncToIpfs();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createSchema(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL,
        hash TEXT NOT NULL
      )
    `);

    this.db.run(
      'CREATE INDEX IF NOT EXISTS idx_state_updated_at ON state(updated_at)'
    );
  }

  private toArrayBuffer(arr: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(arr.length);
    new Uint8Array(buffer).set(arr);
    return buffer;
  }

  private async encrypt(data: string): Promise<string> {
    if (!this.encryptionKey) {
      return data;
    }

    // Use Web Crypto API for encryption
    const ivBytes = new Uint8Array(12);
    crypto.getRandomValues(ivBytes);

    const key = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(new Uint8Array(this.encryptionKey)),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const encoded = new TextEncoder().encode(data);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: this.toArrayBuffer(ivBytes) },
      key,
      this.toArrayBuffer(encoded)
    );

    // Combine IV and ciphertext
    const combined = new Uint8Array(ivBytes.length + ciphertext.byteLength);
    combined.set(ivBytes, 0);
    combined.set(new Uint8Array(ciphertext), ivBytes.length);

    return Buffer.from(combined).toString('base64');
  }

  private async decrypt(encryptedData: string): Promise<string> {
    if (!this.encryptionKey) {
      return encryptedData;
    }

    const combined = Buffer.from(encryptedData, 'base64');
    const iv = new Uint8Array(combined.subarray(0, 12));
    const ciphertext = new Uint8Array(combined.subarray(12));

    const key = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(new Uint8Array(this.encryptionKey)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.toArrayBuffer(iv) },
      key,
      this.toArrayBuffer(ciphertext)
    );

    return new TextDecoder().decode(plaintext);
  }

  private log(message: string, data?: Record<string, unknown>): void {
    if (this.config.verbose) {
      logger.info(`[SqliteEncryptedStore] ${message}`, data);
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

let sqliteStore: SqliteEncryptedStore | null = null;

export function getSqliteStore(
  config?: Partial<SqliteStoreConfig>
): SqliteEncryptedStore {
  if (!sqliteStore) {
    sqliteStore = new SqliteEncryptedStore(config);
  }
  return sqliteStore;
}

export async function initializeSqliteStore(
  config?: Partial<SqliteStoreConfig>
): Promise<SqliteEncryptedStore> {
  const store = getSqliteStore(config);
  await store.initialize();
  return store;
}
