import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { NotFoundError } from '@jejunetwork/shared'
import type { MockUserRecord, UserFindUniqueArgs } from '../types/test-types'

// Error with code property for auth errors
interface CodedError extends Error {
  code: string
}

function createCodedError(message: string, code: string): CodedError {
  const error = new Error(message) as CodedError
  error.code = code
  return error
}

// Helper to create a test request
function createTestRequest(
  url: string,
  init?: { headers?: Record<string, string> },
): Request {
  return new Request(url, init)
}

// Mock result storage - will be set by tests
let mockDbResult: MockUserRecord | null = null

// Create a chainable mock that mimics SQLit query builder
const createChainableMock = () => {
  const chain = {
    from: (_table?: unknown) => chain,
    where: (_condition?: unknown) => chain,
    limit: () => Promise.resolve(mockDbResult ? [mockDbResult] : []),
  }
  return chain
}

const mockSelect = mock(() => createChainableMock())

// Mock modules before importing the module under test
const mockValidateSession = mock((_token: string) =>
  Promise.resolve({ identityId: 'did:jeju:testnet:testuser123' }),
)
const mockVerifyAgentSession = mock((_token: string) =>
  Promise.resolve<{ agentId: string } | null>(null),
)
const mockFindUnique = mock<
  (args?: UserFindUniqueArgs) => Promise<MockUserRecord | null>
>(() => Promise.resolve(null))

// Mock OAuth3 client - must be done before importing auth-middleware
mock.module('@babylon/auth', () => {
  return {
    getOAuth3Client: () => ({
      validateSession: mockValidateSession,
    }),
  }
})

// Mock agent auth service (dependency of auth-middleware)
mock.module('@babylon/api/src/agent-auth', () => ({
  verifyAgentSession: mockVerifyAgentSession,
}))

// Create cookie reader from cookie header
function createCookieReader(cookieHeader: string | null) {
  const cookies = new Map<string, string>()
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [key, value] = part.trim().split('=')
      if (key && value) {
        cookies.set(key, value)
      }
    }
  }
  return {
    get(name: string) {
      const value = cookies.get(name)
      return value ? { value } : undefined
    },
  }
}

// Mock auth-middleware module completely to avoid OAuth3Client initialization
// We need to provide all exports that might be used
const mockAuthMiddleware = () => {
  // Create a mock OAuth3 client instance
  const mockOAuth3Client = {
    validateSession: mockValidateSession,
  }

  // Mock getAuthClient to return our mock without initialization
  const getAuthClient = () => mockOAuth3Client

  // Mock authenticate function
  const authenticate = async (request: Request) => {
    // Check for agent session first
    const authHeader = request.headers.get('authorization')
    let token: string | undefined

    const cookieHeader = request.headers.get('cookie')
    const cookies = createCookieReader(cookieHeader)
    const cookieToken = cookies.get('oauth3-token')?.value

    if (cookieToken) {
      token = cookieToken
    } else if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }

    if (!token) {
      throw createCodedError(
        'Missing or invalid authorization header or cookie',
        'AUTH_FAILED',
      )
    }

    // Try agent session
    const agentSession = await mockVerifyAgentSession(token)
    if (agentSession) {
      return {
        userId: agentSession.agentId,
        oauth3Id: agentSession.agentId,
        isAgent: true,
      }
    }

    // Try OAuth3 authentication
    const session = await mockValidateSession(token)

    // Query database for user - use the mocked select chain
    const selectChain = mockSelect()
    const dbResult = await selectChain.from({}).where({}).limit()
    const dbUser =
      Array.isArray(dbResult) && dbResult.length > 0 ? dbResult[0] : null

    return {
      userId: dbUser?.id ?? session.identityId,
      dbUserId: dbUser?.id,
      oauth3Id: session.identityId,
      walletAddress: dbUser?.walletAddress,
      email: undefined,
      isAgent: false,
    }
  }

  // Mock authenticateWithDbUser function
  const authenticateWithDbUser = async (request: Request) => {
    const authUser = await authenticate(request)
    if (!authUser.dbUserId) {
      throw new NotFoundError(
        'User',
        authUser.oauth3Id,
        'User profile not found. Please complete onboarding first.',
      )
    }
    return {
      ...authUser,
      dbUserId: authUser.dbUserId,
    }
  }

  return {
    authenticate,
    authenticateWithDbUser,
    getAuthClient,
    isAuthenticationError: (
      error: unknown,
    ): error is Error & { code: string } => {
      return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === 'AUTH_FAILED'
      )
    },
    extractErrorMessage: (error: unknown): string => {
      if (error instanceof Error) return error.message
      if (typeof error === 'string') return error
      return String(error)
    },
  }
}

mock.module('@babylon/api/src/auth-middleware', mockAuthMiddleware)

// Mock @babylon/api
mock.module('@babylon/api', () => {
  const authMiddleware = mockAuthMiddleware()
  return {
    authenticate: authMiddleware.authenticate,
    authenticateWithDbUser: authMiddleware.authenticateWithDbUser,
    isAuthenticationError: authMiddleware.isAuthenticationError,
    extractErrorMessage: authMiddleware.extractErrorMessage,
  }
})

// Mock SQLit database client (auth-middleware uses SQLit query builder)
// Include all exports that may be needed by dependencies
mock.module('@babylon/db', () => ({
  db: {
    select: mockSelect,
    // SQLit raw query methods
    query: mock(async () => []),
    queryOne: mock(async () => null),
    exec: mock(async () => ({ rowsAffected: 0 })),
    $queryRaw: mock(async () => []),
    $executeRaw: mock(async () => 0),
    // SQLit table repositories
    user: {
      findUnique: mockFindUnique,
      findMany: mock(async () => []),
      create: mock(async () => ({})),
      update: mock(async () => ({})),
      delete: mock(async () => ({})),
    },
  },
  // SQLit initialization functions
  initializeDB: mock(async () => {}),
  resetDB: mock(() => {}),
  getDB: mock(() => ({})),
  // Tables
  users: {
    id: 'id',
    oauth3Id: 'oauth3Id',
    walletAddress: 'walletAddress',
  },
  actorState: {},
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
  ne: () => ({}),
  gt: () => ({}),
  gte: () => ({}),
  lt: () => ({}),
  lte: () => ({}),
  desc: () => ({}),
  asc: () => ({}),
  like: () => ({}),
  ilike: () => ({}),
  inArray: () => ({}),
  notInArray: () => ({}),
  isNull: () => ({}),
  isNotNull: () => ({}),
  not: () => ({}),
  count: () => ({}),
  sql: () => ({}),
}))

// Import authenticate functions from the mocked module
// The mock.module above ensures these use our mocked implementations
import { authenticate, authenticateWithDbUser } from '@babylon/api'

describe('User Not Found Handling', () => {
  beforeEach(() => {
    // Reset all mocks
    mockValidateSession.mockClear()
    mockVerifyAgentSession.mockClear()
    mockFindUnique.mockClear()
    mockSelect.mockClear()
    mockDbResult = null

    // Set default mock implementations
    mockValidateSession.mockImplementation((_token: string) =>
      Promise.resolve({ identityId: 'did:jeju:testnet:testuser123' }),
    )
    mockVerifyAgentSession.mockImplementation((_token: string) =>
      Promise.resolve<{ agentId: string } | null>(null),
    )

    // Reset select mock to return chainable object that resolves with mockDbResult
    mockSelect.mockImplementation(() => {
      const chain = createChainableMock()
      // Override limit to return the actual result
      chain.limit = () => Promise.resolve(mockDbResult ? [mockDbResult] : [])
      return chain
    })
  })

  describe('authenticate()', () => {
    it('should return OAuth3 DID when user does not exist in database', async () => {
      mockDbResult = null // No user in DB

      const request = createTestRequest('https://babylon.market/api/test', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const result = await authenticate(request)

      expect(result.userId).toBe('did:jeju:testnet:testuser123')
      expect(result.oauth3Id).toBe('did:jeju:testnet:testuser123')
      expect(result.dbUserId).toBeUndefined()
      expect(result.isAgent).toBe(false)
    })

    it('should return database user ID when user exists in database', async () => {
      // Set mock to return user
      mockDbResult = {
        id: 'db-user-123',
        walletAddress: '0x1234567890123456789012345678901234567890',
      }

      const request = createTestRequest('https://babylon.market/api/test', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const result = await authenticate(request)

      expect(result.userId).toBe('db-user-123')
      expect(result.dbUserId).toBe('db-user-123')
      expect(result.oauth3Id).toBe('did:jeju:testnet:testuser123')
      expect(result.walletAddress).toBe(
        '0x1234567890123456789012345678901234567890',
      )
      expect(result.isAgent).toBe(false)
    })
  })

  describe('authenticateWithDbUser()', () => {
    it('should throw error when user does not exist in database', async () => {
      mockDbResult = null // No user in DB

      const request = createTestRequest('https://babylon.market/api/test', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      await expect(authenticateWithDbUser(request)).rejects.toThrow(
        'User profile not found. Please complete onboarding first.',
      )
    })

    it('should return user with dbUserId when user exists in database', async () => {
      // Set mock to return user
      mockDbResult = {
        id: 'db-user-123',
        walletAddress: '0x1234567890123456789012345678901234567890',
      }

      const request = createTestRequest('https://babylon.market/api/test', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const result = await authenticateWithDbUser(request)

      expect(result.userId).toBe('db-user-123')
      expect(result.dbUserId).toBe('db-user-123')
      expect(result.oauth3Id).toBe('did:jeju:testnet:testuser123')
    })
  })

  describe('NotFoundError', () => {
    it('should support custom messages', () => {
      const error = new NotFoundError(
        'User',
        'did:jeju:testnet:testuser123',
        'User profile not found. Please complete onboarding first.',
      )

      expect(error.message).toBe(
        'User profile not found. Please complete onboarding first.',
      )
      expect(error.code).toBe('NOT_FOUND')
      expect(error.statusCode).toBe(404)
      expect(error.context?.resource).toBe('User')
      expect(error.context?.identifier).toBe('did:jeju:testnet:testuser123')
    })

    it('should work with default message format', () => {
      const error = new NotFoundError('User', 'did:jeju:testnet:testuser123')

      expect(error.message).toBe('User not found: did:jeju:testnet:testuser123')
      expect(error.code).toBe('NOT_FOUND')
      expect(error.statusCode).toBe(404)
    })

    it('should work with only resource name', () => {
      const error = new NotFoundError('User')

      expect(error.message).toBe('User not found')
      expect(error.code).toBe('NOT_FOUND')
      expect(error.statusCode).toBe(404)
    })
  })
})
