/**
 * Checkpoint Service Tests
 *
 * Comprehensive tests for the encrypted state checkpointing service.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  type CheckpointConfig,
  CheckpointService,
} from '../checkpoint-service';

// Mock the TEE enclave
const mockSealState = mock(async (state: object) => ({
  ciphertext: Buffer.from(JSON.stringify(state)).toString('base64'),
  iv: Buffer.from('random-iv-12b').toString('base64'),
  keyVersion: 1,
  sealedAt: Date.now(),
}));

const mockUnsealState = mock(async (sealed: { ciphertext: string }) => {
  return JSON.parse(Buffer.from(sealed.ciphertext, 'base64').toString());
});

const mockGetSealedState = mock(() => ({
  ciphertext: Buffer.from('{}').toString('base64'),
  iv: 'iv',
  keyVersion: 1,
  sealedAt: Date.now(),
}));

const mockRotateKey = mock(async () => ({
  oldVersion: 1,
  newVersion: 2,
}));

mock.module('../tee/babylon-enclave', () => ({
  getBabylonEnclave: mock(async () => ({
    sealState: mockSealState,
    unsealState: mockUnsealState,
    getSealedState: mockGetSealedState,
    rotateKey: mockRotateKey,
    getStatus: () => ({ running: true, keyVersion: 1 }),
    getOperatorAddress: () => '0x1234567890123456789012345678901234567890',
  })),
}));

// Mock storage
mock.module('../storage/jeju-storage', () => ({
  isJejuStorageAvailable: () => false,
  getJejuStorageClient: () => null,
}));

describe('CheckpointService', () => {
  let service: CheckpointService;
  let testState: object;
  let getStateCalled: number;
  let _setStateCalled: number;
  let _lastSetState: object | null;

  const testConfig: Partial<CheckpointConfig> = {
    intervalMs: 0, // Disable auto-checkpoint for tests
    autoCheckpoint: false,
    maxHistory: 5,
    verbose: false,
  };

  beforeEach(async () => {
    getStateCalled = 0;
    _setStateCalled = 0;
    _lastSetState = null;
    testState = { version: 1, players: [], tick: 0 };

    service = new CheckpointService(testConfig);
    await service.initialize({
      getState: async () => {
        getStateCalled++;
        return testState;
      },
      setState: async (state) => {
        _setStateCalled++;
        _lastSetState = state;
      },
    });
  });

  afterEach(async () => {
    await service.stop();
  });

  describe('initialization', () => {
    it('initializes with default config', () => {
      const status = service.getStatus();
      expect(status.enclaveReady).toBe(true);
      expect(status.running).toBe(false);
      expect(status.checkpointCount).toBe(0);
    });

    it('starts and stops correctly', async () => {
      await service.start();
      expect(service.getStatus().running).toBe(true);

      await service.stop();
      expect(service.getStatus().running).toBe(false);
    });

    it('handles double start gracefully', async () => {
      await service.start();
      await service.start(); // Should not throw
      expect(service.getStatus().running).toBe(true);
    });

    it('handles double stop gracefully', async () => {
      await service.start();
      await service.stop();
      await service.stop(); // Should not throw
      expect(service.getStatus().running).toBe(false);
    });
  });

  describe('createCheckpoint', () => {
    it('creates checkpoint with correct structure', async () => {
      await service.start();
      const checkpoint = await service.createCheckpoint();

      expect(checkpoint.cid).toMatch(/^local-/);
      expect(checkpoint.stateHash).toMatch(/^0x[0-9a-f]{64}$/i);
      expect(checkpoint.version).toBe(1);
      expect(checkpoint.keyVersion).toBe(1);
      expect(checkpoint.timestamp).toBeGreaterThan(0);
      expect(checkpoint.size).toBeGreaterThan(0);
      expect(checkpoint.onChainAnchored).toBe(false);
    });

    it('increments version on each checkpoint', async () => {
      await service.start();

      const cp1 = await service.createCheckpoint();
      const cp2 = await service.createCheckpoint();
      const cp3 = await service.createCheckpoint();

      expect(cp1.version).toBe(1);
      expect(cp2.version).toBe(2);
      expect(cp3.version).toBe(3);
    });

    it('calls getState callback', async () => {
      await service.start();
      await service.createCheckpoint();

      expect(getStateCalled).toBe(1);
    });

    it('produces different hashes for different states', async () => {
      await service.start();

      testState = { version: 1, data: 'first' };
      const cp1 = await service.createCheckpoint();

      testState = { version: 2, data: 'second' };
      const cp2 = await service.createCheckpoint();

      expect(cp1.stateHash).not.toBe(cp2.stateHash);
    });

    it('throws when enclave not initialized', async () => {
      const uninitializedService = new CheckpointService(testConfig);
      await expect(uninitializedService.createCheckpoint()).rejects.toThrow(
        'Enclave not initialized'
      );
    });

    it('throws when state callback not configured', async () => {
      const partialService = new CheckpointService(testConfig);
      // Manually set enclave without callback
      (partialService as unknown as { enclave: object }).enclave = {};

      await expect(partialService.createCheckpoint()).rejects.toThrow(
        'State callback not configured'
      );
    });
  });

  describe('checkpoint history', () => {
    it('stores checkpoints in history', async () => {
      await service.start();

      await service.createCheckpoint();
      await service.createCheckpoint();
      await service.createCheckpoint();

      const allCheckpoints = service.getAllCheckpoints();
      expect(allCheckpoints.length).toBe(3);
    });

    it('enforces maxHistory limit', async () => {
      await service.start();

      // Create more than maxHistory (5) checkpoints
      for (let i = 0; i < 8; i++) {
        await service.createCheckpoint();
      }

      const allCheckpoints = service.getAllCheckpoints();
      expect(allCheckpoints.length).toBe(5);
      expect(allCheckpoints[0]?.version).toBe(4); // First 3 pruned
    });

    it('getLatestCheckpoint returns most recent', async () => {
      await service.start();

      await service.createCheckpoint();
      await service.createCheckpoint();
      const latest = await service.createCheckpoint();

      expect(service.getLatestCheckpoint()).toEqual(latest);
    });

    it('getCheckpoint finds by CID', async () => {
      await service.start();

      const cp = await service.createCheckpoint();
      const found = service.getCheckpoint(cp.cid);

      expect(found).toEqual(cp);
    });

    it('getCheckpointByVersion finds by version', async () => {
      await service.start();

      await service.createCheckpoint();
      const cp2 = await service.createCheckpoint();
      await service.createCheckpoint();

      const found = service.getCheckpointByVersion(2);
      expect(found).toEqual(cp2);
    });

    it('returns null for non-existent checkpoint', () => {
      expect(service.getCheckpoint('non-existent-cid')).toBeNull();
      expect(service.getCheckpointByVersion(999)).toBeNull();
      expect(service.getLatestCheckpoint()).toBeNull();
    });
  });

  describe('tick counting', () => {
    it('starts with zero tick count', () => {
      const heartbeat = service.generateHeartbeatData();
      expect(heartbeat.tickCount).toBe(0);
    });

    it('increments tick count', () => {
      service.incrementTick();
      service.incrementTick();
      service.incrementTick();

      const heartbeat = service.generateHeartbeatData();
      expect(heartbeat.tickCount).toBe(3);
    });

    it('includes tick count in checkpoint', async () => {
      await service.start();

      service.incrementTick();
      service.incrementTick();

      const cp = await service.createCheckpoint();
      expect(cp.tickCount).toBe(2);
    });

    it('allows setting tick count directly', () => {
      service.setTickCount(100);

      const heartbeat = service.generateHeartbeatData();
      expect(heartbeat.tickCount).toBe(100);
    });
  });

  describe('heartbeat data', () => {
    it('generates heartbeat with zero hash when no checkpoint', () => {
      const heartbeat = service.generateHeartbeatData();

      expect(heartbeat.stateHash).toMatch(/^0x0{64}$/);
      expect(heartbeat.tickCount).toBe(0);
      expect(heartbeat.timestamp).toBeGreaterThan(0);
    });

    it('generates heartbeat with latest state hash', async () => {
      await service.start();
      const cp = await service.createCheckpoint();

      const heartbeat = service.generateHeartbeatData();
      expect(heartbeat.stateHash).toBe(cp.stateHash);
    });
  });

  describe('checkpoint anchoring', () => {
    it('marks checkpoint as anchored', async () => {
      await service.start();
      const cp = await service.createCheckpoint();

      expect(cp.onChainAnchored).toBe(false);

      service.markAnchored(cp.cid);

      const updated = service.getCheckpoint(cp.cid);
      expect(updated?.onChainAnchored).toBe(true);
    });

    it('getCheckpointForAnchor returns latest checkpoint data', async () => {
      await service.start();
      const cp = await service.createCheckpoint();

      const forAnchor = service.getCheckpointForAnchor();
      expect(forAnchor?.cid).toBe(cp.cid);
      expect(forAnchor?.stateHash).toBe(cp.stateHash);
    });

    it('returns null when no checkpoints exist', () => {
      expect(service.getCheckpointForAnchor()).toBeNull();
    });
  });

  describe('status reporting', () => {
    it('reports comprehensive status', async () => {
      await service.start();
      await service.createCheckpoint();
      service.incrementTick();

      const status = service.getStatus();

      expect(status.running).toBe(true);
      expect(status.enclaveReady).toBe(true);
      expect(status.storageReady).toBe(false); // Mocked as unavailable
      expect(status.checkpointCount).toBe(1);
      expect(status.lastCheckpoint).not.toBeNull();
      expect(status.totalBytesStored).toBeGreaterThan(0);
    });
  });

  describe('key rotation', () => {
    it('rotates key and creates new checkpoint', async () => {
      await service.start();

      const cp1 = await service.createCheckpoint();
      expect(cp1.keyVersion).toBe(1);

      const cp2 = await service.rotateKey();
      expect(cp2.version).toBe(2); // New checkpoint created
    });
  });

  describe('getCurrentStateHash', () => {
    it('returns null when no checkpoints', () => {
      expect(service.getCurrentStateHash()).toBeNull();
    });

    it('returns latest state hash', async () => {
      await service.start();
      const cp = await service.createCheckpoint();

      expect(service.getCurrentStateHash()).toBe(cp.stateHash);
    });
  });

  describe('edge cases', () => {
    it('handles empty state object', async () => {
      await service.start();
      testState = {};

      const cp = await service.createCheckpoint();
      expect(cp.size).toBeGreaterThan(0);
    });

    it('handles large state object', async () => {
      await service.start();
      testState = {
        data: 'x'.repeat(100000),
        nested: { deep: { array: Array(1000).fill({ value: 123 }) } },
      };

      const cp = await service.createCheckpoint();
      expect(cp.size).toBeGreaterThan(100000);
    });

    it('handles state with special characters', async () => {
      await service.start();
      testState = {
        unicode: '🎮 游戏 🎲',
        special: '"><script>alert(1)</script>',
        newlines: 'line1\nline2\r\nline3',
      };

      const cp = await service.createCheckpoint();
      expect(cp.stateHash).toMatch(/^0x[0-9a-f]{64}$/i);
    });
  });
});

describe('CheckpointService auto-checkpoint', () => {
  it('creates checkpoints automatically when enabled', async () => {
    const service = new CheckpointService({
      intervalMs: 50, // 50ms interval
      autoCheckpoint: true,
      maxHistory: 10,
    });

    await service.initialize({
      getState: async () => ({ tick: Date.now() }),
      setState: async () => {},
    });

    await service.start();

    // Wait for at least 2 checkpoint intervals
    await new Promise((resolve) => setTimeout(resolve, 150));

    await service.stop();

    // Should have created at least 2 checkpoints
    expect(service.getStatus().checkpointCount).toBeGreaterThanOrEqual(2);
  });
});
