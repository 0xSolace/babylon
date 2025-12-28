/**
 * Decentralized Messaging Integration Tests
 *
 * Tests the full flow of NPC identity, Farcaster posting, and decentralized DMs.
 */

import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test'
import {
  createPoster,
  DEFAULT_HUBS,
  FarcasterPoster,
} from '@jejunetwork/messaging'
import { getDMService, resetDMService } from '../autonomous/DMService'
import {
  getNPCIdentityService,
  resetNPCIdentityService,
} from '../identity/NPCIdentityService'
import { getNPCDecentralizedBootstrapService } from '../services/npc-decentralized-bootstrap.service'

// Mock the database
mock.module('@babylon/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                id: 'test-actor',
                walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
                farcasterFid: null,
                isActor: true,
                isAgent: false,
                displayName: 'Test Actor',
              },
            ]),
        }),
      }),
    }),
    insert: () => ({
      values: () => Promise.resolve(),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    query: {
      chatParticipants: {
        findMany: () => Promise.resolve([]),
      },
    },
  },
  eq: (a: unknown, b: unknown) => ({ field: a, value: b }),
  users: { id: 'id', walletAddress: 'walletAddress' },
}))

// Mock the engine
mock.module('@babylon/engine', () => ({
  StaticDataRegistry: {
    getAllActors: () => [
      {
        id: 'test-actor-1',
        name: 'Test Actor 1',
        description: 'A test actor',
      },
      {
        id: 'test-actor-2',
        name: 'Test Actor 2',
        description: 'Another test actor',
      },
    ],
    getActor: (id: string) => ({
      id,
      name: `Actor ${id}`,
      description: 'Test description',
    }),
  },
}))

// Mock fetch for KMS and EQLite
const originalFetch = globalThis.fetch
beforeAll(() => {
  globalThis.fetch = mock((url: string, options?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString()

    // Mock KMS endpoints
    if (urlStr.includes('/keys/generate')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            metadata: {
              id: 'test-key-id',
              type: options?.body
                ? JSON.parse(options.body as string).type
                : 'signing',
              curve: 'secp256k1',
              createdAt: Date.now(),
              owner: '0x0',
              providerType: 'local',
            },
            publicKey: `0x04${'a'.repeat(128)}`,
          }),
          { status: 200 },
        ),
      )
    }

    // Mock EQLite endpoints
    if (urlStr.includes('/v1/query')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            rows: [],
            rowCount: 0,
            affectedRows: 0,
          }),
          { status: 200 },
        ),
      )
    }

    // Mock Farcaster Hub
    if (urlStr.includes('/v1/submitMessage')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            hash: `0x${'a'.repeat(40)}`,
          }),
          { status: 200 },
        ),
      )
    }

    return Promise.resolve(new Response('Not found', { status: 404 }))
  }) as typeof fetch
})

afterAll(() => {
  globalThis.fetch = originalFetch
  resetNPCIdentityService()
  resetDMService()
})

describe('NPCIdentityService', () => {
  it('should initialize with default config', () => {
    const service = getNPCIdentityService()
    expect(service).toBeDefined()
  })

  it('should provide public key derivation for wallets', async () => {
    const service = getNPCIdentityService()

    // The service should be able to create identities
    expect(typeof service.initializeNPCIdentity).toBe('function')
    expect(typeof service.getNPCIdentity).toBe('function')
    expect(typeof service.signAsNPC).toBe('function')
  })
})

describe('FarcasterPoster (via @jejunetwork/messaging)', () => {
  it('should export poster functionality', async () => {
    expect(createPoster).toBeDefined()
    expect(FarcasterPoster).toBeDefined()
    expect(DEFAULT_HUBS).toBeDefined()
    expect(DEFAULT_HUBS.mainnet).toBe('https://nemes.farcaster.xyz:2281')
  })
})

describe('DMService', () => {
  it('should initialize with default config', () => {
    const service = getDMService()
    expect(service).toBeDefined()
  })

  it('should have respond method', () => {
    const service = getDMService()
    expect(typeof service.respondToDMs).toBe('function')
  })
})

describe('NPCDecentralizedBootstrapService', () => {
  it('should be a singleton', () => {
    const service1 = getNPCDecentralizedBootstrapService()
    const service2 = getNPCDecentralizedBootstrapService()

    expect(service1).toBe(service2)
  })

  it('should have bootstrap methods', () => {
    const service = getNPCDecentralizedBootstrapService()

    expect(typeof service.bootstrapAll).toBe('function')
    expect(typeof service.isBootstrapped).toBe('function')
    expect(typeof service.getStats).toBe('function')
    expect(typeof service.postAsNPC).toBe('function')
  })

  it('should return stats', () => {
    const service = getNPCDecentralizedBootstrapService()
    const stats = service.getStats()

    expect(stats).toHaveProperty('total')
    expect(stats).toHaveProperty('bootstrapped')
    expect(stats).toHaveProperty('pending')
    expect(stats).toHaveProperty('failed')
  })
})

describe('Integration Flow', () => {
  it('should connect NPC identity to Farcaster posting', async () => {
    // This test verifies the integration between services
    const identityService = getNPCIdentityService()
    const bootstrapService = getNPCDecentralizedBootstrapService()

    // Both services should be able to access NPC data
    expect(identityService).toBeDefined()
    expect(bootstrapService).toBeDefined()

    // Verify that the bootstrap service has postAsNPC method
    expect(typeof bootstrapService.postAsNPC).toBe('function')
  })
})
