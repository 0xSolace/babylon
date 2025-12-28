/**
 * Jeju Auth Integration Tests (Permissionless)
 *
 * Tests the decentralized authentication flow.
 * No shared secrets needed - uses wallet signatures.
 */

import { describe, expect, it } from 'bun:test'
import { createSessionMessage, SessionManager } from '@babylon/api'
import type { AuthMethod, DID } from '@jejunetwork/auth'
import {
  createDID,
  DIDManager,
  generatePKCE,
  KeyBackupManager,
  validateDID,
} from '@jejunetwork/auth'
import { ThresholdSigner } from '@jejunetwork/kms'
import type { Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

describe('Jeju Auth Integration', () => {
  describe('DID Utilities', () => {
    it('should validate DIDs correctly', () => {
      expect(
        validateDID(
          'did:jeju:mainnet:0x1234567890abcdef1234567890abcdef12345678',
        ),
      ).toBe(true)
      expect(
        validateDID(
          'did:jeju:localnet:0xabcdef1234567890abcdef1234567890abcdef12',
        ),
      ).toBe(true)
      expect(validateDID('invalid-did')).toBe(false)
    })

    it('should create DIDs from public keys', () => {
      const publicKey =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`
      const did = createDID(publicKey, 'localnet')

      expect(did).toContain('did:jeju:localnet:0x')
      expect(validateDID(did)).toBe(true)
    })

    it('should create unique DIDs for different keys', () => {
      const key1 =
        '0x1111111111111111111111111111111111111111111111111111111111111111' as `0x${string}`
      const key2 =
        '0x2222222222222222222222222222222222222222222222222222222222222222' as `0x${string}`

      const did1 = createDID(key1, 'mainnet')
      const did2 = createDID(key2, 'mainnet')

      expect(did1).not.toBe(did2)
    })
  })

  // Note: DID creation with MPC requires running MPC nodes
  // These tests are skipped when nodes aren't available
  describe.skip('DID Creation with MPC (requires running nodes)', () => {
    const didManager = new DIDManager({ network: 'localnet' })

    it('should create identity from wallet auth', async () => {
      const authMethod: AuthMethod = {
        type: 'wallet',
        address: '0x1234567890abcdef1234567890abcdef12345678' as Address,
        signature: '0xabc123' as `0x${string}`,
        message: 'Sign in to Babylon',
        timestamp: Date.now(),
      }

      const result = await didManager.createIdentity(authMethod)

      expect(result.did).toBeDefined()
      expect(validateDID(result.did)).toBe(true)
    })
  })

  describe('Permissionless Session Tokens', () => {
    // Test wallet
    const privateKey =
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    const account = privateKeyToAccount(privateKey)
    const did = `did:jeju:localnet:${account.address.slice(2)}` as DID

    const sessionManager = new SessionManager({ expiresIn: 3600 })

    it('should create and verify session tokens', async () => {
      const { message, claims } = createSessionMessage(did, account.address)

      // Sign with wallet
      const signature = await account.signMessage({ message })

      // Create token - no secret needed
      const token = sessionManager.createToken(claims, signature)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')

      // Verify - no secret needed, uses signature verification
      const verified = await sessionManager.verifyToken(token)
      expect(verified.did).toBe(did)
      expect(verified.address).toBe(account.address)
    })

    it('should reject invalid signatures', async () => {
      const { claims } = createSessionMessage(did, account.address)

      // Use wrong signature
      const wrongSignature = `0x${'00'.repeat(65)}`

      const token = sessionManager.createToken(
        claims,
        wrongSignature as `0x${string}`,
      )

      await expect(sessionManager.verifyToken(token)).rejects.toThrow()
    })

    it('should check token expiration', async () => {
      const { message, claims } = createSessionMessage(did, account.address)
      const signature = await account.signMessage({ message })

      const token = sessionManager.createToken(claims, signature)

      expect(sessionManager.isExpired(token)).toBe(false)
    })

    it('should verify across different manager instances (permissionless)', async () => {
      // Create with one instance
      const manager1 = new SessionManager()
      const { message, claims } = createSessionMessage(did, account.address)
      const signature = await account.signMessage({ message })
      const token = manager1.createToken(claims, signature)

      // Verify with completely different instance - no shared state
      const manager2 = new SessionManager()
      const verified = await manager2.verifyToken(token)

      expect(verified.did).toBe(did)
    })
  })

  describe('Key Backup and Recovery', () => {
    const backupManager = new KeyBackupManager({
      iterations: 1000, // Lower for tests
      saltLength: 16,
      ivLength: 12,
    })

    it('should create and verify backup', async () => {
      const userId =
        'did:jeju:localnet:0x1234567890abcdef1234567890abcdef12345678' as DID
      const password = 'test-password-123'

      const backup = await backupManager.createBackup(userId, password)

      expect(backup.userId).toBe(userId)
      expect(backup.encryptedKey).toBeDefined()
      expect(backup.salt).toBeDefined()

      const isValid = await backupManager.verifyBackup(backup, password)
      expect(isValid).toBe(true)
    })

    it('should reject wrong password', async () => {
      const userId =
        'did:jeju:localnet:0xfedcba0987654321fedcba0987654321fedcba09' as DID
      const password = 'correct-password'

      const backup = await backupManager.createBackup(userId, password)

      await expect(
        backupManager.verifyBackup(backup, 'wrong-password'),
      ).rejects.toThrow()
    })

    it('should export and import backup as JSON', async () => {
      const userId =
        'did:jeju:localnet:0x9876543210abcdef9876543210abcdef98765432' as DID
      const password = 'export-test-password'

      const backup = await backupManager.createBackup(userId, password)
      const json = KeyBackupManager.exportToJSON(backup)
      const imported = KeyBackupManager.importFromJSON(json)

      expect(imported.userId).toBe(backup.userId)
      expect(imported.encryptedKey).toBe(backup.encryptedKey)
    })
  })

  describe('PKCE OAuth Flow', () => {
    it('should generate valid PKCE params', async () => {
      const pkce = await generatePKCE()

      expect(pkce.codeVerifier).toBeDefined()
      expect(pkce.codeVerifier.length).toBe(64)
      expect(pkce.codeChallenge).toBeDefined()
      expect(pkce.state).toBeDefined()
      expect(pkce.state.length).toBe(32)
      expect(pkce.nonce).toBeDefined()
    })

    it('should generate unique PKCE params each time', async () => {
      const pkce1 = await generatePKCE()
      const pkce2 = await generatePKCE()

      expect(pkce1.codeVerifier).not.toBe(pkce2.codeVerifier)
      expect(pkce1.state).not.toBe(pkce2.state)
    })
  })

  // Note: Threshold signing requires running MPC nodes
  // These tests are skipped when nodes aren't available
  describe.skip('Threshold Signing (requires running MPC nodes)', () => {
    it('should sign messages in dev mode', async () => {
      const userId =
        'did:jeju:localnet:0x1234567890abcdef1234567890abcdef12345678' as DID

      const signer = new ThresholdSigner(userId, {
        endpoints: ['http://localhost:4010'],
        networkId: 'jeju-localnet',
        threshold: 1,
        timeout: 5000,
        devMode: true,
      })

      await signer.initialize()

      const result = await signer.signMessage('Hello, Babylon!')

      expect(result.signature).toBeDefined()
      expect(result.signature).toMatch(/^0x[a-fA-F0-9]+$/)
    })
  })
})
