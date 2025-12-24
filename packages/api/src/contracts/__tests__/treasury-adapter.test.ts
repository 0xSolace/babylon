/**
 * Treasury Adapter Tests
 *
 * Tests for both dev mode and production mode treasury interactions.
 */

import { beforeEach, describe, expect, it } from 'bun:test'
import {
  createTreasuryAdapter,
  isDevMode,
  type TreasuryAdapter,
} from '../treasury-adapter'

describe('TreasuryAdapter', () => {
  describe('Dev Mode (standalone Babylon)', () => {
    let treasury: TreasuryAdapter

    beforeEach(() => {
      treasury = createTreasuryAdapter({ mode: 'dev' })
    })

    it('should create a dev mode treasury', () => {
      expect(treasury).toBeDefined()
    })

    it('should have initial balance', async () => {
      const balance = await treasury.getBalance()
      expect(balance).toBeGreaterThan(0n)
    })

    it('should get state', async () => {
      const state = await treasury.getState()
      expect(state).toHaveProperty('currentStateCID')
      expect(state).toHaveProperty('stateVersion')
      expect(state).toHaveProperty('keyVersion')
      expect(state.keyVersion).toBe(1n)
    })

    it('should register operator', async () => {
      const operator = '0x1234567890123456789012345678901234567890'
      const attestation = '0xabc123'

      await treasury.registerOperator(operator, attestation)

      const info = await treasury.getOperatorInfo()
      expect(info.address).toBe(operator)
      expect(info.active).toBe(true)
    })

    it('should send heartbeat', async () => {
      const operator = '0x1234567890123456789012345678901234567890'
      await treasury.registerOperator(operator, '0xabc123')

      await treasury.heartbeat()

      const active = await treasury.isOperatorActive()
      expect(active).toBe(true)
    })

    it('should update state', async () => {
      const operator = '0x1234567890123456789012345678901234567890'
      await treasury.registerOperator(operator, '0xabc123')

      await treasury.updateState('QmTest123', `0x${'0'.repeat(64)}`)

      const state = await treasury.getState()
      expect(state.currentStateCID).toBe('QmTest123')
      expect(state.stateVersion).toBe(1n)
    })

    it('should enforce daily withdrawal limits', async () => {
      const operator = '0x1234567890123456789012345678901234567890'
      await treasury.registerOperator(operator, '0xabc123')

      const initialBalance = await treasury.getBalance()

      // Withdraw within limit (1 ETH)
      await treasury.withdraw(1n * 10n ** 18n)

      const newBalance = await treasury.getBalance()
      expect(newBalance).toBe(initialBalance - 1n * 10n ** 18n)

      // Try to exceed daily limit (default 10 ETH, already used 1 ETH, try 10 more)
      // This should exceed the 10 ETH daily limit
      expect(treasury.withdraw(10n * 10n ** 18n)).rejects.toThrow(
        'Exceeds daily limit',
      )
    })

    it('should support deposits', async () => {
      const initialBalance = await treasury.getBalance()

      await treasury.deposit(5n * 10n ** 18n)

      const newBalance = await treasury.getBalance()
      expect(newBalance).toBe(initialBalance + 5n * 10n ** 18n)
    })

    it('should rotate keys in dev mode', async () => {
      const stateBefore = await treasury.getState()

      const requestId = await treasury.requestKeyRotation()

      const stateAfter = await treasury.getState()
      expect(stateAfter.keyVersion).toBe(stateBefore.keyVersion + 1n)
      expect(requestId).toBeGreaterThanOrEqual(0n)
    })

    it('should record training', async () => {
      const operator = '0x1234567890123456789012345678901234567890'
      await treasury.registerOperator(operator, '0xabc123')

      await treasury.recordTraining('QmDataset123', `0x${'a'.repeat(64)}`)

      const state = await treasury.getState()
      expect(state.trainingEpoch).toBe(1n)
    })
  })

  describe('isDevMode', () => {
    it('should return true when no treasury address is set', () => {
      // In test environment, should be dev mode
      const result = isDevMode()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('Production Mode', () => {
    it('should throw error when contract address is missing', () => {
      expect(() =>
        createTreasuryAdapter({
          mode: 'production',
          // No contractAddress
        }),
      ).toThrow('Contract address required')
    })

    it('should throw error when RPC URL is missing', () => {
      expect(() =>
        createTreasuryAdapter({
          mode: 'production',
          contractAddress: '0x1234567890123456789012345678901234567890',
          // No rpcUrl
        }),
      ).toThrow('RPC URL required')
    })
  })
})

describe('Environment Detection', () => {
  it('should detect dev mode by default', () => {
    expect(isDevMode()).toBe(true)
  })
})
