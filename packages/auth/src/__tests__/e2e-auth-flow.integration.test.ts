/**
 * End-to-End Auth Flow Integration Test (Permissionless)
 *
 * Tests the complete decentralized auth flow using @jejunetwork/kms:
 * 1. Key generation with MPC coordinator
 * 2. DID creation from key
 * 3. Permissionless session tokens (wallet-signed)
 * 4. Key backup and recovery
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import { getMPCCoordinator, resetMPCCoordinator } from '@jejunetwork/kms'
import type { Address, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createDID } from '../did/index'
import { KeyBackupManager } from '../recovery/backup'
import { createSessionMessage, SessionManager } from '../server/session-manager'
import type { DID } from '../types/index'

describe('E2E Auth Flow (Permissionless)', () => {
  let sessionManager: SessionManager
  let backupManager: KeyBackupManager
  let createdDID: DID
  let walletAddress: Address

  // Test wallet for signing
  const privateKey =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  const account = privateKeyToAccount(privateKey)

  beforeAll(() => {
    resetMPCCoordinator()
    sessionManager = new SessionManager({ expiresIn: 3600 })
    backupManager = new KeyBackupManager({ iterations: 1000 })
  })

  it('Step 1: Generate key and create DID with MPC coordinator', async () => {
    const coordinator = getMPCCoordinator({ network: 'localnet' })

    // Register parties
    const partyIds = ['party-1', 'party-2', 'party-3']
    for (let i = 0; i < partyIds.length; i++) {
      coordinator.registerParty({
        id: partyIds[i],
        index: i + 1,
        endpoint: 'http://localhost:4010',
        publicKey: '0x' as Hex,
        address: '0x' as Address,
        stake: 0n,
        registeredAt: Date.now(),
      })
    }

    // Generate key
    const keyResult = await coordinator.generateKey({
      keyId: `wallet:${account.address}:${Date.now()}`,
      threshold: 2,
      totalParties: 3,
      partyIds,
      curve: 'secp256k1',
    })

    // Create DID from public key
    createdDID = createDID(keyResult.publicKey, 'testnet')
    walletAddress = keyResult.address

    expect(createdDID).toMatch(/^did:jeju:testnet:0x[a-fA-F0-9]{40}$/)
    expect(walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)

    console.log(`  ✅ Created DID: ${createdDID}`)
    console.log(`  ✅ Wallet: ${walletAddress}`)
  })

  it('Step 2: Create permissionless session token', async () => {
    if (!createdDID) {
      console.log('Skipping - prerequisite not met')
      return
    }

    // Use the test account address to match the signature
    // (In production, the MPC key would be used for signing)
    const sessionDID: DID = `did:jeju:testnet:${account.address.slice(2).toLowerCase()}`
    const sessionAddress = account.address

    // Create session message with test account address
    const { message, claims } = createSessionMessage(sessionDID, sessionAddress)

    // Sign with wallet
    const signature = await account.signMessage({ message })

    // Create token - no secret needed
    const token = sessionManager.createToken(claims, signature)

    expect(token).toBeDefined()
    expect(typeof token).toBe('string')

    // Verify the token - anyone can verify, no secret needed
    const verified = await sessionManager.verifyToken(token)
    expect(verified.did).toBe(sessionDID)
    expect(verified.address).toBe(sessionAddress)

    console.log(`  ✅ Session token created and verified (permissionless)`)
  })

  it('Step 3: Create and verify key backup', async () => {
    if (!createdDID) {
      console.log('Skipping - prerequisite not met')
      return
    }

    const password = 'secure-backup-password-123'

    // Create backup
    const backup = await backupManager.createBackup(createdDID, password)
    expect(backup.userId).toBe(createdDID)
    expect(backup.encryptedKey).toBeDefined()
    expect(backup.salt).toBeDefined()
    expect(backup.iv).toBeDefined()

    // Verify backup
    const isValid = await backupManager.verifyBackup(backup, password)
    expect(isValid).toBe(true)

    // Export and import as JSON
    const json = KeyBackupManager.exportToJSON(backup)
    const imported = KeyBackupManager.importFromJSON(json)
    expect(imported.userId).toBe(createdDID)

    console.log(`  ✅ Backup created and verified`)
  })

  it('Step 4: Verify permissionless token verification (no shared state)', async () => {
    if (!createdDID) {
      console.log('Skipping - prerequisite not met')
      return
    }

    // Use the test account address to match the signature
    const sessionDID: DID = `did:jeju:testnet:${account.address.slice(2).toLowerCase()}`
    const sessionAddress = account.address

    // Create token with one manager
    const manager1 = new SessionManager()
    const { message, claims } = createSessionMessage(sessionDID, sessionAddress)
    const signature = await account.signMessage({ message })
    const token = manager1.createToken(claims, signature)

    // Verify with a completely different manager - no shared state needed
    const manager2 = new SessionManager()
    const verified = await manager2.verifyToken(token)

    expect(verified.did).toBe(sessionDID)
    expect(verified.address).toBe(sessionAddress)

    console.log(`  ✅ Permissionless verification works (no shared secrets)`)
  })

  it('Step 5: Verify key retrieval from MPC coordinator', () => {
    if (!createdDID) {
      console.log('Skipping - prerequisite not met')
      return
    }

    const coordinator = getMPCCoordinator({ network: 'localnet' })
    const status = coordinator.getStatus()

    expect(status.totalKeys).toBeGreaterThan(0)
    expect(status.activeParties).toBe(3)

    console.log(`  ✅ MPC coordinator status verified`)
  })
})
