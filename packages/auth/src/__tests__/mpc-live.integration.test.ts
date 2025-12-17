/**
 * MPC Client Live Integration Tests
 *
 * Tests that run against a live MPC node.
 * Prerequisites: MPC node running at http://localhost:4010
 *
 * Start MPC node: cd /path/to/jeju/apps/compute && bun run mpc:dev
 */

import { beforeAll, describe, expect, it } from 'bun:test';
import { MPCClient } from '../mpc/client';
import type { DID } from '../types/index';

const MPC_ENDPOINT = 'http://localhost:4010';

// Check if MPC node is available before running tests
async function isMPCNodeAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${MPC_ENDPOINT}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

describe('MPC Client Live Integration', () => {
  let nodeAvailable = false;

  beforeAll(async () => {
    nodeAvailable = await isMPCNodeAvailable();
    if (!nodeAvailable) {
      console.log('⚠️ MPC node not available at', MPC_ENDPOINT);
      console.log('   Start with: cd apps/compute && bun run mpc:dev');
    }
  });

  it('should connect to live MPC node', async () => {
    if (!nodeAvailable) {
      console.log('Skipping - MPC node not available');
      return;
    }

    const client = new MPCClient({
      endpoints: [MPC_ENDPOINT],
      threshold: 1,
      devMode: false,
      timeout: 5000,
    });

    await client.initialize();
    const nodes = client.getHealthyNodes();

    expect(nodes.length).toBeGreaterThanOrEqual(1);
    expect(nodes[0]?.healthy).toBe(true);
    expect(nodes[0]?.attestation).toBeDefined();
  });

  it('should generate key for user', async () => {
    if (!nodeAvailable) {
      console.log('Skipping - MPC node not available');
      return;
    }

    const client = new MPCClient({
      endpoints: [MPC_ENDPOINT],
      threshold: 1,
      devMode: false,
      timeout: 10000,
    });

    const testDID: DID = `did:jeju:testnet:0x${'a'.repeat(40)}`;

    const result = await client.generateKey(testDID, {
      type: 'wallet',
      signature: `0x${'00'.repeat(65)}` as `0x${string}`,
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);
    expect(result.publicKey).toBeDefined();
    expect(result.walletAddress).toBeDefined();
    expect(result.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('should sign message for user', async () => {
    if (!nodeAvailable) {
      console.log('Skipping - MPC node not available');
      return;
    }

    const client = new MPCClient({
      endpoints: [MPC_ENDPOINT],
      threshold: 1,
      devMode: false,
      timeout: 10000,
    });

    const testDID: DID = `did:jeju:testnet:0x${'b'.repeat(40)}`;

    // First generate a key for this user
    const keyResult = await client.generateKey(testDID, {
      type: 'wallet',
      signature: `0x${'00'.repeat(65)}` as `0x${string}`,
      timestamp: Date.now(),
    });

    expect(keyResult.success).toBe(true);

    // Now sign a message
    const messageHash = `0x${'01'.repeat(32)}` as `0x${string}`;
    const signResult = await client.sign(testDID, messageHash, 'message');

    expect(signResult.success).toBe(true);
    expect(signResult.signature).toBeDefined();
    // Signature is wrapped in an object with the actual hex signature
    const sig = signResult.signature;
    expect(sig).toHaveProperty('signature');
    expect(typeof sig?.signature).toBe('string');
    expect(sig?.signature.startsWith('0x')).toBe(true);
  });

  it('should get network status', async () => {
    if (!nodeAvailable) {
      console.log('Skipping - MPC node not available');
      return;
    }

    const client = new MPCClient({
      endpoints: [MPC_ENDPOINT],
      threshold: 1,
      devMode: false,
      timeout: 5000,
    });

    await client.initialize();
    const status = await client.getNetworkStatus();

    expect(status.operational).toBe(true);
    expect(status.healthyNodes).toBeGreaterThanOrEqual(1);
    expect(status.thresholdMet).toBe(true);
    expect(status.nodes.length).toBeGreaterThanOrEqual(1);
  });
});
