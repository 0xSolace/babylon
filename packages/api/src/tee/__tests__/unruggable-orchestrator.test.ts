/**
 * Unruggable Orchestrator Tests
 *
 * Tests for the game orchestrator that coordinates all unruggable components.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { Address, Hex } from 'viem'
import {
  createUnruggableOrchestrator,
  UnruggableOrchestrator,
  type UnruggableOrchestratorConfig,
} from '../unruggable-orchestrator'

describe('UnruggableOrchestrator', () => {
  let orchestrator: UnruggableOrchestrator
  const testConfig: Partial<UnruggableOrchestratorConfig> = {
    enclave: {
      codeHash:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
      instanceId: 'orchestrator-test-1',
      treasuryAddress: '0x0000000000000000000000000000000000000001' as Address,
      rpcUrl: 'http://localhost:6546',
      verbose: false,
    },
    heartbeat: {
      intervalMs: 100,
      onChainIntervalMs: 1000,
    },
    training: {
      intervalMs: 10000,
      enabled: false, // Disable for faster tests
    },
  }

  beforeEach(() => {
    orchestrator = createUnruggableOrchestrator(testConfig)
  })

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown()
    }
  })

  describe('initialize', () => {
    it('should boot enclave and register operator', async () => {
      const { operatorAddress, attestation } = await orchestrator.initialize()

      expect(operatorAddress).toMatch(/^0x[0-9a-f]{40}$/i)
      expect(attestation).toBeDefined()
      expect(attestation.platform).toBe('simulated')
    })

    it('should transition through phases', async () => {
      const statusBefore = await orchestrator.getStatus()
      expect(statusBefore.phase).toBe('uninitialized')

      await orchestrator.initialize()

      const statusAfter = await orchestrator.getStatus()
      expect(statusAfter.phase).toBe('running')
    })

    it('should create initial game state', async () => {
      await orchestrator.initialize()

      const status = await orchestrator.getStatus()
      expect(status.game.version).toBeGreaterThan(0)
      expect(status.game.tick).toBe(0)
    })
  })

  describe('executeTick', () => {
    it('should increment game tick', async () => {
      await orchestrator.initialize()

      const statusBefore = await orchestrator.getStatus()
      await orchestrator.executeTick()
      const statusAfter = await orchestrator.getStatus()

      expect(statusAfter.game.tick).toBe(statusBefore.game.tick + 1)
    })

    it('should throw if not running', async () => {
      await expect(orchestrator.executeTick()).rejects.toThrow(
        'Cannot execute tick in phase: uninitialized',
      )
    })
  })

  describe('runTrainingCycle', () => {
    it('should increment epoch and produce dataset CID', async () => {
      await orchestrator.initialize()

      const statusBefore = await orchestrator.getStatus()
      const result = await orchestrator.runTrainingCycle()
      const statusAfter = await orchestrator.getStatus()

      expect(result.epoch).toBe(statusBefore.training.epoch + 1)
      expect(result.datasetCID).toMatch(/^Qm/)
      expect(result.modelHash).toMatch(/^0x/)
      expect(statusAfter.training.epoch).toBe(result.epoch)
    })

    it('should update last training timestamp', async () => {
      await orchestrator.initialize()

      const statusBefore = await orchestrator.getStatus()
      expect(statusBefore.training.lastTrainingAt).toBe(0)

      await orchestrator.runTrainingCycle()

      const statusAfter = await orchestrator.getStatus()
      expect(statusAfter.training.lastTrainingAt).toBeGreaterThan(0)
    })
  })

  describe('rotateKeys', () => {
    it('should increment key version', async () => {
      await orchestrator.initialize()

      const result = await orchestrator.rotateKeys()

      expect(result.newKeyVersion).toBeGreaterThan(0)
      expect(result.newStateCID).toMatch(/^Qm/)
    })

    it('should return to running phase after rotation', async () => {
      await orchestrator.initialize()

      await orchestrator.rotateKeys()

      const status = await orchestrator.getStatus()
      expect(status.phase).toBe('running')
    })
  })

  describe('getStatus', () => {
    it('should return comprehensive status', async () => {
      await orchestrator.initialize()

      const status = await orchestrator.getStatus()

      expect(status.phase).toBe('running')
      expect(status.enclave.running).toBe(true)
      expect(status.enclave.address).not.toBeNull()
      expect(status.enclave.attestationValid).toBe(true)
      expect(status.game.version).toBeGreaterThan(0)
      expect(status.storage.stateCount).toBeGreaterThan(0)
    })
  })

  describe('shutdown', () => {
    it('should save final state and stop', async () => {
      await orchestrator.initialize()

      const statusBefore = await orchestrator.getStatus()
      expect(statusBefore.phase).toBe('running')

      await orchestrator.shutdown()

      const statusAfter = await orchestrator.getStatus()
      expect(statusAfter.phase).toBe('shutdown')
    })
  })
})

describe('createUnruggableOrchestrator', () => {
  it('should create orchestrator with default config', async () => {
    const orchestrator = createUnruggableOrchestrator()

    expect(orchestrator).toBeInstanceOf(UnruggableOrchestrator)
    const status = await orchestrator.getStatus()
    expect(status.phase).toBe('uninitialized')
  })

  it('should merge provided config with defaults', () => {
    const orchestrator = createUnruggableOrchestrator({
      heartbeat: {
        intervalMs: 999,
        onChainIntervalMs: 9999,
      },
    })

    // Just verify it doesn't throw
    expect(orchestrator).toBeDefined()
  })
})
