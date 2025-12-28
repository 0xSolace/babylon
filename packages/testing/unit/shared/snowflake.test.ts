/**
 * Snowflake ID Generator Unit Tests
 * Tests for the shared package's Snowflake ID utilities
 */

import { describe, expect, it } from 'bun:test'
import {
  generateSnowflakeId,
  isValidSnowflakeId,
  parseSnowflakeId,
} from '@jejunetwork/shared'

describe('Snowflake ID Generator', () => {
  describe('generateSnowflakeId', () => {
    it('should generate a unique ID', async () => {
      const id = await generateSnowflakeId()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('should generate IDs that are valid numbers', async () => {
      const id = await generateSnowflakeId()
      const num = BigInt(id)
      expect(num).toBeGreaterThan(0n)
    })

    it('should generate unique IDs on sequential calls', async () => {
      const ids = await Promise.all([
        generateSnowflakeId(),
        generateSnowflakeId(),
        generateSnowflakeId(),
        generateSnowflakeId(),
        generateSnowflakeId(),
      ])

      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should generate monotonically increasing IDs', async () => {
      const id1 = await generateSnowflakeId()
      const id2 = await generateSnowflakeId()
      const id3 = await generateSnowflakeId()

      expect(BigInt(id1)).toBeLessThan(BigInt(id2))
      expect(BigInt(id2)).toBeLessThan(BigInt(id3))
    })
  })

  describe('isValidSnowflakeId', () => {
    it('should validate correct snowflake IDs', async () => {
      const id = await generateSnowflakeId()
      expect(isValidSnowflakeId(id)).toBe(true)
    })

    it('should reject invalid snowflake IDs', () => {
      // Non-numeric strings throw SyntaxError in BigInt
      expect(() => isValidSnowflakeId('invalid')).toThrow()
      expect(() => isValidSnowflakeId('abc123')).toThrow()
      expect(() => isValidSnowflakeId('12.34')).toThrow() // Floats are invalid
    })

    it('should handle edge cases', () => {
      // Empty string: BigInt('') returns 0n (valid in BigInt), so this returns true
      // This is technically a valid BigInt value but may not be a valid snowflake
      expect(isValidSnowflakeId('')).toBe(true) // BigInt('') === 0n
      // Zero is valid in the current implementation (within 63-bit range)
      expect(isValidSnowflakeId('0')).toBe(true)
      // Very large numbers beyond 63 bits should be invalid
      expect(isValidSnowflakeId('18446744073709551616')).toBe(false) // 2^64
    })

    it('should validate numeric strings', () => {
      // Valid 64-bit numbers should pass
      expect(isValidSnowflakeId('123456789012345')).toBe(true)
      expect(isValidSnowflakeId('1')).toBe(true)
    })
  })

  describe('parseSnowflakeId', () => {
    it('should parse a snowflake ID and return components', async () => {
      const id = await generateSnowflakeId()
      const parsed = parseSnowflakeId(id)

      expect(parsed.timestamp).toBeInstanceOf(Date)
      expect(typeof parsed.workerId).toBe('number')
      expect(typeof parsed.sequence).toBe('number')
    })

    it('should return a timestamp close to current time', async () => {
      const before = new Date()
      const id = await generateSnowflakeId()
      const after = new Date()

      const parsed = parseSnowflakeId(id)

      // Timestamp should be between before and after
      expect(parsed.timestamp.getTime()).toBeGreaterThanOrEqual(
        before.getTime() - 1000,
      )
      expect(parsed.timestamp.getTime()).toBeLessThanOrEqual(
        after.getTime() + 1000,
      )
    })

    it('should handle BigInt input', async () => {
      const id = await generateSnowflakeId()
      const parsed = parseSnowflakeId(String(BigInt(id)))

      expect(parsed.timestamp).toBeInstanceOf(Date)
    })
  })
})
