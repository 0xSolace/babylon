/**
 * MPC Client Tests
 *
 * Tests for the MPC network client in dev mode.
 * MPC-dependent integration tests are skipped unless network is available.
 */

import { describe, expect, it } from 'bun:test';
import { createMPCClient, MPCClient } from '../mpc/client';
import type { DID } from '../types/index';

describe('MPC Client', () => {
  describe('client creation', () => {
    it('should create client with default config', () => {
      const client = createMPCClient();
      expect(client).toBeInstanceOf(MPCClient);
    });

    it('should create client with custom config', () => {
      const client = createMPCClient({
        endpoints: ['http://custom:4010'],
        networkId: 'custom-network',
        threshold: 2,
        timeout: 60000,
        devMode: false,
      });
      expect(client).toBeInstanceOf(MPCClient);
    });

    it('should merge config with defaults', () => {
      const client = createMPCClient({
        threshold: 3,
      });
      expect(client).toBeInstanceOf(MPCClient);
    });
  });

  describe('getHealthyNodes', () => {
    it('should return empty array before initialization', () => {
      const client = createMPCClient();
      const healthyNodes = client.getHealthyNodes();
      expect(healthyNodes).toEqual([]);
    });
  });

  describe('dev mode behavior', () => {
    it('should work in dev mode without external nodes', async () => {
      const client = createMPCClient({
        devMode: true,
        threshold: 0, // No nodes required in dev mode
      });

      // Get network status should work
      const status = await client.getNetworkStatus();
      expect(status.operational).toBe(true);
    });
  });

  describe('signing request types', () => {
    it('should accept message signature type', () => {
      // Verify the type system accepts valid signature types
      const types: Array<'message' | 'transaction' | 'typedData'> = [
        'message',
        'transaction',
        'typedData',
      ];
      expect(types).toHaveLength(3);
    });
  });

  describe('config validation', () => {
    it('should handle empty endpoints array', () => {
      const client = createMPCClient({
        endpoints: [],
        threshold: 0,
      });
      expect(client).toBeInstanceOf(MPCClient);
    });

    it('should handle multiple endpoints', () => {
      const client = createMPCClient({
        endpoints: [
          'http://node1:4010',
          'http://node2:4010',
          'http://node3:4010',
        ],
      });
      expect(client).toBeInstanceOf(MPCClient);
    });

    it('should handle zero threshold', () => {
      const client = createMPCClient({
        threshold: 0,
      });
      expect(client).toBeInstanceOf(MPCClient);
    });

    it('should handle very long timeout', () => {
      const client = createMPCClient({
        timeout: 600000, // 10 minutes
      });
      expect(client).toBeInstanceOf(MPCClient);
    });
  });

  describe('network status structure', () => {
    it('should return correct status structure', async () => {
      const client = createMPCClient({
        devMode: true,
        threshold: 0,
      });

      const status = await client.getNetworkStatus();

      expect(status).toHaveProperty('operational');
      expect(status).toHaveProperty('healthyNodes');
      expect(status).toHaveProperty('totalNodes');
      expect(status).toHaveProperty('thresholdMet');
      expect(status).toHaveProperty('nodes');

      expect(typeof status.operational).toBe('boolean');
      expect(typeof status.healthyNodes).toBe('number');
      expect(typeof status.totalNodes).toBe('number');
      expect(typeof status.thresholdMet).toBe('boolean');
      expect(Array.isArray(status.nodes)).toBe(true);
    });
  });

  /**
   * Integration tests requiring live MPC infrastructure.
   *
   * Prerequisites:
   * 1. Start MPC node: `cd apps/compute && bun run dev`
   * 2. Node must be accessible at http://localhost:4010
   * 3. Node must respond to /health endpoint with valid attestation
   *
   * To run: Remove `.skip` and ensure node is running.
   * CI: These tests are skipped; run manually during staging validation.
   */
  describe.skip('with running MPC node', () => {
    it('should initialize and discover nodes', async () => {
      const client = createMPCClient({
        endpoints: ['http://localhost:4010'],
        threshold: 1,
        devMode: false,
      });

      await client.initialize();
      const nodes = client.getHealthyNodes();
      expect(nodes.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate key for user', async () => {
      const client = createMPCClient({
        endpoints: ['http://localhost:4010'],
        threshold: 1,
        devMode: false,
      });

      await client.initialize();

      const result = await client.generateKey(
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID,
        {
          type: 'wallet',
          proof: '0x',
          identifier: 'test',
        }
      );

      expect(result.success).toBe(true);
      expect(result.walletAddress).toBeDefined();
    });

    it('should sign message for user', async () => {
      const client = createMPCClient({
        endpoints: ['http://localhost:4010'],
        threshold: 1,
        devMode: false,
      });

      await client.initialize();

      const result = await client.sign(
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID,
        '0x68656c6c6f', // "hello" in hex
        'message'
      );

      expect(result.success).toBe(true);
      expect(result.signature).toBeDefined();
    });
  });
});

describe('MPC Client Error Handling', () => {
  describe('initialization errors', () => {
    it('should throw when threshold not met', async () => {
      const client = createMPCClient({
        endpoints: ['http://nonexistent:9999'],
        threshold: 1, // Requires at least 1 node
        timeout: 1000, // Short timeout
        devMode: false,
      });

      await expect(client.initialize()).rejects.toThrow(
        /Insufficient healthy nodes/
      );
    });
  });

  describe('operation before initialization', () => {
    it('should auto-initialize on first operation', async () => {
      const client = createMPCClient({
        devMode: true,
        threshold: 0,
      });

      // Should not throw - will auto-initialize
      const status = await client.getNetworkStatus();
      expect(status).toBeDefined();
    });
  });
});
