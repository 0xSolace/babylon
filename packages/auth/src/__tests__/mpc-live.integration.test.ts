/**
 * MPC Coordinator Live Integration Tests
 *
 * Tests that run against the MPC coordinator from @jejunetwork/kms.
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import { getMPCCoordinator, resetMPCCoordinator } from '@jejunetwork/kms'
import type { Address, Hex } from 'viem'

describe('MPC Coordinator Live Integration', () => {
  beforeAll(() => {
    resetMPCCoordinator()
  })

  it('should create coordinator and get status', () => {
    const coordinator = getMPCCoordinator({ network: 'localnet' })
    const status = coordinator.getStatus()

    expect(status.activeParties).toBe(0)
    expect(status.totalKeys).toBe(0)
    expect(status.activeSessions).toBe(0)
    expect(status.config.network).toBe('localnet')
  })

  it('should register parties', () => {
    resetMPCCoordinator()
    const coordinator = getMPCCoordinator({ network: 'localnet' })

    const party = coordinator.registerParty({
      id: 'test-party-1',
      index: 1,
      endpoint: 'http://localhost:4010',
      publicKey: '0x' as Hex,
      address: '0x' as Address,
      stake: 0n,
      registeredAt: Date.now(),
    })

    expect(party.id).toBe('test-party-1')
    expect(party.status).toBe('active')

    const activeParties = coordinator.getActiveParties()
    expect(activeParties.length).toBe(1)
  })

  it('should generate key with multiple parties', async () => {
    resetMPCCoordinator()
    const coordinator = getMPCCoordinator({ network: 'localnet' })

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

    const result = await coordinator.generateKey({
      keyId: 'integration-test-key',
      threshold: 2,
      totalParties: 3,
      partyIds,
      curve: 'secp256k1',
    })

    expect(result.keyId).toBe('integration-test-key')
    expect(result.publicKey).toBeDefined()
    expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(result.threshold).toBe(2)
    expect(result.totalParties).toBe(3)
  })

  it('should request and process signature', async () => {
    resetMPCCoordinator()
    const coordinator = getMPCCoordinator({ network: 'localnet' })

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

    const keyResult = await coordinator.generateKey({
      keyId: 'signing-test-key',
      threshold: 2,
      totalParties: 3,
      partyIds,
      curve: 'secp256k1',
    })

    const session = await coordinator.requestSignature({
      keyId: 'signing-test-key',
      message: '0x68656c6c6f' as Hex,
      messageHash: '0x68656c6c6f' as Hex,
      requester: keyResult.address,
    })

    expect(session.sessionId).toBeDefined()
    expect(session.keyId).toBe('signing-test-key')
    expect(session.status).toBe('pending')
    expect(session.threshold).toBe(2)
  })

  it('should rotate key', async () => {
    resetMPCCoordinator()
    const coordinator = getMPCCoordinator({ network: 'localnet' })

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

    await coordinator.generateKey({
      keyId: 'rotate-test-key',
      threshold: 2,
      totalParties: 3,
      partyIds,
      curve: 'secp256k1',
    })

    const rotationResult = await coordinator.rotateKey({
      keyId: 'rotate-test-key',
      preserveAddress: true,
    })

    expect(rotationResult.keyId).toBe('rotate-test-key')
    expect(rotationResult.oldVersion).toBe(1)
    expect(rotationResult.newVersion).toBe(2)
  })

  it('should get key versions', async () => {
    resetMPCCoordinator()
    const coordinator = getMPCCoordinator({ network: 'localnet' })

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

    await coordinator.generateKey({
      keyId: 'versions-test-key',
      threshold: 2,
      totalParties: 3,
      partyIds,
      curve: 'secp256k1',
    })

    const versions = coordinator.getKeyVersions('versions-test-key')

    expect(versions.length).toBe(1)
    expect(versions[0]?.version).toBe(1)
    expect(versions[0]?.status).toBe('active')
  })

  it('should revoke key', async () => {
    resetMPCCoordinator()
    const coordinator = getMPCCoordinator({ network: 'localnet' })

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

    await coordinator.generateKey({
      keyId: 'revoke-test-key',
      threshold: 2,
      totalParties: 3,
      partyIds,
      curve: 'secp256k1',
    })

    coordinator.revokeKey('revoke-test-key')

    const key = coordinator.getKey('revoke-test-key')
    expect(key).toBeFalsy() // null or undefined after revocation
  })
})
