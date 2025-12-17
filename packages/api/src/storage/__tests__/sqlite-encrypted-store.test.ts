/**
 * SQLite Encrypted Store Tests
 *
 * Tests for the local SQLite database with TEE-backed encryption.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { unlink } from 'node:fs/promises';
import {
  SqliteEncryptedStore,
  type SqliteStoreConfig,
} from '../sqlite-encrypted-store';

// Mock the TEE enclave
mock.module('../tee/babylon-enclave', () => ({
  getBabylonEnclave: mock(async () => ({
    getAttestation: () => ({
      measurement: '0x' + 'ab'.repeat(32),
    }),
    getStatus: () => ({ running: true }),
  })),
}));

// Mock IPFS storage as unavailable
mock.module('./jeju-storage', () => ({
  isJejuStorageAvailable: () => false,
  getJejuStorageClient: () => null,
}));

describe('SqliteEncryptedStore', () => {
  let store: SqliteEncryptedStore;
  const testDbPath = './test-encrypted-store.sqlite';

  const testConfig: Partial<SqliteStoreConfig> = {
    dbPath: testDbPath,
    encrypted: true,
    autoSync: false,
    verbose: false,
  };

  beforeEach(async () => {
    // Clean up any existing test database
    await unlink(testDbPath).catch(() => {});

    store = new SqliteEncryptedStore(testConfig);
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    await unlink(testDbPath).catch(() => {});
  });

  describe('initialization', () => {
    it('initializes successfully', async () => {
      const keys = await store.keys();
      expect(Array.isArray(keys)).toBe(true);
    });

    it('is idempotent for close', async () => {
      await store.close();
      await store.close(); // Should not throw
    });
  });

  describe('set/get', () => {
    it('stores and retrieves data', async () => {
      const key = 'game-state';
      const value = { players: [1, 2, 3], tick: 100 };

      await store.set(key, value);
      const retrieved = await store.get(key);

      expect(retrieved).toEqual(value);
    });

    it('returns null for non-existent keys', async () => {
      const result = await store.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('overwrites existing values', async () => {
      const key = 'config';

      await store.set(key, { version: 1 });
      await store.set(key, { version: 2 });

      const retrieved = await store.get(key);
      expect(retrieved).toEqual({ version: 2 });
    });

    it('handles complex nested objects', async () => {
      const key = 'complex';
      const value = {
        level1: {
          level2: {
            level3: {
              array: [1, 2, { nested: true }],
              date: '2024-01-01',
            },
          },
        },
      };

      await store.set(key, value);
      const retrieved = await store.get(key);

      expect(retrieved).toEqual(value);
    });

    it('handles special characters in keys', async () => {
      const keys = [
        'key-with-dash',
        'key_with_underscore',
        'key.with.dots',
        'key:with:colons',
      ];

      for (const key of keys) {
        await store.set(key, { key });
        const retrieved = await store.get(key);
        expect(retrieved).toEqual({ key });
      }
    });
  });

  describe('delete', () => {
    it('removes key from store', async () => {
      await store.set('to-delete', { data: 'test' });
      expect(await store.get('to-delete')).not.toBeNull();

      await store.delete('to-delete');
      expect(await store.get('to-delete')).toBeNull();
    });

    it('handles deleting non-existent key gracefully', async () => {
      await store.delete('non-existent');
      // Should not throw
    });
  });

  describe('keys', () => {
    it('returns all stored keys', async () => {
      await store.set('key1', { v: 1 });
      await store.set('key2', { v: 2 });
      await store.set('key3', { v: 3 });

      const keys = await store.keys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('returns empty array when no keys', async () => {
      const keys = await store.keys();
      expect(keys).toEqual([]);
    });

    it('filters by prefix', async () => {
      await store.set('game:state', { v: 1 });
      await store.set('game:config', { v: 2 });
      await store.set('user:profile', { v: 3 });

      const gameKeys = await store.keys('game:');

      expect(gameKeys).toHaveLength(2);
      expect(gameKeys).toContain('game:state');
      expect(gameKeys).toContain('game:config');
    });
  });

  describe('getAll', () => {
    it('returns all entries as Map', async () => {
      await store.set('key1', { v: 1 });
      await store.set('key2', { v: 2 });

      const all = await store.getAll();

      expect(all.size).toBe(2);
      expect(all.get('key1')).toEqual({ v: 1 });
      expect(all.get('key2')).toEqual({ v: 2 });
    });

    it('returns empty Map when no entries', async () => {
      const all = await store.getAll();
      expect(all.size).toBe(0);
    });
  });

  describe('snapshots', () => {
    it('exports snapshot', async () => {
      await store.set('key1', { v: 1 });
      await store.set('key2', { v: 2 });

      const snapshot = await store.exportSnapshot();

      expect(snapshot.entries).toHaveLength(2);
      expect(snapshot.version).toBeGreaterThan(0);
    });

    it('imports snapshot', async () => {
      await store.set('key1', { v: 1 });
      const snapshot = await store.exportSnapshot();

      // Clear store
      await store.delete('key1');
      expect(await store.get('key1')).toBeNull();

      // Import snapshot
      await store.importSnapshot(snapshot);
      expect(await store.keys()).toHaveLength(1);
    });
  });

  describe('sync status', () => {
    it('reports sync status', () => {
      const status = store.getSyncStatus();

      expect(status.lastSyncAt).toBe(0);
      expect(status.pendingChanges).toBe(0);
      expect(status.lastIpfsCid).toBeNull();
      expect(status.syncInProgress).toBe(false);
    });

    it('tracks pending changes', async () => {
      await store.set('key1', { v: 1 });
      await store.set('key2', { v: 2 });

      const status = store.getSyncStatus();
      expect(status.pendingChanges).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('handles empty objects', async () => {
      await store.set('empty', {});
      expect(await store.get('empty')).toEqual({});
    });

    it('handles null values in objects', async () => {
      await store.set('with-null', { value: null, other: 1 });
      expect(await store.get('with-null')).toEqual({ value: null, other: 1 });
    });

    it('handles arrays', async () => {
      await store.set('array', [1, 2, 3, 'four', { five: 5 }]);
      expect(await store.get('array')).toEqual([1, 2, 3, 'four', { five: 5 }]);
    });

    it('handles unicode strings', async () => {
      await store.set('unicode', { emoji: '🎮 游戏 🎲', arabic: 'مرحبا' });
      expect(await store.get('unicode')).toEqual({
        emoji: '🎮 游戏 🎲',
        arabic: 'مرحبا',
      });
    });

    it('handles large values', async () => {
      const largeValue = { data: 'x'.repeat(100000) };
      await store.set('large', largeValue);
      expect(await store.get('large')).toEqual(largeValue);
    });
  });

  describe('concurrent access', () => {
    it('handles concurrent reads', async () => {
      await store.set('concurrent-read', { value: 42 });

      const reads = await Promise.all([
        store.get('concurrent-read'),
        store.get('concurrent-read'),
        store.get('concurrent-read'),
        store.get('concurrent-read'),
        store.get('concurrent-read'),
      ]);

      for (const read of reads) {
        expect(read).toEqual({ value: 42 });
      }
    });

    it('handles concurrent writes to different keys', async () => {
      await Promise.all([
        store.set('key-a', { v: 'a' }),
        store.set('key-b', { v: 'b' }),
        store.set('key-c', { v: 'c' }),
      ]);

      expect(await store.get('key-a')).toEqual({ v: 'a' });
      expect(await store.get('key-b')).toEqual({ v: 'b' });
      expect(await store.get('key-c')).toEqual({ v: 'c' });
    });
  });
});

describe('SqliteEncryptedStore unencrypted mode', () => {
  it('works without encryption', async () => {
    const store = new SqliteEncryptedStore({
      dbPath: ':memory:',
      encrypted: false,
      autoSync: false,
    });
    await store.initialize();

    await store.set('test', { value: 'unencrypted' });
    expect(await store.get('test')).toEqual({ value: 'unencrypted' });

    await store.close();
  });
});
