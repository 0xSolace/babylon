/**
 * DID Utils Tests
 */

import { describe, expect, it } from 'bun:test'
import {
  createDID,
  didEquals,
  generateRandomDID,
  getNetwork,
  isMainnet,
  parseDID,
  validateDID,
} from '../did/index'
import type { DID } from '../types/index'

describe('DID Utils', () => {
  describe('createDID', () => {
    it('should create a valid DID from a public key', () => {
      const publicKey =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const did = createDID(publicKey as `0x${string}`, 'mainnet')

      expect(did).toStartWith('did:jeju:mainnet:0x')
      // Format: did:jeju:mainnet:0x + 40 hex chars = 59 chars total
      expect(did.length).toBe(59)
    })

    it('should create different DIDs for different keys', () => {
      const key1 =
        '0x1111111111111111111111111111111111111111111111111111111111111111'
      const key2 =
        '0x2222222222222222222222222222222222222222222222222222222222222222'

      const did1 = createDID(key1 as `0x${string}`, 'mainnet')
      const did2 = createDID(key2 as `0x${string}`, 'mainnet')

      expect(did1).not.toBe(did2)
    })

    it('should use mainnet as default network', () => {
      const publicKey =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const did = createDID(publicKey as `0x${string}`)

      expect(did).toContain(':mainnet:')
    })
  })

  describe('parseDID', () => {
    it('should parse a valid DID', () => {
      const did =
        'did:jeju:mainnet:0x1234567890abcdef1234567890abcdef12345678' as DID
      const parsed = parseDID(did)

      expect(parsed.method).toBe('jeju')
      expect(parsed.network).toBe('mainnet')
      expect(parsed.identifier).toBe(
        '0x1234567890abcdef1234567890abcdef12345678',
      )
    })

    it('should throw for invalid DID format', () => {
      expect(() => parseDID('invalid' as DID)).toThrow('Invalid DID format')
      expect(() => parseDID('did:other:mainnet:0x123' as DID)).toThrow(
        'Invalid DID format',
      )
    })
  })

  describe('validateDID', () => {
    it('should validate correct DIDs', () => {
      expect(
        validateDID(
          'did:jeju:mainnet:0x1234567890abcdef1234567890abcdef12345678',
        ),
      ).toBe(true)
      expect(
        validateDID(
          'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678',
        ),
      ).toBe(true)
      expect(
        validateDID(
          'did:jeju:localnet:0x1234567890abcdef1234567890abcdef12345678',
        ),
      ).toBe(true)
    })

    it('should reject invalid DIDs', () => {
      expect(validateDID('did:other:mainnet:0x123')).toBe(false)
      expect(validateDID('did:jeju:invalidnet:0x123')).toBe(false)
      expect(validateDID('not-a-did')).toBe(false)
    })
  })

  describe('generateRandomDID', () => {
    it('should generate valid random DIDs', () => {
      const did1 = generateRandomDID()
      const did2 = generateRandomDID()

      expect(validateDID(did1)).toBe(true)
      expect(validateDID(did2)).toBe(true)
      expect(did1).not.toBe(did2)
    })

    it('should use specified network', () => {
      const did = generateRandomDID('testnet')
      expect(did).toContain(':testnet:')
    })
  })

  describe('didEquals', () => {
    it('should compare DIDs case-insensitively', () => {
      const did1 =
        'did:jeju:mainnet:0xABCDEF1234567890abcdef1234567890abcdef12' as DID
      const did2 =
        'did:jeju:mainnet:0xabcdef1234567890ABCDEF1234567890ABCDEF12' as DID

      expect(didEquals(did1, did2)).toBe(true)
    })
  })

  describe('getNetwork', () => {
    it('should extract network from DID', () => {
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
    })
  })

  describe('isMainnet', () => {
    it('should check if DID is on mainnet', () => {
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
  })
})
