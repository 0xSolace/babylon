/**
 * BabylonEnclave Integration Tests
 *
 * Tests real encryption/decryption without mocks.
 * Verifies the simulated TEE actually encrypts and decrypts data.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { Address, Hex } from 'viem'
import { BabylonEnclave, type BabylonEnclaveConfig } from '../babylon-enclave'

describe('BabylonEnclave Integration', () => {
  let enclave: BabylonEnclave

  const config: BabylonEnclaveConfig = {
    codeHash: `0xabcdef${'0'.repeat(58)}` as Hex,
    instanceId: 'integration-test-instance',
    treasuryAddress: '0x1234567890123456789012345678901234567890' as Address,
    rpcUrl: 'http://localhost:6546',
    verbose: false,
  }

  beforeEach(async () => {
    enclave = await BabylonEnclave.create(config)
  })

  afterEach(async () => {
    await enclave.shutdown()
  })

  describe('real encryption roundtrip', () => {
    it('encrypts and decrypts game state', async () => {
      const gameState = {
        tick: 12345,
        players: [
          {
            id: 1,
            balance: 1000000,
            positions: [{ market: 'BTC', size: 100 }],
          },
          { id: 2, balance: 500000, positions: [] },
        ],
        markets: {
          BTC: { price: 50000, volume: 1000 },
          ETH: { price: 3000, volume: 500 },
        },
        timestamp: Date.now(),
      }

      const sealed = await enclave.sealState(gameState)

      // Verify sealed data is different from original
      expect(sealed.ciphertext).not.toContain('tick')
      expect(sealed.ciphertext).not.toContain('12345')

      // Verify we can recover the original
      const recovered = await enclave.unsealState<typeof gameState>(sealed)
      expect(recovered).toEqual(gameState)
    })

    it('handles large state objects', async () => {
      const largeState = {
        data: 'x'.repeat(100000),
        array: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: Math.random(),
        })),
      }

      const sealed = await enclave.sealState(largeState)
      const recovered = await enclave.unsealState<typeof largeState>(sealed)

      expect(recovered.data.length).toBe(100000)
      expect(recovered.array.length).toBe(1000)
    })

    it('handles unicode and special characters', async () => {
      const state = {
        unicode: '🎮 游戏 العربية',
        special: '<script>alert("xss")</script>',
        json: '{"nested": "value"}',
        newlines: 'line1\nline2\r\nline3',
      }

      const sealed = await enclave.sealState(state)
      const recovered = await enclave.unsealState<typeof state>(sealed)
      expect(recovered).toEqual(state)
    })

    it('produces unique ciphertext for same input', async () => {
      const state = { value: 'test' }

      const sealed1 = await enclave.sealState(state)
      const sealed2 = await enclave.sealState(state)

      // IVs should be different (random)
      expect(sealed1.iv).not.toBe(sealed2.iv)
      // Ciphertext should be different
      expect(sealed1.ciphertext).not.toBe(sealed2.ciphertext)

      // But both should decrypt to same value
      const recovered1 = await enclave.unsealState<typeof state>(sealed1)
      const recovered2 = await enclave.unsealState<typeof state>(sealed2)
      expect(recovered1).toEqual(recovered2)
    })
  })

  describe('key rotation', () => {
    it('rotates key and invalidates old sealed data', async () => {
      const state = { secret: 'classified' }
      const sealedV1 = await enclave.sealState(state)
      expect(sealedV1.keyVersion).toBe(1)

      // Rotate key
      const { newVersion } = await enclave.rotateKey()
      expect(newVersion).toBe(2)

      // New sealed data uses new key
      const sealedV2 = await enclave.sealState(state)
      expect(sealedV2.keyVersion).toBe(2)

      // Can decrypt new data
      const recovered = await enclave.unsealState<typeof state>(sealedV2)
      expect(recovered).toEqual(state)

      // Cannot decrypt old data with new key
      await expect(enclave.unsealState(sealedV1)).rejects.toThrow(
        'Key version mismatch',
      )
    })
  })

  describe('attestation', () => {
    it('generates consistent attestation', () => {
      const att1 = enclave.getAttestation()
      const att2 = enclave.getAttestation()

      expect(att1.measurement).toBe(att2.measurement)
      expect(att1.operatorAddress).toBe(att2.operatorAddress)
      expect(att1.platform).toBe('simulated')
    })

    it('derives operator address from measurement', () => {
      const att = enclave.getAttestation()
      const addr = enclave.getOperatorAddress()

      expect(att.operatorAddress).toBe(addr)
      expect(addr).toMatch(/^0x[0-9a-f]{40}$/i)
    })
  })

  describe('heartbeat', () => {
    it('generates heartbeat with state hash', async () => {
      await enclave.sealState({ tick: 1 })

      const hb1 = enclave.generateHeartbeat()
      expect(hb1.stateHash).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(hb1.signature).toMatch(/^0x[0-9a-f]{64}$/i)

      // Sealing new state changes the hash
      await enclave.sealState({ tick: 2 })
      const hb2 = enclave.generateHeartbeat()
      expect(hb2.stateHash).not.toBe(hb1.stateHash)
    })
  })

  describe('error cases', () => {
    it('fails on tampered ciphertext', async () => {
      const sealed = await enclave.sealState({ value: 1 })

      // Tamper with ciphertext
      const tamperedSealed = {
        ...sealed,
        ciphertext: `${sealed.ciphertext.slice(0, -4)}XXXX`,
      }

      await expect(enclave.unsealState(tamperedSealed)).rejects.toThrow()
    })

    it('fails on tampered IV', async () => {
      const sealed = await enclave.sealState({ value: 1 })

      const tamperedSealed = {
        ...sealed,
        iv: 'YWJjZGVmZ2hpams=', // Different IV
      }

      await expect(enclave.unsealState(tamperedSealed)).rejects.toThrow()
    })
  })
})
