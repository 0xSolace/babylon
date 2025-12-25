import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { initializeAgentA2AClient } from '@babylon/agents'

// Centralized port configuration via environment variables
const BABYLON_API_PORT = process.env.BABYLON_API_PORT ?? '5009'

// Tests use mocked db module
const describeTests = describe

const findUniqueMock = mock(async () => ({
  id: 'agent-1',
  isAgent: true,
  walletAddress: null as string | null,
  agent0TokenId: null as number | null,
  displayName: 'Test Agent',
}))

const createWalletMock = mock(async () => ({
  walletAddress: '0xwallet',
  kmsKeyId: 'kms-key-123',
}))

const sdkFromCardMock = mock(async () => MockA2AClient)

const MockA2AClient = {
  fromCardUrl: sdkFromCardMock,
}

// Mock fetch to return a valid agent card
const originalFetch = globalThis.fetch

/**
 * Create a typed fetch mock that satisfies Bun's fetch signature
 * Bun's fetch has a preconnect property that must be present
 */
function createFetchMock(): typeof fetch {
  const mockImpl = async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const urlStr =
      typeof url === 'string'
        ? url
        : url instanceof URL
          ? url.toString()
          : url.url
    if (urlStr.includes('agent-card.json')) {
      return new Response(JSON.stringify({ name: 'test-agent', skills: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return originalFetch(url, init)
  }

  // Use Object.assign to copy preconnect from original fetch
  // The return type is explicitly declared as typeof fetch
  const result: typeof fetch = Object.assign(mockImpl, {
    preconnect: originalFetch.preconnect,
  })
  return result
}

const mockFetch = createFetchMock()

mock.module('@babylon/db', () => ({
  db: {
    user: {
      findUnique: findUniqueMock,
    },
  },
  // All table exports that may be imported by dependencies
  users: {},
  actors: {},
  agentLogs: {},
  agentMessages: {},
  agentRegistries: {},
  llmCallLogs: {},
  trajectories: {},
  worldFacts: {},
  referrals: {},
  pointsTransactions: {},
  // Operators
  eq: () => ({}),
  and: () => ({}),
  or: () => ({}),
  desc: () => ({}),
  asc: () => ({}),
}))

mock.module('@babylon/agents', () => ({
  agentWalletService: {
    createAgentEmbeddedWallet: createWalletMock,
  },
}))

mock.module('@a2a-js/sdk/client', () => ({
  A2AClient: MockA2AClient,
}))

describeTests('initializeAgentA2AClient wallet provisioning', () => {
  beforeEach(() => {
    findUniqueMock.mockClear()
    createWalletMock.mockClear()
    sdkFromCardMock.mockClear()
    // Reset mock call counts (mockFetch is already properly typed)
    // Mock global fetch to return agent card
    globalThis.fetch = mockFetch
    process.env.AUTO_CREATE_AGENT_WALLETS = 'true'
    process.env.PUBLIC_APP_URL = `http://localhost:${BABYLON_API_PORT}`
  })

  test('auto-creates wallet when missing', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'agent-1',
      isAgent: true,
      walletAddress: null,
      agent0TokenId: null,
      displayName: 'Test Agent 1',
    })

    await initializeAgentA2AClient('agent-1')

    expect(createWalletMock).toHaveBeenCalledTimes(1)
    expect(sdkFromCardMock).toHaveBeenCalledTimes(1)
  })

  test('does not call wallet service when wallet already exists', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'agent-2',
      isAgent: true,
      walletAddress: '0xexisting',
      agent0TokenId: 123,
      displayName: 'Test Agent 2',
    })

    await initializeAgentA2AClient('agent-2')

    // Wallet service should not be called if wallet already exists
    expect(createWalletMock).not.toHaveBeenCalled()
    // SDK should still be initialized
    expect(sdkFromCardMock).toHaveBeenCalledTimes(1)
  })
})
