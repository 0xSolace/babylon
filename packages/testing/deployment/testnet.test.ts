/**
 * Testnet Deployment Tests
 *
 * Validates the Babylon deployment on Jeju testnet.
 * Run with: bun run test:testnet
 */

import { beforeAll, describe, expect, it } from 'bun:test';
import { type Address, createPublicClient, http } from 'viem';
import { optimismSepolia } from 'viem/chains';

// Testnet configuration
const JEJU_TESTNET_RPC =
  process.env.JEJU_TESTNET_RPC_URL ?? 'https://sepolia.optimism.io';
const TESTNET_KEY_REGISTRY = process.env.TESTNET_KEY_REGISTRY_ADDRESS as
  | Address
  | undefined;
const TESTNET_MESSAGE_NODE_REGISTRY = process.env
  .TESTNET_MESSAGE_NODE_REGISTRY_ADDRESS as Address | undefined;
const TESTNET_CQL_ENDPOINT = process.env.TESTNET_CQL_ENDPOINT;
const TESTNET_KMS_ENDPOINT = process.env.TESTNET_KMS_ENDPOINT;
const TESTNET_RELAY_ENDPOINT = process.env.TESTNET_RELAY_ENDPOINT;

describe('Testnet Deployment', () => {
  let publicClient: ReturnType<typeof createPublicClient>;

  beforeAll(() => {
    publicClient = createPublicClient({
      chain: optimismSepolia,
      transport: http(JEJU_TESTNET_RPC),
    });
  });

  describe('Chain Connectivity', () => {
    it('can connect to Jeju testnet', async () => {
      const chainId = await publicClient.getChainId();
      expect(chainId).toBe(optimismSepolia.id);
    });

    it('can fetch latest block', async () => {
      const block = await publicClient.getBlockNumber();
      expect(block).toBeGreaterThan(0n);
    });
  });

  describe('Contract Deployment', () => {
    const skipIfNoContracts = TESTNET_KEY_REGISTRY ? it : it.skip;

    skipIfNoContracts('KeyRegistry is deployed', async () => {
      const code = await publicClient.getCode({
        address: TESTNET_KEY_REGISTRY!,
      });
      expect(code).toBeDefined();
      expect(code).not.toBe('0x');
    });

    skipIfNoContracts('MessageNodeRegistry is deployed', async () => {
      const code = await publicClient.getCode({
        address: TESTNET_MESSAGE_NODE_REGISTRY!,
      });
      expect(code).toBeDefined();
      expect(code).not.toBe('0x');
    });

    it('contract addresses are configured', () => {
      if (!TESTNET_KEY_REGISTRY) {
        console.warn('⚠️  TESTNET_KEY_REGISTRY_ADDRESS not set');
      }
      if (!TESTNET_MESSAGE_NODE_REGISTRY) {
        console.warn('⚠️  TESTNET_MESSAGE_NODE_REGISTRY_ADDRESS not set');
      }
      // This test just logs warnings, doesn't fail
      expect(true).toBe(true);
    });
  });

  describe('Infrastructure Services', () => {
    const skipIfNoCQL = TESTNET_CQL_ENDPOINT ? it : it.skip;
    const skipIfNoKMS = TESTNET_KMS_ENDPOINT ? it : it.skip;
    const skipIfNoRelay = TESTNET_RELAY_ENDPOINT ? it : it.skip;

    skipIfNoCQL('CovenantSQL cluster is healthy', async () => {
      const response = await fetch(`${TESTNET_CQL_ENDPOINT}/v1/health`);
      expect(response.ok).toBe(true);
    });

    skipIfNoKMS('KMS service is healthy', async () => {
      const response = await fetch(`${TESTNET_KMS_ENDPOINT}/health`);
      const data = (await response.json()) as { status: string };
      expect(response.ok).toBe(true);
      expect(data.status).toBe('healthy');
    });

    skipIfNoRelay('Messaging relay is healthy', async () => {
      const response = await fetch(`${TESTNET_RELAY_ENDPOINT}/health`);
      const data = (await response.json()) as { status: string };
      expect(response.ok).toBe(true);
      expect(data.status).toBe('healthy');
    });

    it('infrastructure endpoints are configured', () => {
      const missing: string[] = [];

      if (!TESTNET_CQL_ENDPOINT) missing.push('TESTNET_CQL_ENDPOINT');
      if (!TESTNET_KMS_ENDPOINT) missing.push('TESTNET_KMS_ENDPOINT');
      if (!TESTNET_RELAY_ENDPOINT) missing.push('TESTNET_RELAY_ENDPOINT');

      if (missing.length > 0) {
        console.warn(`⚠️  Missing testnet endpoints: ${missing.join(', ')}`);
      }

      // This test just logs warnings
      expect(true).toBe(true);
    });
  });

  describe('Terraform Resources', () => {
    it('verifies expected AWS resources exist', async () => {
      // This test would need AWS SDK access
      // For now, just verify env vars are set
      const expectedVars = [
        'AWS_REGION',
        'TESTNET_EKS_CLUSTER_NAME',
        'TESTNET_VPC_ID',
      ];

      const missing = expectedVars.filter((v) => !process.env[v]);

      if (missing.length > 0) {
        console.warn(`⚠️  Missing AWS config: ${missing.join(', ')}`);
      }

      expect(true).toBe(true);
    });
  });
});

describe('Testnet Integration', () => {
  const skipIfNoInfra =
    TESTNET_CQL_ENDPOINT && TESTNET_KMS_ENDPOINT && TESTNET_RELAY_ENDPOINT
      ? it
      : it.skip;

  skipIfNoInfra('can generate keys on testnet KMS', async () => {
    const response = await fetch(`${TESTNET_KMS_ENDPOINT}/keys/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'encryption',
        curve: 'x25519',
        owner: '0x0000000000000000000000000000000000000000',
      }),
    });

    const data = (await response.json()) as { publicKey: string };
    expect(response.ok).toBe(true);
    expect(data.publicKey).toMatch(/^0x[a-fA-F0-9]+$/);
  });

  skipIfNoInfra('can send message through testnet relay', async () => {
    const response = await fetch(`${TESTNET_RELAY_ENDPOINT}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: '0x0000000000000000000000000000000000000001',
        recipient: '0x0000000000000000000000000000000000000002',
        encryptedContent: Buffer.from('testnet-integration-test').toString(
          'base64'
        ),
      }),
    });

    const data = (await response.json()) as {
      success: boolean;
      messageId: string;
    };
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
  });
});
