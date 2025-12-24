/**
 * Babylon Enclave Tests
 *
 * Tests for the TEE enclave that provides unruggable game execution.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { Address, Hex } from 'viem'
import {
  BabylonEnclave,
  type BabylonEnclaveConfig,
  type SealedState,
} from '../babylon-enclave'

describe('BabylonEnclave', () => {
  let enclave: BabylonEnclave
  const testConfig: BabylonEnclaveConfig = {
    codeHash:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
    instanceId: 'test-instance-1',
    treasuryAddress: '0x0000000000000000000000000000000000000001' as Address,
    rpcUrl: 'http://localhost:6546',
    verbose: false,
  }

  beforeEach(async () => {
    enclave = await BabylonEnclave.create(testConfig)
  })

  afterEach(async () => {
    if (enclave) {
      await enclave.shutdown()
    }
  })

  describe('create', () => {
    it('should create and boot enclave', async () => {
      const status = enclave.getStatus()
      expect(status.running).toBe(true)
      expect(status.address).not.toBeNull()
    })

    it('should generate valid operator address', () => {
      const address = enclave.getOperatorAddress()
      expect(address).toMatch(/^0x[0-9a-f]{40}$/i)
    })

    it('should generate attestation quote', () => {
      const attestation = enclave.getAttestation()
      expect(attestation).toBeDefined()
      expect(attestation.measurement).toBeDefined()
      expect(attestation.operatorAddress).toBe(enclave.getOperatorAddress())
      expect(attestation.cpuSignature).toBeDefined()
    })
  })

  describe('sealState', () => {
    it('should encrypt state', async () => {
      const state = { version: 1, data: 'test' }
      const sealed = await enclave.sealState(state)

      expect(sealed.ciphertext).toBeDefined()
      expect(sealed.iv).toBeDefined()
      expect(sealed.keyVersion).toBe(1)
      expect(sealed.sealedAt).toBeGreaterThan(0)
    })

    it('should produce different ciphertext for same state', async () => {
      const state = { version: 1, data: 'test' }

      const sealed1 = await enclave.sealState(state)
      const sealed2 = await enclave.sealState(state)

      // IVs should be different (random)
      expect(sealed1.iv).not.toBe(sealed2.iv)
      // Ciphertexts should be different
      expect(sealed1.ciphertext).not.toBe(sealed2.ciphertext)
    })
  })

  describe('unsealState', () => {
    it('should decrypt sealed state', async () => {
      const originalState = { version: 1, data: 'test', nested: { a: 1 } }
      const sealed = await enclave.sealState(originalState)
      const unsealed = await enclave.unsealState<typeof originalState>(sealed)

      expect(unsealed).toEqual(originalState)
    })

    it('should fail with wrong key version', async () => {
      const state = { version: 1 }
      const sealed = await enclave.sealState(state)

      // Tamper with key version
      const tamperedSealed: SealedState = { ...sealed, keyVersion: 999 }

      await expect(enclave.unsealState(tamperedSealed)).rejects.toThrow(
        'Key version mismatch',
      )
    })
  })

  describe('rotateKey', () => {
    it('should increment key version', async () => {
      const statusBefore = enclave.getStatus()
      const { oldVersion, newVersion } = await enclave.rotateKey()

      expect(oldVersion).toBe(statusBefore.keyVersion)
      expect(newVersion).toBe(oldVersion + 1)

      const statusAfter = enclave.getStatus()
      expect(statusAfter.keyVersion).toBe(newVersion)
    })

    it('should allow re-encrypting state after rotation', async () => {
      const state = { version: 1, data: 'secret' }

      // Seal with original key
      const sealed1 = await enclave.sealState(state)
      expect(sealed1.keyVersion).toBe(1)

      // Rotate key
      await enclave.rotateKey()

      // Seal with new key
      const sealed2 = await enclave.sealState(state)
      expect(sealed2.keyVersion).toBe(2)

      // Should be able to unseal the new one
      const unsealed = await enclave.unsealState(sealed2)
      expect(unsealed).toEqual(state)

      // Cannot unseal old one with new key (version mismatch)
      await expect(enclave.unsealState(sealed1)).rejects.toThrow(
        'Key version mismatch',
      )
    })
  })

  describe('generateHeartbeat', () => {
    it('should generate valid heartbeat', async () => {
      // First seal some state
      await enclave.sealState({ version: 1 })

      const heartbeat = enclave.generateHeartbeat()

      expect(heartbeat.timestamp).toBeGreaterThan(0)
      expect(heartbeat.signature).toMatch(/^0x[0-9a-f]+$/i)
      expect(heartbeat.stateHash).toMatch(/^0x[0-9a-f]+$/i)
    })

    it('should update last heartbeat time', () => {
      const statusBefore = enclave.getStatus()
      const heartbeat = enclave.generateHeartbeat()
      const statusAfter = enclave.getStatus()

      expect(statusAfter.lastHeartbeat).toBe(heartbeat.timestamp)
      expect(statusAfter.lastHeartbeat).toBeGreaterThanOrEqual(
        statusBefore.lastHeartbeat,
      )
    })
  })

  describe('shutdown', () => {
    it('should mark enclave as not running', async () => {
      expect(enclave.getStatus().running).toBe(true)

      await enclave.shutdown()

      expect(enclave.getStatus().running).toBe(false)
    })

    it('should throw on operations after shutdown', async () => {
      await enclave.shutdown()

      expect(() => enclave.getOperatorAddress()).toThrow(
        'Enclave is not running',
      )
      await expect(enclave.sealState({ version: 1 })).rejects.toThrow(
        'Enclave is not running',
      )
    })
  })
})

describe('Attestation', () => {
  it('should include all required fields', async () => {
    const config: BabylonEnclaveConfig = {
      codeHash: `0xabcdef${'0'.repeat(58)}` as Hex,
      instanceId: 'attestation-test',
      treasuryAddress: `0x${'0'.repeat(40)}` as Address,
      rpcUrl: 'http://localhost:6546',
    }

    const enclave = await BabylonEnclave.create(config)
    const attestation = enclave.getAttestation()

    expect(attestation.measurement).toBeDefined()
    expect(attestation.platform).toBe('simulated')
    expect(attestation.operatorAddress).toBe(enclave.getOperatorAddress())
    expect(attestation.cpuSignature).toBeDefined()
    expect(attestation.timestamp).toBeGreaterThan(0)
    expect(attestation.reportData).toBeDefined()

    await enclave.shutdown()
  })
})
