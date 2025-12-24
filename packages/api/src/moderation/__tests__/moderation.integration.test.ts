/**
 * Moderation Integration Tests
 *
 * Tests the integration between Babylon and Jeju's moderation system.
 * Requires BanManager and ModerationMarketplace contracts to be deployed.
 *
 * @group integration
 */

import { describe, expect, it } from 'bun:test'
import type { Address } from 'viem'
import { BanType, checkBabylonAccess } from '../ban-manager-client'
import {
  checkBanStatus,
  clearBanCache,
  isBanManagerConfigured,
} from '../ban-middleware'
import {
  BanStatus,
  ModerationMarketplaceClient,
} from '../moderation-marketplace-client'

// Test addresses (Hardhat default accounts)
const TEST_USER_ADDRESS =
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address

describe('Moderation Integration', () => {
  describe('BanManager Configuration', () => {
    it('should detect if BanManager is configured', () => {
      const configured = isBanManagerConfigured()
      // In test environment, this depends on env vars
      expect(typeof configured).toBe('boolean')
    })

    it('should check ban status for address', async () => {
      // Skip if not configured
      if (!isBanManagerConfigured()) {
        console.log('BanManager not configured, skipping')
        return
      }

      const result = await checkBanStatus(TEST_USER_ADDRESS)
      expect(result).toHaveProperty('allowed')
    })
  })

  describe('Ban Cache', () => {
    it('should cache ban status', async () => {
      // Skip if not configured
      if (!isBanManagerConfigured()) {
        console.log('BanManager not configured, skipping')
        return
      }

      // First call
      const result1 = await checkBanStatus(TEST_USER_ADDRESS)

      // Second call should be cached
      const result2 = await checkBanStatus(TEST_USER_ADDRESS)

      expect(result1.allowed).toBe(result2.allowed)
    })

    it('should clear ban cache', async () => {
      clearBanCache(TEST_USER_ADDRESS)
      // Should not throw
    })
  })

  describe('BanType Enum', () => {
    it('should have correct ban types', () => {
      expect(BanType.NONE).toBe(0)
      expect(BanType.ON_NOTICE).toBe(1)
      expect(BanType.CHALLENGED).toBe(2)
      expect(BanType.PERMANENT).toBe(3)
    })
  })

  describe('BanStatus Enum', () => {
    it('should have correct ban statuses', () => {
      expect(BanStatus.NONE).toBe(0)
      expect(BanStatus.ON_NOTICE).toBe(1)
      expect(BanStatus.CHALLENGED).toBe(2)
      expect(BanStatus.BANNED).toBe(3)
      expect(BanStatus.CLEARED).toBe(4)
      expect(BanStatus.APPEALING).toBe(5)
    })
  })
})

describe('Moderation Marketplace', () => {
  describe('Configuration', () => {
    it('should require MODERATION_MARKETPLACE_ADDRESS', () => {
      const originalEnv = process.env.MODERATION_MARKETPLACE_ADDRESS
      delete process.env.MODERATION_MARKETPLACE_ADDRESS

      expect(() => new ModerationMarketplaceClient()).toThrow(
        /MODERATION_MARKETPLACE_ADDRESS not configured/,
      )

      // Restore
      if (originalEnv) {
        process.env.MODERATION_MARKETPLACE_ADDRESS = originalEnv
      }
    })
  })

  describe('API Methods', () => {
    // Skip these tests if contracts are not deployed
    const skipIfNotConfigured = () => {
      if (!process.env.MODERATION_MARKETPLACE_ADDRESS) {
        console.log('ModerationMarketplace not configured, skipping')
        return true
      }
      return false
    }

    it('should get min stake', async () => {
      if (skipIfNotConfigured()) return

      const client = new ModerationMarketplaceClient()
      const minStake = await client.getMinStake()
      expect(typeof minStake).toBe('bigint')
    })

    it('should check if user is staked', async () => {
      if (skipIfNotConfigured()) return

      const client = new ModerationMarketplaceClient()
      const isStaked = await client.isStaked(TEST_USER_ADDRESS)
      expect(typeof isStaked).toBe('boolean')
    })

    it('should get voting power', async () => {
      if (skipIfNotConfigured()) return

      const client = new ModerationMarketplaceClient()
      const votingPower = await client.getVotingPower(TEST_USER_ADDRESS)
      expect(typeof votingPower).toBe('bigint')
    })
  })
})

describe('Access Control Flow', () => {
  it('should allow access for non-banned users', async () => {
    // When BanManager is not configured, access is allowed by default
    if (!isBanManagerConfigured()) {
      // Without contract, this would throw, so we just verify the function exists
      expect(checkBabylonAccess).toBeDefined()
      return
    }

    const result = await checkBabylonAccess(TEST_USER_ADDRESS)
    expect(result).toHaveProperty('allowed')
  })

  it('should provide ban details when banned', async () => {
    if (!isBanManagerConfigured()) {
      console.log('BanManager not configured, skipping')
      return
    }

    // This test would require a banned address to verify
    // In a real test, we'd deploy contracts and ban a test user
    const result = await checkBabylonAccess(TEST_USER_ADDRESS)
    if (!result.allowed) {
      expect(result).toHaveProperty('reason')
      expect(result).toHaveProperty('bannedAt')
    }
  })
})
