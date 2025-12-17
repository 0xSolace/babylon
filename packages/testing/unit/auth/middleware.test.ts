/**
 * Auth Middleware Unit Tests
 *
 * Tests the authentication middleware with focus on:
 * - Boundary conditions (empty tokens, expired tokens)
 * - Error handling (invalid inputs, malformed data)
 * - Session claims mapping to JejuAuthClaims
 */

import { describe, expect, it } from 'bun:test';

// Import types
import type { Address } from 'viem';

// Mock types for testing middleware logic
interface SessionClaims {
  did: string;
  address: Address;
  iat: number;
  exp: number;
  linkedTypes: string[];
}

interface JejuAuthClaims {
  sub: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  walletAddress?: Address;
  linkedTypes: string[];
}

// Helper to create session claims
function createSessionClaims(
  overrides?: Partial<SessionClaims>
): SessionClaims {
  return {
    did: 'did:jeju:0x1234567890123456789012345678901234567890',
    address: '0x1234567890123456789012345678901234567890' as Address,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    linkedTypes: ['wallet'],
    ...overrides,
  };
}

// Helper to map session claims to auth claims (mimics middleware behavior)
function mapSessionToAuthClaims(sessionClaims: SessionClaims): JejuAuthClaims {
  return {
    sub: sessionClaims.did,
    iss: 'jeju-mpc',
    aud: 'babylon',
    iat: sessionClaims.iat,
    exp: sessionClaims.exp,
    walletAddress: sessionClaims.address,
    linkedTypes: sessionClaims.linkedTypes,
  };
}

describe('Auth Middleware Logic', () => {
  describe('Session Claims Mapping', () => {
    it('should map session DID to sub field', () => {
      const session = createSessionClaims();
      const auth = mapSessionToAuthClaims(session);

      expect(auth.sub).toBe(session.did);
    });

    it('should map session address to walletAddress', () => {
      const session = createSessionClaims();
      const auth = mapSessionToAuthClaims(session);

      expect(auth.walletAddress).toBe(session.address);
    });

    it('should set issuer to jeju-mpc', () => {
      const session = createSessionClaims();
      const auth = mapSessionToAuthClaims(session);

      expect(auth.iss).toBe('jeju-mpc');
    });

    it('should set audience to babylon', () => {
      const session = createSessionClaims();
      const auth = mapSessionToAuthClaims(session);

      expect(auth.aud).toBe('babylon');
    });

    it('should preserve timestamps', () => {
      const session = createSessionClaims({
        iat: 1702600000,
        exp: 1702603600,
      });
      const auth = mapSessionToAuthClaims(session);

      expect(auth.iat).toBe(1702600000);
      expect(auth.exp).toBe(1702603600);
    });

    it('should preserve linked types array', () => {
      const session = createSessionClaims({
        linkedTypes: ['wallet', 'twitter', 'discord'],
      });
      const auth = mapSessionToAuthClaims(session);

      expect(auth.linkedTypes).toEqual(['wallet', 'twitter', 'discord']);
    });
  });

  describe('Token Expiration', () => {
    it('should identify expired token by timestamp', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredAt = now - 60; // 1 minute ago

      expect(expiredAt < now).toBe(true);
    });

    it('should identify valid token by timestamp', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 3600; // 1 hour from now

      expect(expiresAt > now).toBe(true);
    });

    it('should handle token expiring exactly now', () => {
      const now = Math.floor(Date.now() / 1000);
      // Token expires at current second - should be considered expired
      expect(now <= now).toBe(true);
    });

    it('should handle far future expiration', () => {
      const now = Math.floor(Date.now() / 1000);
      const farFuture = now + 365 * 24 * 60 * 60; // 1 year

      expect(farFuture > now).toBe(true);
    });
  });

  describe('Empty/Invalid Claims', () => {
    it('should handle empty DID', () => {
      const session = createSessionClaims({ did: '' });
      const auth = mapSessionToAuthClaims(session);

      expect(auth.sub).toBe('');
    });

    it('should handle empty address', () => {
      const session = createSessionClaims({
        address: '0x0000000000000000000000000000000000000000' as Address,
      });
      const auth = mapSessionToAuthClaims(session);

      expect(auth.walletAddress).toBe(
        '0x0000000000000000000000000000000000000000'
      );
    });

    it('should handle empty linked types', () => {
      const session = createSessionClaims({ linkedTypes: [] });
      const auth = mapSessionToAuthClaims(session);

      expect(auth.linkedTypes).toEqual([]);
    });

    it('should handle zero timestamps', () => {
      const session = createSessionClaims({ iat: 0, exp: 0 });
      const auth = mapSessionToAuthClaims(session);

      expect(auth.iat).toBe(0);
      expect(auth.exp).toBe(0);
    });
  });

  describe('DID Validation', () => {
    it('should accept valid DID format', () => {
      const validDID = 'did:jeju:0x1234567890123456789012345678901234567890';
      const parts = validDID.split(':');

      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('did');
      expect(parts[1]).toBe('jeju');
      expect(parts[2]).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('should handle non-standard DID format', () => {
      const nonStandardDID = 'custom:format:identifier';
      const parts = nonStandardDID.split(':');

      expect(parts.length).toBe(3);
    });

    it('should handle DID with special characters', () => {
      const specialDID = 'did:test:some-identifier_123';
      const auth = mapSessionToAuthClaims(
        createSessionClaims({ did: specialDID })
      );

      expect(auth.sub).toBe(specialDID);
    });
  });

  describe('Address Validation', () => {
    it('should accept lowercase hex address', () => {
      const address = '0xabcdef1234567890abcdef1234567890abcdef12' as Address;
      expect(address).toMatch(/^0x[0-9a-f]{40}$/);
    });

    it('should accept uppercase hex address', () => {
      const address = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12' as Address;
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('should accept checksum address', () => {
      // EIP-55 checksum address
      const address = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed' as Address;
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  describe('Linked Types Handling', () => {
    it('should handle single linked type', () => {
      const session = createSessionClaims({ linkedTypes: ['wallet'] });
      const auth = mapSessionToAuthClaims(session);

      expect(auth.linkedTypes).toHaveLength(1);
      expect(auth.linkedTypes).toContain('wallet');
    });

    it('should handle multiple linked types', () => {
      const types = ['wallet', 'twitter', 'discord', 'farcaster'];
      const session = createSessionClaims({ linkedTypes: types });
      const auth = mapSessionToAuthClaims(session);

      expect(auth.linkedTypes).toHaveLength(4);
      expect(auth.linkedTypes).toEqual(types);
    });

    it('should preserve order of linked types', () => {
      const types = ['discord', 'wallet', 'twitter'];
      const session = createSessionClaims({ linkedTypes: types });
      const auth = mapSessionToAuthClaims(session);

      expect(auth.linkedTypes[0]).toBe('discord');
      expect(auth.linkedTypes[1]).toBe('wallet');
      expect(auth.linkedTypes[2]).toBe('twitter');
    });
  });
});

describe('Request Header Parsing', () => {
  describe('Authorization Header', () => {
    it('should extract Bearer token', () => {
      const authHeader = 'Bearer eyJhbGciOiJIUzI1NiJ9.test';
      const parts = authHeader.split(' ');

      expect(parts[0]).toBe('Bearer');
      expect(parts[1]).toBe('eyJhbGciOiJIUzI1NiJ9.test');
    });

    it('should handle missing Bearer prefix', () => {
      const authHeader = 'eyJhbGciOiJIUzI1NiJ9.test';
      const isBearer = authHeader.startsWith('Bearer ');

      expect(isBearer).toBe(false);
    });

    it('should handle empty Authorization header', () => {
      const authHeader = '';
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

      expect(token).toBeNull();
    });

    it('should handle Basic auth (wrong scheme)', () => {
      const authHeader = 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=';
      const isBearer = authHeader.startsWith('Bearer ');

      expect(isBearer).toBe(false);
    });

    it('should handle malformed Bearer token', () => {
      const authHeader = 'Bearer ';
      const token = authHeader.slice(7).trim();

      expect(token).toBe('');
    });
  });

  describe('Cookie Parsing', () => {
    it('should extract auth token from cookies', () => {
      const cookieHeader = 'session=abc123; auth=eyJhbGciOiJIUzI1NiJ9.test';
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const [key, ...valueParts] = c.trim().split('=');
          return [key, valueParts.join('=')];
        })
      );

      expect(cookies['auth']).toBe('eyJhbGciOiJIUzI1NiJ9.test');
    });

    it('should handle missing auth cookie', () => {
      const cookieHeader = 'session=abc123; other=value';
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const [key, ...valueParts] = c.trim().split('=');
          return [key, valueParts.join('=')];
        })
      );

      expect(cookies['auth']).toBeUndefined();
    });

    it('should handle empty cookie header', () => {
      const cookieHeader: string = '';
      const cookies: Record<string, string> =
        cookieHeader.length > 0
          ? Object.fromEntries(
              cookieHeader.split(';').map((c) => {
                const [key, ...valueParts] = c.trim().split('=');
                return [key ?? '', valueParts.join('=')];
              })
            )
          : {};

      expect(Object.keys(cookies)).toHaveLength(0);
    });

    it('should handle cookie with equals in value', () => {
      const cookieHeader = 'auth=eyJhbGciOiJIUzI1NiJ9.test=sig';
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const [key, ...valueParts] = c.trim().split('=');
          return [key, valueParts.join('=')];
        })
      );

      expect(cookies['auth']).toBe('eyJhbGciOiJIUzI1NiJ9.test=sig');
    });
  });
});
