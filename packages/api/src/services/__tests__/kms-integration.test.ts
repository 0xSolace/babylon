/**
 * KMS Integration Service Tests
 *
 * Tests for the Jeju KMS integration with fallback to local enclave.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { Address } from 'viem';
import { type AccessPolicy, KMSIntegrationService } from '../kms-integration';

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

mock.module('../tee/babylon-enclave', () => ({
  getBabylonEnclave: mock(async () => ({
    sealState: mockSealState,
    unsealState: mockUnsealState,
    getStatus: () => ({ running: true }),
  })),
}));

describe('KMSIntegrationService', () => {
  let service: KMSIntegrationService;
  const testOwner = '0x1234567890123456789012345678901234567890' as Address;
  const otherAddress = '0xabcdef1234567890abcdef1234567890abcdef12' as Address;

  beforeEach(async () => {
    // Clear environment to ensure no external KMS
    delete process.env.JEJU_KMS_ENDPOINT;

    service = new KMSIntegrationService({
      enabled: false, // Disable external KMS
      fallbackToLocal: true,
      verbose: false,
    });
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('initialization', () => {
    it('initializes with local enclave when KMS disabled', async () => {
      const status = service.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.kmsAvailable).toBe(false);
      expect(status.localAvailable).toBe(true);
      expect(status.activeProvider).toBe('local');
    });

    it('throws when no provider available', async () => {
      const noProviderService = new KMSIntegrationService({
        enabled: false,
        fallbackToLocal: false,
      });

      await expect(noProviderService.initialize()).rejects.toThrow(
        'No encryption provider available'
      );
    });

    it('handles double initialization gracefully', async () => {
      await service.initialize();
      await service.initialize(); // Should not throw

      expect(service.getStatus().initialized).toBe(true);
    });
  });

  describe('key generation', () => {
    it('generates unique keys', async () => {
      const policy: AccessPolicy = { owner: testOwner };

      const key1 = await service.generateKey(policy);
      const key2 = await service.generateKey(policy);

      expect(key1.keyId).not.toBe(key2.keyId);
      expect(key1.publicKey).toMatch(/^0x[0-9a-f]{64}$/i);
    });

    it('includes owner in key ID derivation', async () => {
      const policy1: AccessPolicy = { owner: testOwner };
      const policy2: AccessPolicy = { owner: otherAddress };

      const key1 = await service.generateKey(policy1);
      const key2 = await service.generateKey(policy2);

      // Keys should be different since owners differ
      expect(key1.publicKey).not.toBe(key2.publicKey);
    });

    it('increments key count', async () => {
      const policy: AccessPolicy = { owner: testOwner };

      expect(service.getStatus().keyCount).toBe(0);

      await service.generateKey(policy);
      expect(service.getStatus().keyCount).toBe(1);

      await service.generateKey(policy);
      expect(service.getStatus().keyCount).toBe(2);
    });
  });

  describe('encryption', () => {
    it('encrypts string data', async () => {
      const policy: AccessPolicy = { owner: testOwner };
      const plaintext = 'sensitive game state data';

      const encrypted = await service.encrypt(plaintext, policy);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.dataHash).toMatch(/^0x[0-9a-f]{64}$/i);
      expect(encrypted.provider).toBe('local');
      expect(encrypted.encryptedAt).toBeGreaterThan(0);
    });

    it('encrypts Uint8Array data', async () => {
      const policy: AccessPolicy = { owner: testOwner };
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

      const encrypted = await service.encrypt(data, policy);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.dataHash).toMatch(/^0x[0-9a-f]{64}$/i);
    });

    it('produces different ciphertext for same data', async () => {
      const policy: AccessPolicy = { owner: testOwner };
      const plaintext = 'same data';

      const encrypted1 = await service.encrypt(plaintext, policy);
      const encrypted2 = await service.encrypt(plaintext, policy);

      // IVs should be different
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('uses provided keyId', async () => {
      const policy: AccessPolicy = { owner: testOwner };
      const key = await service.generateKey(policy);

      const encrypted = await service.encrypt('data', policy, key.keyId);

      expect(encrypted.keyId).toBe(key.keyId);
    });

    it('stores policy in encrypted data', async () => {
      const policy: AccessPolicy = {
        owner: testOwner,
        minStake: 1000000000000000000n,
        agentId: 42,
        expiresAt: Date.now() + 3600000,
      };

      const encrypted = await service.encrypt('data', policy);

      expect(encrypted.policy).toEqual(policy);
    });
  });

  describe('decryption', () => {
    it('decrypts data for owner', async () => {
      const policy: AccessPolicy = { owner: testOwner };
      const plaintext = 'secret message';

      const encrypted = await service.encrypt(plaintext, policy);
      const decrypted = await service.decrypt(encrypted, testOwner);

      const decryptedStr = new TextDecoder().decode(decrypted);
      expect(decryptedStr).toBe(plaintext);
    });

    it('denies access to non-owner', async () => {
      const policy: AccessPolicy = { owner: testOwner };
      const encrypted = await service.encrypt('secret', policy);

      await expect(service.decrypt(encrypted, otherAddress)).rejects.toThrow(
        'Access denied'
      );
    });

    it('allows case-insensitive owner check', async () => {
      const policy: AccessPolicy = {
        owner: testOwner.toLowerCase() as Address,
      };
      const encrypted = await service.encrypt('data', policy);

      // Should work with uppercase version
      const decrypted = await service.decrypt(
        encrypted,
        testOwner.toUpperCase() as Address
      );
      expect(decrypted).toBeDefined();
    });
  });

  describe('access control', () => {
    it('owner always has access even after expiration', async () => {
      // Owner access is unconditional by design (they own the data)
      const policy: AccessPolicy = {
        owner: testOwner,
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      };
      const encrypted = await service.encrypt('data', policy);

      // Owner should still have access
      const decrypted = await service.decrypt(encrypted, testOwner);
      expect(decrypted).toBeDefined();
    });

    it('denies expired access to non-owner', async () => {
      const policy: AccessPolicy = {
        owner: testOwner,
        expiresAt: Date.now() - 1000, // Expired
      };
      const encrypted = await service.encrypt('data', policy);

      // Non-owner denied after expiration
      await expect(service.decrypt(encrypted, otherAddress)).rejects.toThrow(
        'Access denied'
      );
    });

    it('allows access before expiration', async () => {
      const policy: AccessPolicy = {
        owner: testOwner,
        expiresAt: Date.now() + 3600000, // Expires in 1 hour
      };
      const encrypted = await service.encrypt('data', policy);

      const decrypted = await service.decrypt(encrypted, testOwner);
      expect(decrypted).toBeDefined();
    });
  });

  describe('key rotation', () => {
    it('rotates key and generates new key ID', async () => {
      const policy: AccessPolicy = { owner: testOwner };
      const key1 = await service.generateKey(policy);

      const { newKeyId, publicKey } = await service.rotateKey(
        key1.keyId,
        policy
      );

      expect(newKeyId).not.toBe(key1.keyId);
      expect(publicKey).toMatch(/^0x[0-9a-f]{64}$/i);
    });
  });

  describe('re-encryption', () => {
    it('re-encrypts data with new policy', async () => {
      const policy1: AccessPolicy = { owner: testOwner };
      const policy2: AccessPolicy = {
        owner: testOwner,
        minStake: 1000000000000000000n,
      };

      const encrypted1 = await service.encrypt('data', policy1);

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 2));

      const reencrypted = await service.reencrypt(
        encrypted1,
        testOwner,
        policy2
      );

      expect(reencrypted.policy).toEqual(policy2);
      expect(reencrypted.encryptedAt).toBeGreaterThanOrEqual(
        encrypted1.encryptedAt
      );
    });

    it('fails re-encryption for non-owner', async () => {
      const policy: AccessPolicy = { owner: testOwner };
      const encrypted = await service.encrypt('data', policy);

      await expect(
        service.reencrypt(encrypted, otherAddress, policy)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('shutdown', () => {
    it('clears keys on shutdown', async () => {
      const policy: AccessPolicy = { owner: testOwner };
      await service.generateKey(policy);
      await service.generateKey(policy);

      expect(service.getStatus().keyCount).toBe(2);

      await service.shutdown();

      expect(service.getStatus().keyCount).toBe(0);
      expect(service.getStatus().initialized).toBe(false);
    });

    it('throws on operations after shutdown', async () => {
      await service.shutdown();

      const policy: AccessPolicy = { owner: testOwner };
      await expect(service.generateKey(policy)).rejects.toThrow(
        'not initialized'
      );
    });
  });

  describe('error handling', () => {
    it('throws when not initialized', async () => {
      const uninitializedService = new KMSIntegrationService({
        enabled: false,
        fallbackToLocal: true,
      });

      const policy: AccessPolicy = { owner: testOwner };
      await expect(uninitializedService.generateKey(policy)).rejects.toThrow(
        'not initialized'
      );
    });
  });

  describe('edge cases', () => {
    it('handles empty string encryption', async () => {
      const policy: AccessPolicy = { owner: testOwner };
      const encrypted = await service.encrypt('', policy);

      expect(encrypted.ciphertext).toBeDefined();
    });

    it('handles large data encryption', async () => {
      const policy: AccessPolicy = { owner: testOwner };
      const largeData = 'x'.repeat(1000000); // 1MB

      const encrypted = await service.encrypt(largeData, policy);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.ciphertext.length).toBeGreaterThan(
        largeData.length * 0.5
      );
    });

    it('handles binary data with null bytes', async () => {
      const policy: AccessPolicy = { owner: testOwner };
      const binaryData = new Uint8Array([0, 1, 0, 255, 0, 128]);

      const encrypted = await service.encrypt(binaryData, policy);
      const decrypted = await service.decrypt(encrypted, testOwner);

      expect(decrypted.length).toBe(binaryData.length);
    });
  });
});

describe('KMSIntegrationService with external KMS', () => {
  it('attempts to connect to KMS when endpoint configured', async () => {
    // Set up mock KMS endpoint
    process.env.JEJU_KMS_ENDPOINT = 'http://localhost:9999';

    const service = new KMSIntegrationService({
      enabled: true,
      fallbackToLocal: true,
    });

    await service.initialize();

    // Should fall back to local since mock endpoint is unreachable
    const status = service.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.kmsAvailable).toBe(false);
    expect(status.localAvailable).toBe(true);

    await service.shutdown();
    delete process.env.JEJU_KMS_ENDPOINT;
  });
});
