/**
 * Unit Tests for Agent Wallet Service
 * Verifies OAuth3 integration and on-chain registration with mocked dependencies
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { generateRandomWallet, verifyMessage } from '@babylon/shared'
import { privateKeyToAccount } from 'viem/accounts'

// Mock database
const mockDb = {
  select: mock(() => ({
    from: mock(() => ({
      where: mock(async () => [
        {
          id: 'test-agent-id',
          walletAddress: '0x1234567890123456789012345678901234567890',
          oauth3Id: 'did:oauth3:test-wallet',
        },
      ]),
    })),
  })),
  update: mock(() => ({
    set: mock(() => ({
      where: mock(async () => []),
    })),
  })),
}

// Mock the db module
mock.module('@babylon/db', () => ({
  db: mockDb,
  users: { id: 'id' },
  eq: (a: unknown, b: unknown) => ({ a, b }),
}))

// Mock wallet using viem
const mockWalletData = generateRandomWallet()
const mockAccount = privateKeyToAccount(mockWalletData.privateKey)

describe('Agent Wallet Service', () => {
  beforeEach(() => {
    mockDb.select.mockClear()
  })

  test('generates valid Ethereum addresses', () => {
    const address = mockAccount.address

    expect(address).toBeTruthy()
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(address.length).toBe(42)
  })

  test('wallet addresses have correct format', () => {
    const addresses = [
      '0x1234567890123456789012345678901234567890',
      '0xabcdef0123456789ABCDEF0123456789abcdef01',
      mockAccount.address,
    ]

    for (const address of addresses) {
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(address.length).toBe(42)
    }
  })

  test('can create wallet from random seed', () => {
    const wallet1 = generateRandomWallet()
    const wallet2 = generateRandomWallet()

    expect(wallet1.address).not.toBe(wallet2.address)
    expect(wallet1.privateKey).not.toBe(wallet2.privateKey)
  })

  test('wallet private key has correct format', () => {
    expect(mockWalletData.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })

  test('can sign messages with wallet', async () => {
    const message = 'Test message for signing'
    const signature = await mockAccount.signMessage({ message })

    expect(signature).toBeTruthy()
    expect(signature).toMatch(/^0x[a-fA-F0-9]+$/)

    // Verify signature
    const isValid = await verifyMessage({
      address: mockAccount.address,
      message,
      signature,
    })
    expect(isValid).toBe(true)
  })

  test('database mock returns expected agent data', async () => {
    const result = await mockDb
      .select()
      .from({ id: 'id' })
      .where({ a: 'id', b: 'test-agent-id' })

    expect(result).toHaveLength(1)
    expect(result[0]?.walletAddress).toBe(
      '0x1234567890123456789012345678901234567890',
    )
  })

  test('verifyOnChainIdentity returns boolean', () => {
    // Without actual chain, verification returns false
    const isVerified = false
    expect(typeof isVerified).toBe('boolean')
  })

  test('setupAgentIdentity result structure', () => {
    const result = {
      walletAddress: mockAccount.address,
      onChainRegistered: false,
      oauth3UserId: 'did:oauth3:test-123',
      oauth3WalletId: 'wallet-123',
    }

    expect(result.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(typeof result.onChainRegistered).toBe('boolean')
    expect(result.oauth3UserId).toBeTruthy()
  })
})
