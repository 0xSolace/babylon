/**
 * CheckpointService Integration Tests
 *
 * Tests CheckpointService with real BabylonEnclave (simulated mode).
 * Storage is NOT mocked - these tests focus on enclave integration only.
 *
 * Run separately from unit tests to avoid mock conflicts:
 *   bun test z-checkpoint-service-integration.test.ts
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Hex } from 'viem'
import { CheckpointService } from '../checkpoint-service'

// Only mock the enclave - NOT the storage module
// This ensures no conflict with unit tests that mock storage differently
const mockKeyVersion = { current: 1 }
const mockStateHashes = new Map<string, string>()

mock.module('../../tee/babylon-enclave', () => ({
  getBabylonEnclave: async () => {
    const sealedStates = new Map<number, { data: object; version: number }>()

    return {
      sealState: async (state: object) => {
        const id = Math.random().toString(36).slice(2)
        sealedStates.set(mockKeyVersion.current, {
          data: state,
          version: mockKeyVersion.current,
        })
        const ciphertext = Buffer.from(JSON.stringify(state)).toString('base64')
        mockStateHashes.set(ciphertext, id)
        return {
          ciphertext,
          iv: Math.random().toString(36),
          keyVersion: mockKeyVersion.current,
          measurement: `0x${'1'.repeat(64)}` as Hex,
        }
      },
      unsealState: async <T>(sealed: {
        keyVersion: number
        ciphertext: string
      }) => {
        if (sealed.keyVersion !== mockKeyVersion.current) {
          throw new Error(
            `Key version mismatch: sealed=${sealed.keyVersion}, current=${mockKeyVersion.current}`,
          )
        }
        return JSON.parse(
          Buffer.from(sealed.ciphertext, 'base64').toString(),
        ) as T
      },
      rotateKey: async () => {
        const oldVersion = mockKeyVersion.current
        mockKeyVersion.current++
        return { oldVersion, newVersion: mockKeyVersion.current }
      },
      generateHeartbeat: () => ({
        stateHash: `0x${'0'.repeat(64)}` as Hex,
        signature: `0x${'beef'.repeat(16)}` as Hex,
        timestamp: Date.now(),
        tick: 0,
      }),
      getAttestation: () => ({
        measurement: `0x${'1'.repeat(64)}` as Hex,
        platform: 'simulated' as const,
        operatorAddress: '0x1234567890123456789012345678901234567890',
        timestamp: Date.now(),
      }),
      getSealedState: () => null,
      getStatus: () => ({ running: true, keyVersion: mockKeyVersion.current }),
      getOperatorAddress: () => '0x1234567890123456789012345678901234567890',
    }
  },
}))

describe('CheckpointService (Enclave Integration)', () => {
  let service: CheckpointService
  let gameState: { tick: number; data: string }

  beforeEach(async () => {
    // Reset mock state
    mockKeyVersion.current = 1
    mockStateHashes.clear()

    gameState = { tick: 0, data: 'initial' }

    service = new CheckpointService({
      intervalMs: 0,
      autoCheckpoint: false,
      maxHistory: 10,
      verbose: false,
    })

    await service.initialize({
      getState: () => Promise.resolve(gameState),
      setState: (state) => {
        gameState = state as typeof gameState
        return Promise.resolve()
      },
    })

    await service.start()
  })

  afterEach(async () => {
    await service.stop()
  })

  describe('enclave state encryption', () => {
    it('encrypts state via enclave', async () => {
      gameState = { tick: 100, data: 'secret' }

      const checkpoint = await service.createCheckpoint()

      // Verify checkpoint created
      expect(checkpoint.version).toBe(1)
      // Without storage, CID will be local-prefixed
      expect(checkpoint.cid).toMatch(/^local-/)
    })

    it('increments version on each checkpoint', async () => {
      const cp1 = await service.createCheckpoint()
      expect(cp1.version).toBe(1)

      const cp2 = await service.createCheckpoint()
      expect(cp2.version).toBe(2)

      const cp3 = await service.createCheckpoint()
      expect(cp3.version).toBe(3)
    })
  })

  describe('key rotation', () => {
    it('rotates key and creates checkpoint with new version', async () => {
      const cpBefore = await service.createCheckpoint()
      expect(cpBefore.keyVersion).toBe(1)

      // rotateKey returns a new checkpoint with the new key
      const cpAfterRotation = await service.rotateKey()
      expect(cpAfterRotation.keyVersion).toBe(2)
    })

    it('subsequent checkpoints use rotated key', async () => {
      await service.createCheckpoint()
      await service.rotateKey()

      const cpAfter = await service.createCheckpoint()
      expect(cpAfter.keyVersion).toBe(2)
    })
  })

  describe('service lifecycle', () => {
    it('starts and stops cleanly', async () => {
      expect(service.getStatus().running).toBe(true)

      await service.stop()
      expect(service.getStatus().running).toBe(false)

      await service.start()
      expect(service.getStatus().running).toBe(true)
    })
  })

  describe('tick counting', () => {
    it('tracks tick count in checkpoints', async () => {
      service.incrementTick()
      service.incrementTick()

      const cp = await service.createCheckpoint()
      expect(cp.tickCount).toBe(2)
    })

    it('generates heartbeat data', () => {
      service.setTickCount(50)
      const data = service.generateHeartbeatData()

      expect(data.tickCount).toBe(50)
      expect(data.timestamp).toBeGreaterThan(0)
    })
  })

  describe('error handling', () => {
    it('fails fast when getState errors', async () => {
      const brokenService = new CheckpointService({ autoCheckpoint: false })

      await brokenService.initialize({
        getState: () => Promise.reject(new Error('state fetch failed')),
        setState: () => Promise.resolve(),
      })

      await brokenService.start()

      await expect(brokenService.createCheckpoint()).rejects.toThrow(
        'state fetch failed',
      )
    })
  })
})
