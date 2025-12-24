/**
 * MPC Client Tests
 *
 * Tests for the MPC network client via @jejunetwork/kms.
 * MPC-dependent integration tests are skipped unless network is available.
 */

import { describe, expect, it } from 'bun:test'
import {
  getMPCCoordinator,
  MPCCoordinator,
  resetMPCCoordinator,
} from '@jejunetwork/kms'

describe('MPC Coordinator (from @jejunetwork/kms)', () => {
  describe('coordinator creation', () => {
    it('should create coordinator with default config', () => {
      resetMPCCoordinator()
      const coordinator = getMPCCoordinator()
      expect(coordinator).toBeInstanceOf(MPCCoordinator)
    })

    it('should create coordinator with custom config', () => {
      resetMPCCoordinator()
      const coordinator = getMPCCoordinator({
        network: 'testnet',
        threshold: 2,
        sessionTimeout: 60000,
      })
      expect(coordinator).toBeInstanceOf(MPCCoordinator)
    })

    it('should return singleton instance', () => {
      resetMPCCoordinator()
      const coordinator1 = getMPCCoordinator()
      const coordinator2 = getMPCCoordinator()
      expect(coordinator1).toBe(coordinator2)
    })
  })

  describe('getActiveParties', () => {
    it('should return empty array before parties registered', () => {
      resetMPCCoordinator()
      const coordinator = getMPCCoordinator()
      const activeParties = coordinator.getActiveParties()
      expect(activeParties).toEqual([])
    })
  })

  describe('coordinator behavior', () => {
    it('should work in localnet mode', () => {
      resetMPCCoordinator()
      const coordinator = getMPCCoordinator({ network: 'localnet' })
      const status = coordinator.getStatus()
      expect(status.config.network).toBe('localnet')
    })
  })

  describe('signing session types', () => {
    it('should have valid session statuses', () => {
      const statuses: Array<
        'pending' | 'signing' | 'complete' | 'failed' | 'expired'
      > = ['pending', 'signing', 'complete', 'failed', 'expired']
      expect(statuses).toHaveLength(5)
    })
  })

  describe('config validation', () => {
    it('should handle localnet config', () => {
      resetMPCCoordinator()
      const coordinator = getMPCCoordinator({ network: 'localnet' })
      expect(coordinator).toBeInstanceOf(MPCCoordinator)
    })

    it('should handle testnet config', () => {
      resetMPCCoordinator()
      const coordinator = getMPCCoordinator({ network: 'testnet' })
      expect(coordinator).toBeInstanceOf(MPCCoordinator)
    })

    it('should handle mainnet config', () => {
      resetMPCCoordinator()
      const coordinator = getMPCCoordinator({ network: 'mainnet' })
      expect(coordinator).toBeInstanceOf(MPCCoordinator)
    })

    it('should handle custom session timeout', () => {
      resetMPCCoordinator()
      const coordinator = getMPCCoordinator({
        sessionTimeout: 600000,
      })
      expect(coordinator).toBeInstanceOf(MPCCoordinator)
    })
  })

  describe('status structure', () => {
    it('should return correct status structure', () => {
      resetMPCCoordinator()
      const coordinator = getMPCCoordinator({ network: 'localnet' })
      const status = coordinator.getStatus()

      expect(status).toHaveProperty('activeParties')
      expect(status).toHaveProperty('totalKeys')
      expect(status).toHaveProperty('activeSessions')
      expect(status).toHaveProperty('config')

      expect(typeof status.activeParties).toBe('number')
      expect(typeof status.totalKeys).toBe('number')
      expect(typeof status.activeSessions).toBe('number')
      expect(typeof status.config).toBe('object')
    })
  })

  /**
   * Key generation tests using the MPC Coordinator.
   */
  describe('key generation', () => {
    it('should generate key with registered parties', async () => {
      resetMPCCoordinator()
      const coordinator = getMPCCoordinator({ network: 'localnet' })

      // Register parties
      const partyIds = ['party-1', 'party-2', 'party-3']
      for (let i = 0; i < partyIds.length; i++) {
        coordinator.registerParty({
          id: partyIds[i],
          index: i + 1,
          endpoint: 'http://localhost:4010',
          publicKey: '0x' as `0x${string}`,
          address: '0x' as `0x${string}`,
          stake: 0n,
          registeredAt: Date.now(),
        })
      }

      const result = await coordinator.generateKey({
        keyId: 'test-key-1',
        threshold: 2,
        totalParties: 3,
        partyIds,
        curve: 'secp256k1',
      })

      expect(result.keyId).toBe('test-key-1')
      expect(result.publicKey).toBeDefined()
      expect(result.address).toBeDefined()
      expect(result.threshold).toBe(2)
    })
  })
})

describe('MPC Coordinator Error Handling', () => {
  describe('key generation errors', () => {
    it('should throw when threshold is less than 2', async () => {
      resetMPCCoordinator()
      const coordinator = getMPCCoordinator({ network: 'localnet' })

      await expect(
        coordinator.generateKey({
          keyId: 'test-key',
          threshold: 1,
          totalParties: 3,
          partyIds: ['party-1', 'party-2', 'party-3'],
          curve: 'secp256k1',
        }),
      ).rejects.toThrow(/Threshold must be at least 2/)
    })

    it('should throw when key already exists', async () => {
      resetMPCCoordinator()
      const coordinator = getMPCCoordinator({ network: 'localnet' })

      const partyIds = ['party-1', 'party-2', 'party-3']
      for (let i = 0; i < partyIds.length; i++) {
        coordinator.registerParty({
          id: partyIds[i],
          index: i + 1,
          endpoint: 'http://localhost:4010',
          publicKey: '0x' as `0x${string}`,
          address: '0x' as `0x${string}`,
          stake: 0n,
          registeredAt: Date.now(),
        })
      }

      await coordinator.generateKey({
        keyId: 'duplicate-key',
        threshold: 2,
        totalParties: 3,
        partyIds,
        curve: 'secp256k1',
      })

      await expect(
        coordinator.generateKey({
          keyId: 'duplicate-key',
          threshold: 2,
          totalParties: 3,
          partyIds,
          curve: 'secp256k1',
        }),
      ).rejects.toThrow(/already exists/)
    })
  })

  describe('party registration', () => {
    it('should register parties correctly', () => {
      resetMPCCoordinator()
      const coordinator = getMPCCoordinator({ network: 'localnet' })

      const party = coordinator.registerParty({
        id: 'test-party',
        index: 1,
        endpoint: 'http://localhost:4010',
        publicKey: '0x' as `0x${string}`,
        address: '0x' as `0x${string}`,
        stake: 0n,
        registeredAt: Date.now(),
      })

      expect(party.id).toBe('test-party')
      expect(party.status).toBe('active')
    })
  })
})
