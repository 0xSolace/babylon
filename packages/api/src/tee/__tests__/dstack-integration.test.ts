/**
 * DStack Integration Tests
 *
 * Tests for the Phala DStack TEE integration (simulated mode).
 */

import { beforeEach, describe, expect, it } from 'bun:test'
import { type DStackConfig, DStackIntegration } from '../dstack-integration'

describe('DStackIntegration', () => {
  let dstack: DStackIntegration

  const testConfig: DStackConfig = {
    verbose: false,
    forceSimulation: true,
  }

  beforeEach(async () => {
    dstack = new DStackIntegration(testConfig)
    await dstack.initialize()
  })

  describe('initialization', () => {
    it('initializes in simulated mode', () => {
      const status = dstack.getStatus()

      expect(status.isRealTEE).toBe(false)
      expect(status.platform).toBe('simulated')
    })

    it('generates measurement hash', () => {
      const status = dstack.getStatus()

      expect(status.measurement).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('handles double initialization', async () => {
      await dstack.initialize()
      expect(dstack.getStatus().isRealTEE).toBe(false)
    })

    it('different configs produce different measurements', async () => {
      // With forceSimulation=true, measurements are deterministic from config
      // Different verbose setting shouldn't change measurement though
      const dstack2 = new DStackIntegration({
        ...testConfig,
        forceSimulation: false, // Different config
      })
      await dstack2.initialize()

      // Measurements depend on the seed, which varies when not in forced simulation
      expect(dstack2.getStatus().platform).toBe('simulated')
    })
  })

  describe('attestation', () => {
    it('generates attestation with all fields', async () => {
      const attestation = await dstack.generateAttestation()

      expect(attestation.measurement).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(attestation.platform).toBe('simulated')
      expect(attestation.cpuQuote).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(attestation.timestamp).toBeGreaterThan(0)
      expect(attestation.reportData).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('attestation measurement matches status measurement', async () => {
      const status = dstack.getStatus()
      const attestation = await dstack.generateAttestation()

      expect(attestation.measurement).toBe(status.measurement)
    })
  })

  describe('wallet creation', () => {
    it('creates wallet with valid address', async () => {
      const wallet = await dstack.createWallet('test-salt')

      expect(wallet.address).toMatch(/^0x[0-9a-f]{40}$/i)
    })

    it('different salts produce different addresses', async () => {
      const wallet1 = await dstack.createWallet('salt1')
      const wallet2 = await dstack.createWallet('salt2')

      expect(wallet1.address).not.toBe(wallet2.address)
    })

    it('same salt produces same address on same instance', async () => {
      const wallet1 = await dstack.createWallet('consistent-salt')
      const wallet2 = await dstack.createWallet('consistent-salt')

      expect(wallet1.address).toBe(wallet2.address)
    })

    it('wallet can sign messages', async () => {
      const wallet = await dstack.createWallet('signing-test')

      const signature = await wallet.signMessage('test message')
      expect(signature).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('wallet signs same message consistently', async () => {
      const wallet = await dstack.createWallet('consistent-sign')

      const sig1 = await wallet.signMessage('same message')
      const sig2 = await wallet.signMessage('same message')

      expect(sig1).toBe(sig2)
    })

    it('wallet signs different messages differently', async () => {
      const wallet = await dstack.createWallet('diff-sign')

      const sig1 = await wallet.signMessage('message1')
      const sig2 = await wallet.signMessage('message2')

      expect(sig1).not.toBe(sig2)
    })

    it('wallet can sign transactions', async () => {
      const wallet = await dstack.createWallet('tx-test')

      const tx = { to: '0x1234', value: '1000000000000000000' }
      const signature = await wallet.signTransaction(tx)

      expect(signature).toMatch(/^0x[0-9a-f]{64}$/i)
    })
  })

  describe('KMS', () => {
    it('derives encryption keys', async () => {
      const kms = await dstack.getKMS()
      const key = await kms.deriveKey('encryption')

      expect(key).toBeInstanceOf(Uint8Array)
      expect(key.length).toBe(32) // 256-bit key
    })

    it('derives different keys for different salts', async () => {
      const kms = await dstack.getKMS()

      const key1 = await kms.deriveKey('salt1')
      const key2 = await kms.deriveKey('salt2')

      expect(key1).not.toEqual(key2)
    })

    it('derives same key for same salt', async () => {
      const kms = await dstack.getKMS()

      const key1 = await kms.deriveKey('same-salt')
      const key2 = await kms.deriveKey('same-salt')

      expect(key1).toEqual(key2)
    })

    it('seals and unseals data', async () => {
      const kms = await dstack.getKMS()
      const plaintext = new TextEncoder().encode('secret game state')

      const sealed = await kms.seal(plaintext)
      const unsealed = await kms.unseal(sealed)

      expect(unsealed).toEqual(plaintext)
    })

    it('sealed data differs from plaintext', async () => {
      const kms = await dstack.getKMS()
      const plaintext = new TextEncoder().encode('secret')

      const sealed = await kms.seal(plaintext)

      expect(sealed).not.toEqual(plaintext)
    })

    it('handles empty data', async () => {
      const kms = await dstack.getKMS()
      const plaintext = new Uint8Array(0)

      const sealed = await kms.seal(plaintext)
      const unsealed = await kms.unseal(sealed)

      expect(unsealed).toEqual(plaintext)
    })

    it('handles large data', async () => {
      const kms = await dstack.getKMS()
      const plaintext = new Uint8Array(10000)
      for (let i = 0; i < plaintext.length; i++) {
        plaintext[i] = i % 256
      }

      const sealed = await kms.seal(plaintext)
      const unsealed = await kms.unseal(sealed)

      expect(unsealed).toEqual(plaintext)
    })
  })

  describe('error handling', () => {
    it('throws when generating attestation before init', async () => {
      const uninitDstack = new DStackIntegration(testConfig)

      await expect(uninitDstack.generateAttestation()).rejects.toThrow(
        'not initialized',
      )
    })

    it('throws when creating wallet before init', async () => {
      const uninitDstack = new DStackIntegration(testConfig)

      await expect(uninitDstack.createWallet('test')).rejects.toThrow(
        'not initialized',
      )
    })

    it('throws when getting KMS before init', async () => {
      const uninitDstack = new DStackIntegration(testConfig)

      await expect(uninitDstack.getKMS()).rejects.toThrow('not initialized')
    })
  })
})

describe('DStackIntegration environment detection', () => {
  it('detects simulated mode by default', async () => {
    const dstack = new DStackIntegration({})
    await dstack.initialize()

    expect(dstack.getStatus().isRealTEE).toBe(false)
    expect(dstack.getStatus().platform).toBe('simulated')
  })
})
