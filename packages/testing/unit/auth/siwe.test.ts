/**
 * SIWE Authentication Tests
 *
 * Tests for nonce generation, consumption, and SIWE message verification.
 */

import { describe, expect, mock, test } from 'bun:test';

const redisNonceStore = new Map<string, string>();

mock.module('../../../api/src/redis/client', () => ({
  getRedis: () => ({
    async setex(key: string, _ttl: number, value: string) {
      redisNonceStore.set(key, value);
      return 'OK';
    },
    async del(key: string) {
      const existed = redisNonceStore.delete(key);
      return existed ? 1 : 0;
    },
  }),
}));

// Import after mocks
const {
  generateNonce,
  consumeNonce,
  verifySiweMessage,
  createSiweMessage,
  getExpectedDomain,
  getAppUrl,
} = await import('../../../api/src/auth/siwe');

describe('SIWE Authentication', () => {
  describe('getExpectedDomain', () => {
    test('returns localhost for development', () => {
      const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
      try {
        delete process.env.NEXT_PUBLIC_APP_URL;

        const domain = getExpectedDomain();
        expect(domain).toBe('localhost');
      } finally {
        if (originalEnv === undefined) {
          delete process.env.NEXT_PUBLIC_APP_URL;
        } else {
          process.env.NEXT_PUBLIC_APP_URL = originalEnv;
        }
      }
    });

    test('extracts hostname from NEXT_PUBLIC_APP_URL', () => {
      const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
      try {
        process.env.NEXT_PUBLIC_APP_URL = 'https://babylon.market';

        const domain = getExpectedDomain();
        expect(domain).toBe('babylon.market');
      } finally {
        if (originalEnv === undefined) {
          delete process.env.NEXT_PUBLIC_APP_URL;
        } else {
          process.env.NEXT_PUBLIC_APP_URL = originalEnv;
        }
      }
    });
  });

  describe('getAppUrl', () => {
    test('returns full URL', () => {
      const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
      try {
        process.env.NEXT_PUBLIC_APP_URL = 'https://babylon.market';

        const url = getAppUrl();
        expect(url).toBe('https://babylon.market');
      } finally {
        if (originalEnv === undefined) {
          delete process.env.NEXT_PUBLIC_APP_URL;
        } else {
          process.env.NEXT_PUBLIC_APP_URL = originalEnv;
        }
      }
    });
  });

  describe('generateNonce', () => {
    test('generates nonce with correct structure', async () => {
      const result = await generateNonce();

      expect(result).toHaveProperty('nonce');
      expect(result).toHaveProperty('issuedAt');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('domain');

      expect(typeof result.nonce).toBe('string');
      expect(result.nonce.length).toBeGreaterThan(0);
      expect(result.issuedAt).toBeInstanceOf(Date);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    test('expiration is 5 minutes after issuedAt', async () => {
      const result = await generateNonce();

      const diffMs = result.expiresAt.getTime() - result.issuedAt.getTime();
      const diffMinutes = diffMs / 1000 / 60;

      expect(diffMinutes).toBeCloseTo(5, 0);
    });

    test('nonce can be consumed exactly once', async () => {
      const { nonce } = await generateNonce();

      const firstConsume = await consumeNonce(nonce);
      const secondConsume = await consumeNonce(nonce);

      expect(firstConsume).toBe(true);
      expect(secondConsume).toBe(false);
    });
  });

  describe('consumeNonce', () => {
    test('returns true when nonce exists', async () => {
      const { nonce } = await generateNonce();
      const result = await consumeNonce(nonce);
      expect(result).toBe(true);
    });

    test('returns false when nonce does not exist', async () => {
      const result = await consumeNonce('nonexistentnonce');
      expect(result).toBe(false);
    });
  });

  describe('createSiweMessage', () => {
    test('creates properly formatted SIWE message', () => {
      // SIWE nonces must be alphanumeric (no hyphens)
      const testNonce = 'testnonce123abc';
      const message = createSiweMessage({
        address: '0x1234567890123456789012345678901234567890',
        nonce: testNonce,
      });

      expect(message).toContain('wants you to sign in');
      expect(message).toContain('0x1234567890123456789012345678901234567890');
      expect(message).toContain(testNonce);
      expect(message).toContain('Register as agent on Babylon');
    });

    test('uses custom statement if provided', () => {
      const message = createSiweMessage({
        address: '0x1234567890123456789012345678901234567890',
        nonce: 'testnonce456',
        statement: 'Custom statement',
      });

      expect(message).toContain('Custom statement');
    });
  });

  describe('verifySiweMessage', () => {
    test('returns invalid_domain when domain mismatch', async () => {
      // Create a message with wrong domain
      const { SiweMessage } = await import('siwe');
      const wrongDomainMessage = new SiweMessage({
        domain: 'wrongdomain.com',
        address: '0x1234567890123456789012345678901234567890',
        statement: 'Test',
        uri: 'https://wrongdomain.com',
        version: '1',
        chainId: 1,
        nonce: 'validnonce123',
        issuedAt: new Date().toISOString(),
      });

      const result = await verifySiweMessage(
        wrongDomainMessage.prepareMessage(),
        '0x' + '0'.repeat(130) // dummy signature
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_domain');
      }
    });

    test('returns invalid_nonce when nonce not found', async () => {
      const message = createSiweMessage({
        address: '0x1234567890123456789012345678901234567890',
        nonce: 'invalidnonce789',
      });

      const result = await verifySiweMessage(message, '0x' + '0'.repeat(130));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_nonce');
      }
    });

    test('returns expired_message when message is expired', async () => {
      const { Wallet } = await import('ethers');
      const { SiweMessage } = await import('siwe');
      const { nonce } = await generateNonce();
      const issuedAt = new Date(Date.now() - 10_000).toISOString();
      const expirationTime = new Date(Date.now() - 1_000).toISOString();

      let signer: InstanceType<typeof Wallet> | null = null;
      let message: string | null = null;

      for (let i = 1; i <= 64; i++) {
        const candidate = new Wallet(`0x${i.toString(16).padStart(64, '0')}`);
        try {
          const siweMessage = new SiweMessage({
            domain: getExpectedDomain(),
            address: candidate.address,
            statement: 'Test',
            uri: getAppUrl(),
            version: '1',
            chainId: 1,
            nonce,
            issuedAt,
            expirationTime,
          });

          signer = candidate;
          message = siweMessage.prepareMessage();
          break;
        } catch {
          continue;
        }
      }

      expect(signer).not.toBeNull();
      expect(message).not.toBeNull();

      const signature = await signer!.signMessage(message!);
      const result = await verifySiweMessage(message!, signature);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('expired_message');
      }
    });
  });
});
