/**
 * Extended DID Utils Tests
 *
 * Edge cases, boundary conditions, and error handling
 */

import { describe, expect, it } from 'bun:test'
import {
  createDID,
  didEquals,
  generateRandomDID,
  getNetwork,
  isLocalnet,
  isMainnet,
  isTestnet,
  parseDID,
  validateDID,
} from '../did/index'
import type { DID } from '../types/index'

describe('DID Utils Extended', () => {
  describe('createDID edge cases', () => {
    it('should handle minimum length public key', () => {
      const shortKey = '0x00' as `0x${string}`
      const did = createDID(shortKey, 'mainnet')
      expect(did).toStartWith('did:jeju:mainnet:0x')
      expect(validateDID(did)).toBe(true)
    })

    it('should handle very long public key', () => {
      const longKey = `0x${'ff'.repeat(128)}` as `0x${string}`
      const did = createDID(longKey, 'mainnet')
      expect(did).toStartWith('did:jeju:mainnet:0x')
      expect(validateDID(did)).toBe(true)
    })

    it('should create consistent DIDs from same key', () => {
      const key =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`
      const did1 = createDID(key, 'mainnet')
      const did2 = createDID(key, 'mainnet')
      expect(did1).toBe(did2)
    })

    it('should create different DIDs for different networks', () => {
      const key =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`
      const mainnetDid = createDID(key, 'mainnet')
      const testnetDid = createDID(key, 'testnet')
      const localnetDid = createDID(key, 'localnet')

      expect(mainnetDid).not.toBe(testnetDid)
      expect(testnetDid).not.toBe(localnetDid)
      expect(mainnetDid).not.toBe(localnetDid)
    })
  })

  describe('parseDID edge cases', () => {
    it('should parse DID with mixed case identifier', () => {
      const did =
        'did:jeju:mainnet:0xAbCdEf1234567890abcdef1234567890AbCdEf12' as DID
      const parsed = parseDID(did)
      expect(parsed.identifier).toBe(
        '0xAbCdEf1234567890abcdef1234567890AbCdEf12',
      )
    })

    it('should throw for empty DID', () => {
      expect(() => parseDID('' as DID)).toThrow('Invalid DID format')
    })

    it('should throw for DID with missing parts', () => {
      expect(() => parseDID('did:jeju:mainnet' as DID)).toThrow(
        'Invalid DID format',
      )
      expect(() => parseDID('did:jeju' as DID)).toThrow('Invalid DID format')
      expect(() => parseDID('did' as DID)).toThrow('Invalid DID format')
    })

    it('should throw for DID with wrong method', () => {
      expect(() =>
        parseDID('did:ethr:mainnet:0x1234567890abcdef12345678' as DID),
      ).toThrow('Invalid DID format')
    })

    it('should throw for DID with extra colons', () => {
      expect(() => parseDID('did:jeju:mainnet:0x123:extra' as DID)).toThrow(
        'Invalid DID format',
      )
    })
  })

  describe('validateDID edge cases', () => {
    it('should reject null and undefined', () => {
      expect(validateDID(null as unknown as string)).toBe(false)
      expect(validateDID(undefined as unknown as string)).toBe(false)
    })

    it('should reject non-string values', () => {
      expect(validateDID(123 as unknown as string)).toBe(false)
      expect(validateDID({} as unknown as string)).toBe(false)
      expect(validateDID([] as unknown as string)).toBe(false)
    })

    it('should reject empty string', () => {
      expect(validateDID('')).toBe(false)
    })

    it('should reject whitespace-only string', () => {
      expect(validateDID('   ')).toBe(false)
      expect(validateDID('\t\n')).toBe(false)
    })

    it('should reject DIDs with whitespace', () => {
      expect(
        validateDID(
          ' did:jeju:mainnet:0x1234567890abcdef1234567890abcdef12345678',
        ),
      ).toBe(false)
      expect(
        validateDID(
          'did:jeju:mainnet:0x1234567890abcdef1234567890abcdef12345678 ',
        ),
      ).toBe(false)
    })

    it('should validate all network types', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      expect(validateDID(`did:jeju:mainnet:${address}`)).toBe(true)
      expect(validateDID(`did:jeju:testnet:${address}`)).toBe(true)
      expect(validateDID(`did:jeju:localnet:${address}`)).toBe(true)
    })

    it('should reject unknown network types', () => {
      expect(
        validateDID(
          'did:jeju:devnet:0x1234567890abcdef1234567890abcdef12345678',
        ),
      ).toBe(false)
      expect(
        validateDID(
          'did:jeju:staging:0x1234567890abcdef1234567890abcdef12345678',
        ),
      ).toBe(false)
    })
  })

  describe('generateRandomDID edge cases', () => {
    it('should generate unique DIDs in rapid succession', () => {
      const dids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        dids.add(generateRandomDID())
      }
      // All DIDs should be unique
      expect(dids.size).toBe(100)
    })

    it('should generate valid DIDs for all networks', () => {
      const networks = ['mainnet', 'testnet', 'localnet'] as const
      for (const network of networks) {
        const did = generateRandomDID(network)
        expect(validateDID(did)).toBe(true)
        expect(did).toContain(`:${network}:`)
      }
    })
  })

  describe('didEquals edge cases', () => {
    it('should handle null/undefined gracefully', () => {
      const validDid =
        'did:jeju:mainnet:0x1234567890abcdef1234567890abcdef12345678' as DID
      expect(didEquals(validDid, null as unknown as DID)).toBe(false)
      expect(didEquals(null as unknown as DID, validDid)).toBe(false)
      expect(didEquals(undefined as unknown as DID, validDid)).toBe(false)
    })

    it('should compare DIDs with different networks as not equal', () => {
      const mainnet =
        'did:jeju:mainnet:0x1234567890abcdef1234567890abcdef12345678' as DID
      const testnet =
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID
      expect(didEquals(mainnet, testnet)).toBe(false)
    })

    it('should be case-insensitive for hex portion only', () => {
      const lower =
        'did:jeju:mainnet:0xabcdef1234567890abcdef1234567890abcdef12' as DID
      const upper =
        'did:jeju:mainnet:0xABCDEF1234567890ABCDEF1234567890ABCDEF12' as DID
      expect(didEquals(lower, upper)).toBe(true)
    })
  })

  describe('getNetwork edge cases', () => {
    it('should extract network correctly', () => {
      expect(
        getNetwork(
          'did:jeju:mainnet:0x1234567890abcdef1234567890abcdef12345678' as DID,
        ),
      ).toBe('mainnet')
      expect(
        getNetwork(
          'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID,
        ),
      ).toBe('testnet')
      expect(
        getNetwork(
          'did:jeju:localnet:0x1234567890abcdef1234567890abcdef12345678' as DID,
        ),
      ).toBe('localnet')
    })
  })

  describe('network check functions', () => {
    it('isMainnet should work correctly', () => {
      expect(
        isMainnet(
          'did:jeju:mainnet:0x1234567890abcdef1234567890abcdef12345678' as DID,
        ),
      ).toBe(true)
      expect(
        isMainnet(
          'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID,
        ),
      ).toBe(false)
    })

    it('isTestnet should work correctly', () => {
      expect(
        isTestnet(
          'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID,
        ),
      ).toBe(true)
      expect(
        isTestnet(
          'did:jeju:mainnet:0x1234567890abcdef1234567890abcdef12345678' as DID,
        ),
      ).toBe(false)
    })

    it('isLocalnet should work correctly', () => {
      expect(
        isLocalnet(
          'did:jeju:localnet:0x1234567890abcdef1234567890abcdef12345678' as DID,
        ),
      ).toBe(true)
      expect(
        isLocalnet(
          'did:jeju:mainnet:0x1234567890abcdef1234567890abcdef12345678' as DID,
        ),
      ).toBe(false)
    })
  })

  describe('concurrent DID operations', () => {
    it('should handle concurrent random DID generation', async () => {
      const promises = Array.from({ length: 50 }, () =>
        Promise.resolve(generateRandomDID()),
      )
      const dids = await Promise.all(promises)

      // All should be unique
      const uniqueDids = new Set(dids)
      expect(uniqueDids.size).toBe(50)

      // All should be valid
      for (const did of dids) {
        expect(validateDID(did)).toBe(true)
      }
    })

    it('should handle concurrent DID creation from different keys', async () => {
      const keys = Array.from(
        { length: 20 },
        (_, i) =>
          `0x${i.toString(16).padStart(2, '0').repeat(32)}` as `0x${string}`,
      )

      const promises = keys.map((key) =>
        Promise.resolve(createDID(key, 'mainnet')),
      )
      const dids = await Promise.all(promises)

      // All should be unique
      const uniqueDids = new Set(dids)
      expect(uniqueDids.size).toBe(20)
    })
  })
})
