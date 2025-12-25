/**
 * Token Service Integration Tests
 *
 * Tests the TokenService which bridges points to tokens:
 * - Airdrop allocation calculations
 * - Drip tracking
 * - Token balance management
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  calculateAirdropAllocation,
  formatTokens,
  generateAirdropMerkleData,
  parseTokens,
  pointsToDisplayTokens,
} from '@babylon/api'
import { db, eq, users } from '@babylon/db'
import { generateSnowflakeId } from '@jejunetwork/shared'

// Token constants - duplicated until experimental-token package is linked
const AIRDROP_DAILY_DRIP_PERCENT = 5
const AIRDROP_TOTAL_DRIP_DAYS = 20
const TOKEN_DECIMALS = 18
const TOKEN_SYMBOL = 'BBLN'

describe('TokenService', () => {
  let testUserId: string

  beforeAll(async () => {
    // Create a test user with points
    testUserId = await generateSnowflakeId()

    await db.insert(users).values({
      id: testUserId,
      username: `test_token_${testUserId}`,
      displayName: 'Test Token User',
      walletAddress: `0x${testUserId.slice(0, 40)}`,
      reputationPoints: 10000,
      invitePoints: 500,
      earnedPoints: 200,
      bonusPoints: 300,
      referralCount: 5,
      lifetimePnL: '1500.00',
      totalDeposited: '10000.00',
      isActor: false,
      isTest: true,
      updatedAt: new Date(),
    })
  })

  afterAll(async () => {
    // Clean up test user
    await db.delete(users).where(eq(users.id, testUserId))
  })

  describe('Token Constants', () => {
    it('should have correct token configuration', () => {
      expect(TOKEN_SYMBOL).toBe('BBLN')
      expect(TOKEN_DECIMALS).toBe(18)
      expect(AIRDROP_DAILY_DRIP_PERCENT).toBe(5)
      expect(AIRDROP_TOTAL_DRIP_DAYS).toBe(20)
    })

    it('should have 100% drip over 20 days', () => {
      const totalDripPercent =
        AIRDROP_DAILY_DRIP_PERCENT * AIRDROP_TOTAL_DRIP_DAYS
      expect(totalDripPercent).toBe(100)
    })
  })

  describe('Airdrop Allocation Calculation', () => {
    it('should calculate allocation for a user with points', async () => {
      const allocation = await calculateAirdropAllocation(testUserId)

      expect(allocation).not.toBeNull()
      expect(allocation?.userId).toBe(testUserId)
      expect(allocation?.pointsBalance).toBe(10000)
      expect(allocation?.referralCount).toBe(5)
      expect(allocation?.bonusMultiplier).toBe(100) // 1x (no ELIZA bonus in test)
      expect(allocation?.finalAllocation).toBeGreaterThan(0n)
      expect(allocation?.dailyDripAmount).toBeGreaterThan(0n)
    })

    it('should return null for non-existent user', async () => {
      const allocation = await calculateAirdropAllocation('nonexistent')
      expect(allocation).toBeNull()
    })

    it('should calculate daily drip as 5% of total allocation', async () => {
      const allocation = await calculateAirdropAllocation(testUserId)

      if (allocation) {
        const expectedDrip =
          (allocation.finalAllocation * BigInt(AIRDROP_DAILY_DRIP_PERCENT)) /
          100n
        expect(allocation.dailyDripAmount).toBe(expectedDrip)
      }
    })
  })

  describe('Token Formatting', () => {
    it('should format tokens correctly', () => {
      // Test whole numbers
      const whole = formatTokens(1000n * 10n ** BigInt(TOKEN_DECIMALS))
      expect(whole).toBe(`1,000 ${TOKEN_SYMBOL}`)

      // Test with decimals
      const decimals = formatTokens(1500500000000000000000n) // 1500.5 tokens
      expect(decimals).toContain(TOKEN_SYMBOL)
    })

    it('should parse tokens correctly', () => {
      const parsed = parseTokens('1000')
      expect(parsed).toBe(1000n * 10n ** BigInt(TOKEN_DECIMALS))

      const parsedDecimals = parseTokens('1000.5')
      expect(parsedDecimals).toBeGreaterThan(
        1000n * 10n ** BigInt(TOKEN_DECIMALS),
      )
    })

    it('should round-trip format and parse', () => {
      const original = 1234567890000000000000n // ~1234.57 tokens
      const formatted = formatTokens(original)

      // Parse just the numeric part
      const numericPart = formatted
        .replace(` ${TOKEN_SYMBOL}`, '')
        .replace(/,/g, '')
      const parsed = parseTokens(numericPart)

      // Should be close (may differ due to decimal truncation)
      expect(Number(parsed) / Number(original)).toBeCloseTo(1, 2)
    })
  })

  describe('Points to Token Display', () => {
    it('should convert points to display format', async () => {
      const display = await pointsToDisplayTokens(10000)
      expect(display).toContain(TOKEN_SYMBOL)
    })
  })

  describe('Merkle Data Generation', () => {
    it('should generate merkle data for eligible users', async () => {
      const merkleData = await generateAirdropMerkleData()

      // Should be an array
      expect(Array.isArray(merkleData)).toBe(true)

      // Each entry should have required fields
      for (const entry of merkleData) {
        expect(entry).toHaveProperty('address')
        expect(entry).toHaveProperty('allocation')
        expect(entry).toHaveProperty('bonus')
        expect(typeof entry.address).toBe('string')
        expect(typeof entry.allocation).toBe('bigint')
        expect(typeof entry.bonus).toBe('number')
      }
    })
  })
})
