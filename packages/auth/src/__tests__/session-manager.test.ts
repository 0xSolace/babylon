/**
 * SessionManager Tests - Permissionless Sessions
 */

import { describe, expect, it } from 'bun:test'
import { privateKeyToAccount } from 'viem/accounts'
import { createSessionMessage, SessionManager } from '../server/session-manager'
import type { DID } from '../types/index'

describe('SessionManager (Permissionless)', () => {
  // Test wallet
  const privateKey =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  const account = privateKeyToAccount(privateKey)
  const testDID: DID = `did:jeju:testnet:${account.address.slice(2)}`

  const sessionManager = new SessionManager({ expiresIn: 3600 })

  describe('createSessionMessage', () => {
    it('should create a signable message', () => {
      const { message, claims } = createSessionMessage(testDID, account.address)

      expect(message).toContain(testDID)
      expect(message).toContain(account.address)
      expect(claims.did).toBe(testDID)
      expect(claims.address).toBe(account.address)
      expect(claims.exp).toBeGreaterThan(claims.iat)
    })
  })

  describe('createToken + verifyToken', () => {
    it('should create and verify a session token', async () => {
      const { message, claims } = createSessionMessage(testDID, account.address)

      // Sign with wallet
      const signature = await account.signMessage({ message })

      // Create token with full claims from createSessionMessage
      const token = sessionManager.createToken(claims, signature)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')

      // Verify token - no secret needed!
      const verified = await sessionManager.verifyToken(token)

      expect(verified.did).toBe(testDID)
      expect(verified.address).toBe(account.address)
    })

    it('should reject token with wrong signature', async () => {
      const { claims } = createSessionMessage(testDID, account.address)

      // Use wrong signature
      const wrongSignature = `0x${'00'.repeat(65)}`

      const token = sessionManager.createToken(
        claims,
        wrongSignature as `0x${string}`,
      )

      await expect(sessionManager.verifyToken(token)).rejects.toThrow()
    })

    it('should reject expired token', async () => {
      const { message, claims } = createSessionMessage(
        testDID,
        account.address,
        -1,
      )
      const signature = await account.signMessage({ message })

      const token = sessionManager.createToken(claims, signature)

      await expect(sessionManager.verifyToken(token)).rejects.toThrow(
        'Session expired',
      )
    })
  })

  describe('decodeToken', () => {
    it('should decode token without verification', async () => {
      const { message, claims } = createSessionMessage(testDID, account.address)
      const signature = await account.signMessage({ message })

      // Add linkedTypes to claims
      const claimsWithTypes = { ...claims, linkedTypes: ['wallet'] }
      const token = sessionManager.createToken(claimsWithTypes, signature)

      const decoded = sessionManager.decodeToken(token)

      expect(decoded?.did).toBe(testDID)
      expect(decoded?.address).toBe(account.address)
      expect(decoded?.linkedTypes).toContain('wallet')
    })

    it('should throw for invalid token', () => {
      expect(() => sessionManager.decodeToken('invalid')).toThrow()
    })
  })

  describe('isExpired', () => {
    it('should return false for fresh token', async () => {
      const { message, claims } = createSessionMessage(testDID, account.address)
      const signature = await account.signMessage({ message })

      const token = sessionManager.createToken(claims, signature)

      expect(sessionManager.isExpired(token)).toBe(false)
    })

    it('should throw for invalid token', () => {
      expect(() => sessionManager.isExpired('invalid')).toThrow()
    })
  })

  describe('permissionless verification', () => {
    it('should verify without any server secret', async () => {
      // Create token with one instance
      const manager1 = new SessionManager()
      const { message, claims } = createSessionMessage(testDID, account.address)
      const signature = await account.signMessage({ message })
      const token = manager1.createToken(claims, signature)

      // Verify with completely different instance - no shared state needed
      const manager2 = new SessionManager()
      const verified = await manager2.verifyToken(token)

      expect(verified.did).toBe(testDID)
      expect(verified.address).toBe(account.address)
    })
  })
})
