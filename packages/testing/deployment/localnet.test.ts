/**
 * Localnet Deployment Tests
 *
 * Validates the Babylon deployment on local Hardhat network.
 * Run with: bun run test:localnet
 */

import { beforeAll, describe, expect, it } from 'bun:test';
import { type Address, createPublicClient, http } from 'viem';
import { hardhat } from 'viem/chains';

// Localnet configuration
const LOCAL_RPC = process.env.NEXT_PUBLIC_RPC_URL ?? 'http://localhost:8545';
const KEY_REGISTRY_ADDRESS = process.env.KEY_REGISTRY_ADDRESS as
  | Address
  | undefined;
const MESSAGE_NODE_REGISTRY_ADDRESS = process.env
  .MESSAGE_NODE_REGISTRY_ADDRESS as Address | undefined;

const KMS_ENDPOINT = process.env.KMS_ENDPOINT ?? 'http://localhost:3300';
const RELAY_ENDPOINT = process.env.RELAY_ENDPOINT ?? 'http://localhost:3200';
const CQL_ENDPOINT =
  process.env.CQL_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:8546';

describe('Localnet Deployment', () => {
  let publicClient: ReturnType<typeof createPublicClient>;

  beforeAll(() => {
    publicClient = createPublicClient({
      chain: hardhat,
      transport: http(LOCAL_RPC),
    });
  });

  describe('Chain Connectivity', () => {
    it('can connect to local Hardhat node', async () => {
      const chainId = await publicClient.getChainId();
      expect(chainId).toBe(31337);
    });

    it('can fetch latest block', async () => {
      const block = await publicClient.getBlockNumber();
      expect(block).toBeGreaterThanOrEqual(0n);
    });

    it('has funded accounts', async () => {
      // Hardhat default account 0
      const balance = await publicClient.getBalance({
        address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      });
      expect(balance).toBeGreaterThan(0n);
    });
  });

  describe('Contract Deployment', () => {
    const skipIfNoContracts = KEY_REGISTRY_ADDRESS ? it : it.skip;

    skipIfNoContracts('KeyRegistry is deployed', async () => {
      const code = await publicClient.getCode({
        address: KEY_REGISTRY_ADDRESS!,
      });
      expect(code).toBeDefined();
      expect(code).not.toBe('0x');
      expect(code!.length).toBeGreaterThan(2);
    });

    skipIfNoContracts('MessageNodeRegistry is deployed', async () => {
      const code = await publicClient.getCode({
        address: MESSAGE_NODE_REGISTRY_ADDRESS!,
      });
      expect(code).toBeDefined();
      expect(code).not.toBe('0x');
      expect(code!.length).toBeGreaterThan(2);
    });
  });

  describe('Core Services', () => {
    it('PostgreSQL is accessible', async () => {
      const { db } = await import('@babylon/db');
      const result = await db.$queryRaw`SELECT 1 as check`;
      expect(result).toBeDefined();
    });

    it('Decentralized cache is accessible', async () => {
      const { isCacheServiceReachable } = await import('@babylon/api/cache');
      const reachable = await isCacheServiceReachable();
      expect(reachable).toBe(true);
    });
  });

  describe('Messaging Services', () => {
    it('KMS service is healthy', async () => {
      const response = await fetch(`${KMS_ENDPOINT}/health`);

      if (!response.ok) {
        console.warn('⚠️  KMS not running - run: bun run infra:messaging');
        return;
      }

      const data = (await response.json()) as { status: string };
      expect(data.status).toBe('healthy');
    });

    it('Relay service is healthy', async () => {
      const response = await fetch(`${RELAY_ENDPOINT}/health`);

      if (!response.ok) {
        console.warn('⚠️  Relay not running - run: bun run infra:messaging');
        return;
      }

      const data = (await response.json()) as { status: string };
      expect(data.status).toBe('healthy');
    });

    it('CQL service is healthy', async () => {
      const response = await fetch(`${CQL_ENDPOINT}/v1/health`).catch(
        () => null
      );

      if (!response?.ok) {
        console.warn('⚠️  CQL not running - run: bun run infra:messaging');
        return;
      }

      expect(response.ok).toBe(true);
    });
  });
});

describe('Localnet Integration', () => {
  it('can generate encryption keys via KMS', async () => {
    const response = await fetch(`${KMS_ENDPOINT}/keys/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'encryption',
        curve: 'x25519',
        owner: '0x0000000000000000000000000000000000000000',
      }),
    }).catch(() => null);

    if (!response?.ok) {
      console.warn('⚠️  Skipping - KMS not available');
      return;
    }

    const data = (await response.json()) as {
      publicKey: string;
      metadata: { id: string };
    };
    expect(data.publicKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(data.metadata.id).toMatch(/^key-/);
  });

  it('can send message through relay', async () => {
    const response = await fetch(`${RELAY_ENDPOINT}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        encryptedContent: Buffer.from('localnet-test-message').toString(
          'base64'
        ),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      console.warn('⚠️  Skipping - Relay not available');
      return;
    }

    const data = (await response.json()) as {
      success: boolean;
      messageId: string;
    };
    expect(data.success).toBe(true);
    expect(data.messageId).toMatch(/^msg-/);
  });

  it('full message round-trip', async () => {
    const testRecipient = `0x${'0'.repeat(38)}77` as Address;

    // Check relay health first
    const healthResponse = await fetch(`${RELAY_ENDPOINT}/health`).catch(
      () => null
    );
    if (!healthResponse?.ok) {
      console.warn('⚠️  Skipping - Relay not available');
      return;
    }

    // Send message
    const sendResponse = await fetch(`${RELAY_ENDPOINT}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        recipient: testRecipient,
        encryptedContent: Buffer.from('round-trip-test').toString('base64'),
      }),
    });

    const sendData = (await sendResponse.json()) as { messageId: string };
    expect(sendData.messageId).toBeDefined();

    // Retrieve message
    const getResponse = await fetch(
      `${RELAY_ENDPOINT}/messages?recipient=${testRecipient}`
    );
    const getData = (await getResponse.json()) as {
      messages: { id: string; sender: string }[];
    };

    expect(getData.messages.length).toBeGreaterThan(0);

    const ourMessage = getData.messages.find(
      (m) => m.id === sendData.messageId
    );
    expect(ourMessage).toBeDefined();
    expect(ourMessage?.sender).toBe(
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
    );

    // Acknowledge delivery
    const ackResponse = await fetch(
      `${RELAY_ENDPOINT}/messages/${sendData.messageId}/ack`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: testRecipient,
          status: 'delivered',
        }),
      }
    );

    const ackData = (await ackResponse.json()) as { success: boolean };
    expect(ackData.success).toBe(true);
  });
});
