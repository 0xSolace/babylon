/**
 * Decentralized Stack Integration Tests
 *
 * Tests ALL decentralized services with REAL running instances.
 * NO MOCKS - These tests require Jeju services to be running.
 *
 * Run with: bun test packages/testing/integration/decentralized-stack.integration.test.ts
 *
 * Prerequisites:
 *   1. Start Jeju: cd /path/to/jeju && bun run dev
 *   2. Services running: CQL, Cache, Storage, KMS, OAuth3
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type {
  DecentralizedCacheClient,
  DecentralizedDBClient,
  DecentralizedKMSClient,
  DecentralizedStorageClient,
} from '../shared/types';

// NOTE: This test file is intentionally excluded from tsconfig.json because
// it uses dynamic imports and requires running against real services.
// Run with: bun test packages/testing/integration/decentralized-stack.integration.test.ts

const skipIfNoServices = (fn: () => Promise<void>) => fn;

// ============================================================================
// CQL (CovenantSQL) Tests
// ============================================================================

describe('CovenantSQL Integration', () => {
  let db: DecentralizedDBClient;

  beforeAll(async () => {
    const decentralized = await import('@babylon/db/decentralized');
    const { getDB, initializeDB } = decentralized;

    if (!process.env.CQL_BLOCK_PRODUCER_ENDPOINT) {
      console.warn(
        '[Test] CQL_BLOCK_PRODUCER_ENDPOINT not set, using default localhost:4300'
      );
      process.env.CQL_BLOCK_PRODUCER_ENDPOINT = 'http://localhost:4300';
      process.env.CQL_DATABASE_ID = 'babylon_test';
    }

    db = getDB();
    await initializeDB();
  });

  it(
    'should connect to CQL and report healthy',
    skipIfNoServices(async () => {
      const healthy = await db.isHealthy();
      expect(healthy).toBe(true);
    })
  );

  it(
    'should get block height',
    skipIfNoServices(async () => {
      const height = await db.getBlockHeight();
      expect(height).toBeGreaterThanOrEqual(0);
    })
  );

  it(
    'should execute CREATE TABLE',
    skipIfNoServices(async () => {
      const result = await db.exec(`
      CREATE TABLE IF NOT EXISTS test_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        created_at INTEGER NOT NULL
      )
    `);
      expect(result.rowsAffected ?? 0).toBeGreaterThanOrEqual(0);
    })
  );

  it(
    'should INSERT and SELECT data',
    skipIfNoServices(async () => {
      const testId = `test-${Date.now()}`;
      const testUser = {
        id: testId,
        name: 'Test User',
        email: 'test@babylon.game',
        created_at: Date.now(),
      };

      await db.insert('test_users', testUser);

      const result = await db.selectOne<typeof testUser>('test_users', {
        where: { id: testId },
      });

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Test User');
      expect(result?.email).toBe('test@babylon.game');
    })
  );

  it(
    'should UPDATE data',
    skipIfNoServices(async () => {
      const testId = `update-test-${Date.now()}`;
      await db.insert('test_users', {
        id: testId,
        name: 'Original Name',
        email: 'original@babylon.game',
        created_at: Date.now(),
      });

      await db.update(
        'test_users',
        { name: 'Updated Name' },
        { where: { id: testId } }
      );

      const result = await db.selectOne<{ id: string; name: string }>(
        'test_users',
        {
          where: { id: testId },
        }
      );

      expect(result?.name).toBe('Updated Name');
    })
  );

  it(
    'should DELETE data',
    skipIfNoServices(async () => {
      const testId = `delete-test-${Date.now()}`;
      await db.insert('test_users', {
        id: testId,
        name: 'To Delete',
        email: null,
        created_at: Date.now(),
      });

      const deleted = await db.delete('test_users', { where: { id: testId } });
      expect(deleted).toBe(1);

      const result = await db.selectOne('test_users', {
        where: { id: testId },
      });
      expect(result).toBeNull();
    })
  );

  it(
    'should support transactions',
    skipIfNoServices(async () => {
      const testId1 = `tx-test-1-${Date.now()}`;
      const testId2 = `tx-test-2-${Date.now()}`;

      await db.transaction(async (ctx) => {
        await ctx.exec(
          `INSERT INTO test_users (id, name, email, created_at) VALUES ($1, $2, $3, $4)`,
          [testId1, 'TX User 1', null, Date.now()]
        );
        await ctx.exec(
          `INSERT INTO test_users (id, name, email, created_at) VALUES ($1, $2, $3, $4)`,
          [testId2, 'TX User 2', null, Date.now()]
        );
      });

      const count = await db.count('test_users', { id: testId1 });
      expect(count).toBe(1);
    })
  );

  afterAll(async () => {
    // Clean up test data
    await db.exec(
      `DELETE FROM test_users WHERE id LIKE 'test-%' OR id LIKE 'update-test-%' OR id LIKE 'delete-test-%' OR id LIKE 'tx-test-%'`
    );
  });
});

// ============================================================================
// Cache Tests
// ============================================================================

describe('Decentralized Cache Integration', () => {
  let cache: DecentralizedCacheClient;

  beforeAll(async () => {
    const { getCache, initializeCache } = await import('@babylon/api');

    if (!process.env.JEJU_CACHE_SERVICE_URL) {
      console.warn(
        '[Test] JEJU_CACHE_SERVICE_URL not set, using default localhost:4015'
      );
      process.env.JEJU_CACHE_SERVICE_URL = 'http://localhost:4015';
    }

    cache = getCache();
    await initializeCache();
  });

  it(
    'should connect to cache and report healthy',
    skipIfNoServices(async () => {
      const healthy = await cache.healthCheck();
      expect(healthy).toBe(true);
    })
  );

  it(
    'should SET and GET values',
    skipIfNoServices(async () => {
      const key = `test-key-${Date.now()}`;
      const value = { foo: 'bar', num: 42 };

      await cache.set(key, value, 60);
      const result = await cache.get<typeof value>(key);

      expect(result).toEqual(value);
    })
  );

  it(
    'should DELETE values',
    skipIfNoServices(async () => {
      const key = `delete-key-${Date.now()}`;
      await cache.set(key, 'to-delete', 60);

      const deleted = await cache.delete(key);
      expect(deleted).toBe(true);

      const result = await cache.get(key);
      expect(result).toBeNull();
    })
  );

  it(
    'should check EXISTS',
    skipIfNoServices(async () => {
      const key = `exists-key-${Date.now()}`;
      await cache.set(key, 'exists', 60);

      const exists = await cache.exists(key);
      expect(exists).toBe(true);

      await cache.delete(key);
      const notExists = await cache.exists(key);
      expect(notExists).toBe(false);
    })
  );

  it(
    'should support MGET and MSET',
    skipIfNoServices(async () => {
      const prefix = `batch-${Date.now()}`;
      const pairs = {
        [`${prefix}-1`]: 'value1',
        [`${prefix}-2`]: 'value2',
        [`${prefix}-3`]: 'value3',
      };

      await cache.mset(pairs, 60);
      const results = await cache.mget<string>(
        `${prefix}-1`,
        `${prefix}-2`,
        `${prefix}-3`
      );

      expect(results).toEqual(['value1', 'value2', 'value3']);
    })
  );

  it(
    'should support INCR/DECR',
    skipIfNoServices(async () => {
      const key = `counter-${Date.now()}`;

      const val1 = await cache.incr(key);
      expect(val1).toBe(1);

      const val2 = await cache.incr(key, 5);
      expect(val2).toBe(6);

      const val3 = await cache.decr(key, 2);
      expect(val3).toBe(4);
    })
  );

  it(
    'should get cache stats',
    skipIfNoServices(async () => {
      const stats = await cache.getStats();
      expect(stats.totalKeys).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
    })
  );

  afterAll(async () => {
    // Flush test namespace
    await cache.flush();
  });
});

// ============================================================================
// Storage Tests
// ============================================================================

describe('Decentralized Storage Integration', () => {
  let storage: DecentralizedStorageClient;
  let uploadedCid: string;

  beforeAll(async () => {
    const { getStorage, initializeStorage } = await import('@babylon/api');

    if (!process.env.JEJU_STORAGE_SERVICE_URL) {
      console.warn(
        '[Test] JEJU_STORAGE_SERVICE_URL not set, using default localhost:5001'
      );
      process.env.JEJU_STORAGE_SERVICE_URL = 'http://localhost:5001';
    }

    storage = getStorage();
    await initializeStorage();
  });

  it(
    'should connect to storage and report healthy',
    skipIfNoServices(async () => {
      const healthy = await storage.healthCheck();
      expect(healthy).toBe(true);
    })
  );

  it(
    'should upload a file',
    skipIfNoServices(async () => {
      const content = JSON.stringify({ test: true, timestamp: Date.now() });
      const blob = new Blob([content], { type: 'application/json' });

      const result = await storage.upload(blob, {
        name: 'test-file.json',
        mimeType: 'application/json',
      });

      expect(result.cid).toBeTruthy();
      expect(result.size).toBeGreaterThan(0);
      uploadedCid = result.cid;
    })
  );

  it(
    'should download a file',
    skipIfNoServices(async () => {
      if (!uploadedCid) return;

      const data = await storage.download(uploadedCid);
      const text = new TextDecoder().decode(data);
      const parsed = JSON.parse(text);

      expect(parsed.test).toBe(true);
    })
  );

  it(
    'should upload and download JSON',
    skipIfNoServices(async () => {
      const data = { hello: 'world', nested: { foo: 'bar' } };
      const result = await storage.uploadJson(data, 'test-json.json');

      expect(result.cid).toBeTruthy();

      const downloaded = await storage.downloadJson<typeof data>(result.cid);
      expect(downloaded).toEqual(data);
    })
  );

  it(
    'should check if file exists',
    skipIfNoServices(async () => {
      if (!uploadedCid) return;

      const exists = await storage.exists(uploadedCid);
      expect(exists).toBe(true);

      const notExists = await storage.exists(
        'QmInvalidCidThatDoesNotExist123456'
      );
      expect(notExists).toBe(false);
    })
  );

  it(
    'should get file metadata',
    skipIfNoServices(async () => {
      if (!uploadedCid) return;

      const metadata = await storage.getMetadata(uploadedCid);
      expect(metadata).not.toBeNull();
      expect(metadata?.cid).toBe(uploadedCid);
    })
  );

  it(
    'should list files',
    skipIfNoServices(async () => {
      const files = await storage.list({ limit: 10 });
      expect(Array.isArray(files)).toBe(true);
    })
  );

  it(
    'should get storage stats',
    skipIfNoServices(async () => {
      const stats = await storage.getStats();
      expect(stats.totalFiles).toBeGreaterThanOrEqual(0);
    })
  );
});

// ============================================================================
// KMS Tests
// ============================================================================

describe('KMS Integration', () => {
  let kms: DecentralizedKMSClient;

  beforeAll(async () => {
    const { getKMSClient, initializeKMS } = await import('@babylon/api');

    if (!process.env.JEJU_KMS_SERVICE_URL) {
      console.warn(
        '[Test] JEJU_KMS_SERVICE_URL not set, using default localhost:4200'
      );
      process.env.JEJU_KMS_SERVICE_URL = 'http://localhost:4200';
      process.env.KMS_NAMESPACE = 'babylon_test';
    }

    kms = getKMSClient();
    await initializeKMS();
  });

  it(
    'should connect to KMS and report healthy',
    skipIfNoServices(async () => {
      const healthy = await kms.healthCheck();
      expect(healthy).toBe(true);
    })
  );

  it(
    'should store and retrieve a secret',
    skipIfNoServices(async () => {
      const secretName = `test-secret-${Date.now()}`;
      const secretValue = 'super-secret-value-123';

      await kms.storeSecret(secretName, secretValue);
      const retrieved = await kms.getSecret(secretName);

      expect(retrieved).toBe(secretValue);

      // Clean up
      await kms.deleteSecret(secretName);
    })
  );

  it(
    'should encrypt and decrypt data',
    skipIfNoServices(async () => {
      const plaintext = 'This is sensitive data';

      const encrypted = await kms.encrypt({
        data: plaintext,
        name: 'test-encryption',
      });
      expect(encrypted.encryptedPayload).toBeTruthy();

      const decrypted = await kms.decrypt({
        payload: encrypted.encryptedPayload,
      });
      expect(decrypted).toBe(plaintext);
    })
  );

  it(
    'should rotate secrets',
    skipIfNoServices(async () => {
      const secretName = `rotate-test-${Date.now()}`;
      await kms.storeSecret(secretName, 'original-value');

      const rotated = await kms.rotateSecret(secretName, 'new-value');
      expect(rotated.version).toBe(2);

      const current = await kms.getSecret(secretName);
      expect(current).toBe('new-value');

      // Clean up
      await kms.deleteSecret(secretName);
    })
  );

  it(
    'should generate and use keys for signing',
    skipIfNoServices(async () => {
      const { keyId, publicKey } = await kms.generateKey(
        `test-key-${Date.now()}`
      );
      expect(keyId).toBeTruthy();
      expect(publicKey).toBeTruthy();

      const message = '0x1234567890abcdef' as `0x${string}`;
      const { signature } = await kms.sign({ message, keyId });
      expect(signature).toBeTruthy();

      const valid = await kms.verify(message, signature, publicKey);
      expect(valid).toBe(true);
    })
  );
});

// ============================================================================
// Decentralized Training Tests
// ============================================================================

describe('Decentralized Training Integration', () => {
  it(
    'should check if decentralized training is available',
    skipIfNoServices(async () => {
      const { isDecentralizedTrainingAvailable } = await import(
        '@babylon/training/compute'
      );
      const available = await isDecentralizedTrainingAvailable();
      // May not be available in test environment
      expect(typeof available).toBe('boolean');
    })
  );

  it(
    'should create DecentralizedTrainingClient',
    skipIfNoServices(async () => {
      const {
        createDecentralizedTrainingClient,
        isDecentralizedTrainingAvailable,
      } = await import('@babylon/training/compute');

      // Skip if local node not running
      const available = await isDecentralizedTrainingAvailable();
      if (!available) {
        console.log(
          'DecentralizedTrainingClient: local node not running, skipping'
        );
        return;
      }

      const client = await createDecentralizedTrainingClient({
        rpcUrl: 'http://localhost:8545',
        privateKey:
          '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`,
        coordinatorAddress:
          '0x5FbDB2315678afecb367f032d93F642f64180aa3' as `0x${string}`,
        rewardsAddress:
          '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as `0x${string}`,
        performanceOracleAddress:
          '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as `0x${string}`,
        computeRegistryAddress:
          '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' as `0x${string}`,
      });

      expect(client).toBeTruthy();
      expect(typeof client.submitJob).toBe('function');
      expect(typeof client.getJobStatus).toBe('function');
    })
  );

  it(
    'should validate training job configuration',
    skipIfNoServices(async () => {
      const { PrivacyMode, GPUTier } = await import(
        '@babylon/training/compute'
      );

      // Verify enums are exported correctly
      expect(PrivacyMode.Public).toBe(0);
      expect(PrivacyMode.Private).toBe(1);
      expect(GPUTier.Consumer).toBe(0);
      expect(GPUTier.Professional).toBe(1);
      expect(GPUTier.DataCenter).toBe(2);
    })
  );
});

// ============================================================================
// TEE Training Worker Tests
// ============================================================================

describe('TEE Training Worker Integration', () => {
  it(
    'should create and initialize training worker',
    skipIfNoServices(async () => {
      const { createTrainingWorker, WorkerType, WorkerStatus } = await import(
        '@babylon/training/tee'
      );

      const worker = createTrainingWorker(WorkerType.DATA_PREP, {
        workerId: 'test-worker-001',
        codeHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
      });

      expect(worker).toBeTruthy();
      expect(worker.getStatus().type).toBe(WorkerType.DATA_PREP);
      expect(worker.getStatus().status).toBe(WorkerStatus.IDLE);

      const attestation = await worker.initialize();
      expect(attestation.workerId).toBe('test-worker-001');
      expect(attestation.quote).toBeTruthy();
      expect(attestation.signature).toBeTruthy();
    })
  );

  it(
    'should validate worker types',
    skipIfNoServices(async () => {
      const { WorkerType } = await import('@babylon/training/tee');

      expect(WorkerType.DATA_PREP).toBe('DATA_PREP');
      expect(WorkerType.JUDGING).toBe('JUDGING');
      expect(WorkerType.TRAINING).toBe('TRAINING');
      expect(WorkerType.BENCHMARK).toBe('BENCHMARK');
    })
  );
});

// ============================================================================
// Treasury Integration Tests
// ============================================================================

describe('Treasury Integration', () => {
  it(
    'should check if treasury is available',
    skipIfNoServices(async () => {
      const { isTreasuryAvailable } = await import('@babylon/training/compute');
      const available = await isTreasuryAvailable();
      expect(typeof available).toBe('boolean');
    })
  );
});

// ============================================================================
// End-to-End Flow Tests
// ============================================================================

describe('End-to-End Decentralized Flow', () => {
  it(
    'should handle a complete user flow with all services',
    skipIfNoServices(async () => {
      // This test simulates a real user flow:
      // 1. Store user data in CQL
      // 2. Cache frequently accessed data
      // 3. Upload user avatar to storage
      // 4. Encrypt sensitive data with KMS

      const userId = `e2e-user-${Date.now()}`;

      // 1. Create user in CQL
      const { getDB } = await import('@babylon/db/decentralized');
      const db = getDB();

      await db.exec(`
      CREATE TABLE IF NOT EXISTS e2e_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar_cid TEXT,
        encrypted_data TEXT,
        created_at INTEGER NOT NULL
      )
    `);

      await db.insert('e2e_users', {
        id: userId,
        name: 'E2E Test User',
        avatar_cid: null,
        encrypted_data: null,
        created_at: Date.now(),
      });

      // 2. Cache user profile
      const { getCache } = await import('@babylon/api');
      const cache = getCache();
      await cache.set(
        `user:${userId}`,
        { id: userId, name: 'E2E Test User' },
        300
      );

      const cachedUser = await cache.get<{ id: string; name: string }>(
        `user:${userId}`
      );
      expect(cachedUser?.name).toBe('E2E Test User');

      // 3. Upload avatar to storage
      const { getStorage } = await import('@babylon/api');
      const storage = getStorage();

      const avatarData = JSON.stringify({
        type: 'avatar',
        userId,
        color: '#ff0000',
      });
      const avatarResult = await storage.uploadJson(
        avatarData,
        `${userId}-avatar.json`
      );
      expect(avatarResult.cid).toBeTruthy();

      // Update user with avatar CID
      await db.update(
        'e2e_users',
        { avatar_cid: avatarResult.cid },
        { where: { id: userId } }
      );

      // 4. Encrypt sensitive data with KMS
      const { getKMSClient } = await import('@babylon/api');
      const kms = getKMSClient();

      const sensitiveData = JSON.stringify({
        ssn: '123-45-6789',
        dob: '1990-01-01',
      });
      const encrypted = await kms.encrypt({
        data: sensitiveData,
        name: `user-pii-${userId}`,
      });

      await db.update(
        'e2e_users',
        { encrypted_data: encrypted.encryptedPayload },
        { where: { id: userId } }
      );

      // Verify complete flow
      const finalUser = await db.selectOne<{
        id: string;
        name: string;
        avatar_cid: string;
        encrypted_data: string;
      }>('e2e_users', { where: { id: userId } });

      expect(finalUser).not.toBeNull();
      expect(finalUser?.avatar_cid).toBe(avatarResult.cid);
      expect(finalUser?.encrypted_data).toBeTruthy();

      // Decrypt and verify
      const decrypted = await kms.decrypt({
        payload: finalUser!.encrypted_data as `0x${string}`,
      });
      const parsed = JSON.parse(decrypted);
      expect(parsed.ssn).toBe('123-45-6789');

      // Clean up
      await db.delete('e2e_users', { where: { id: userId } });
      await cache.delete(`user:${userId}`);

      console.log(
        '✅ E2E flow completed successfully with all decentralized services'
      );
    })
  );
});
