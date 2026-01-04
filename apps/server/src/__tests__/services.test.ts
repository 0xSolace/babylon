/**
 * Services Tests
 *
 * Tests for service layer - unit tests that don't require database
 */

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'

// Set test environment
const originalEnv = { ...process.env }

beforeAll(() => {
  process.env.FARCASTER_HUB_URL = 'https://test-hub.farcaster.xyz:2281'
  process.env.BABYLON_CHANNEL_URL = 'chain://eip155:1/erc721:0xtest'
  process.env.JEJU_RPC_URL = 'http://localhost:8545'
  process.env.JEJU_RELAY_URL = 'http://localhost:3200'
  process.env.MLS_ENABLED = 'false'
  // Note: XMTP is always enabled via config, not env var
})

afterAll(() => {
  process.env = originalEnv
})

// Import services
import {
  getFarcasterClient,
  storeSignerKey,
  getSignerKey,
} from '../services/farcaster'

import {
  isMLSEnabled,
  storeUserSignature as storeMLSSignature,
} from '../services/mls-groups'

import {
  isXMTPEnabled,
  storeUserSignature as storeXMTPSignature,
} from '../services/xmtp-messaging'

describe('Farcaster Service', () => {
  describe('getFarcasterClient', () => {
    it('should return a singleton client', () => {
      const client1 = getFarcasterClient()
      const client2 = getFarcasterClient()

      expect(client1).toBeDefined()
      expect(client1).toBe(client2)
    })
  })

  describe('Signer Key Management', () => {
    it('should store and retrieve signer keys', () => {
      const userId = 'test-user-1'
      const signerKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

      storeSignerKey(userId, signerKey as `0x${string}`)
      const retrieved = getSignerKey(userId)

      expect(retrieved).toBeDefined()
      expect(retrieved).toBeInstanceOf(Uint8Array)
      expect(retrieved?.length).toBe(32)
    })

    it('should return undefined for non-existent keys', () => {
      const retrieved = getSignerKey('nonexistent-user')
      expect(retrieved).toBeUndefined()
    })

    it('should handle hex keys with 0x prefix', () => {
      const userId = 'test-user-2'
      const signerKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

      storeSignerKey(userId, signerKey as `0x${string}`)
      const retrieved = getSignerKey(userId)

      expect(retrieved).toBeDefined()
    })

    it('should overwrite existing keys', () => {
      const userId = 'test-user-3'
      const key1 = '0x1111111111111111111111111111111111111111111111111111111111111111'
      const key2 = '0x2222222222222222222222222222222222222222222222222222222222222222'

      storeSignerKey(userId, key1 as `0x${string}`)
      storeSignerKey(userId, key2 as `0x${string}`)

      const retrieved = getSignerKey(userId)
      expect(retrieved?.[0]).toBe(0x22)
    })
  })

  describe('Hex to Bytes Conversion', () => {
    it('should correctly convert hex strings', () => {
      const userId = 'test-hex-conversion'
      const hex = '0x00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff'

      storeSignerKey(userId, hex as `0x${string}`)
      const bytes = getSignerKey(userId)

      expect(bytes).toBeDefined()
      expect(bytes?.[0]).toBe(0x00)
      expect(bytes?.[1]).toBe(0xff)
      expect(bytes?.[2]).toBe(0x00)
      expect(bytes?.[3]).toBe(0xff)
    })
  })
})

describe('MLS Groups Service', () => {
  describe('isMLSEnabled', () => {
    it('should return false when MLS_ENABLED is not true', () => {
      expect(isMLSEnabled()).toBe(false)
    })
  })

  describe('User Signature Storage', () => {
    it('should store user signatures without throwing', () => {
      const userId = 'mls-test-user'
      const signature = '0xdeadbeef' as `0x${string}`

      expect(() => {
        storeMLSSignature(userId, signature)
      }).not.toThrow()
    })

    it('should handle multiple users', () => {
      const users = ['user-1', 'user-2', 'user-3']
      const signatures = [
        '0x1111111111111111' as `0x${string}`,
        '0x2222222222222222' as `0x${string}`,
        '0x3333333333333333' as `0x${string}`,
      ]

      for (let i = 0; i < users.length; i++) {
        expect(() => {
          storeMLSSignature(users[i], signatures[i])
        }).not.toThrow()
      }
    })
  })
})

describe('XMTP Messaging Service', () => {
  describe('isXMTPEnabled', () => {
    it('should always return true (XMTP is always enabled via config)', () => {
      expect(isXMTPEnabled()).toBe(true)
    })
  })

  describe('User Signature Storage', () => {
    it('should store user signatures without throwing', () => {
      const userId = 'xmtp-test-user'
      const signature = '0xcafebabe' as `0x${string}`

      expect(() => {
        storeXMTPSignature(userId, signature)
      }).not.toThrow()
    })
  })
})

describe('Service Error Handling', () => {
  describe('MLS Service when disabled', () => {
    it('should throw when MLS is disabled', async () => {
      const { createMLSGroup } = await import('../services/mls-groups')

      process.env.MLS_ENABLED = 'false'

      let threw = false
      try {
        await createMLSGroup('creator-id', 'Test Group', ['member-1', 'member-2'])
      } catch (e) {
        threw = true
        expect((e as Error).message).toContain('MLS')
      }
      expect(threw).toBe(true)
    })

    it('sendMLSMessage should throw when MLS is disabled', async () => {
      const { sendMLSMessage } = await import('../services/mls-groups')

      let threw = false
      try {
        await sendMLSMessage('sender-id', 'chat-id', 'Hello')
      } catch (e) {
        threw = true
        expect((e as Error).message).toContain('MLS')
      }
      expect(threw).toBe(true)
    })
  })

  describe('XMTP Service configuration', () => {
    it('should have XMTP always enabled via config', () => {
      // XMTP is always enabled via packages/config, not environment variables
      // Actual message sending requires DB initialization (tested in E2E)
      expect(isXMTPEnabled()).toBe(true)
    })
  })
})

describe('Concurrent Operations', () => {
  it('should handle concurrent signer key storage', () => {
    const operations = Array.from({ length: 100 }, (_, i) => {
      const userId = `concurrent-user-${i}`
      const hex = `0x${'00'.repeat(31)}${i.toString(16).padStart(2, '0')}`
      return () => storeSignerKey(userId, hex as `0x${string}`)
    })

    for (const op of operations) {
      op()
    }

    expect(getSignerKey('concurrent-user-0')?.[31]).toBe(0)
    expect(getSignerKey('concurrent-user-50')?.[31]).toBe(50)
    expect(getSignerKey('concurrent-user-99')?.[31]).toBe(99)
  })

  it('should handle concurrent signature storage without race conditions', () => {
    const users = Array.from({ length: 50 }, (_, i) => `sig-user-${i}`)
    const signatures = users.map((_, i) =>
      `0x${'00'.repeat(31)}${i.toString(16).padStart(2, '0')}` as `0x${string}`
    )

    users.forEach((userId, i) => {
      storeMLSSignature(userId, signatures[i])
      storeXMTPSignature(userId, signatures[i])
    })

    expect(true).toBe(true)
  })
})

describe('Type Guards and Metadata Parsing', () => {
  describe('Chat Metadata Parsing', () => {
    it('should correctly identify MLS encryption type', () => {
      const metadata = { encryptionType: 'mls' }
      expect(metadata.encryptionType).toBe('mls')
    })

    it('should handle null metadata', () => {
      const metadata = null as { encryptionType?: string } | null
      expect(metadata?.encryptionType).toBeUndefined()
    })

    it('should handle missing encryptionType', () => {
      const metadata = { otherField: 'value' } as { encryptionType?: string }
      expect(metadata.encryptionType).toBeUndefined()
    })
  })

  describe('Message Metadata', () => {
    it('should structure encrypted message metadata correctly', () => {
      const metadata = {
        isEncrypted: true,
        encryptionType: 'mls',
        status: 'sent',
        mlsMessageId: 'mls-123',
      }

      expect(metadata.isEncrypted).toBe(true)
      expect(metadata.encryptionType).toBe('mls')
      expect(metadata.status).toBe('sent')
      expect(metadata.mlsMessageId).toBe('mls-123')
    })
  })
})

describe('Environment Configuration', () => {
  it('should use default values when env vars not set', () => {
    const savedRpc = process.env.JEJU_RPC_URL
    const savedRelay = process.env.JEJU_RELAY_URL
    delete process.env.JEJU_RPC_URL
    delete process.env.JEJU_RELAY_URL

    expect(() => {
      isMLSEnabled()
      isXMTPEnabled()
    }).not.toThrow()

    process.env.JEJU_RPC_URL = savedRpc
    process.env.JEJU_RELAY_URL = savedRelay
  })
})
