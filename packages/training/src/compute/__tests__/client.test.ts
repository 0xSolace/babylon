import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { ComputeTrainingClient } from '../client'

// Mock fetch globally
// Cast is necessary because bun:test's Mock<F> adds mock-specific methods
// (mockClear, mockReset, etc.) that make it not directly assignable to fetch
const mockFetch = mock(
  async (
    _input: string | URL | Request,
    _init?: RequestInit,
  ): Promise<Response> => {
    return new Response()
  },
)
globalThis.fetch = mockFetch as unknown as typeof fetch

describe('ComputeTrainingClient', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    // Reset environment
    delete process.env.USE_JEJU
    delete process.env.NODE_ENV
    delete process.env.BABYLON_TREASURY_ADDRESS
  })

  describe('constructor', () => {
    test('creates client with default config', () => {
      const client = new ComputeTrainingClient()
      expect(client).toBeDefined()
    })

    test('creates client with custom config', () => {
      const client = new ComputeTrainingClient({
        mode: 'jeju',
        cloudEndpoint: 'https://custom.endpoint',
      })
      expect(client).toBeDefined()
    })
  })

  describe('getJobStatus', () => {
    test('returns null for unknown job', () => {
      const client = new ComputeTrainingClient({ mode: 'local' })
      const status = client.getJobStatus('unknown-job')
      expect(status).toBeNull()
    })
  })

  describe('submitTrainingJob (local mode)', () => {
    test('creates job and tracks it', async () => {
      const client = new ComputeTrainingClient({ mode: 'local' })

      // Note: Local mode spawns a Python process that may fail if Python/script not available
      // We're just testing that the job is created and tracked
      const jobId = await client.submitTrainingJob({
        batchId: 'test-batch',
        baseModel: 'gpt2',
        datasetCID: 'QmTest',
        trainingSteps: 100,
        batchSize: 4,
        learningRate: 2e-5,
      })

      expect(jobId).toMatch(/^train-/)

      const status = client.getJobStatus(jobId)
      expect(status).toBeDefined()
      expect(status?.jobId).toBe(jobId)
      // Status will be 'training' initially or 'failed' if script not found
      if (status) {
        expect(['training', 'failed']).toContain(status.status)
      }
    })
  })

  describe('submitTrainingJob (jeju mode)', () => {
    test('calls cloud API for GPU rental', async () => {
      let rentCalled = false
      let _pollCount = 0

      mockFetch.mockImplementation(
        async (
          input: string | URL | Request,
          _init?: RequestInit,
        ): Promise<Response> => {
          const urlString =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.toString()
                : input.url
          if (
            urlString.includes('/api/v1/rentals') &&
            !urlString.includes('/status')
          ) {
            rentCalled = true
            return new Response(
              JSON.stringify({
                rentalId: 'rental-123',
                providerAddress: '0x1234567890123456789012345678901234567890',
                sshHost: 'gpu.example.com',
                sshPort: 22,
                expiresAt: Date.now() + 3600000,
                costWei: '1000000000000000',
              }),
              { status: 200 },
            )
          }
          if (urlString.includes('/status')) {
            _pollCount++
            // Return completed immediately to avoid timeout
            return new Response(
              JSON.stringify({
                status: 'completed',
                modelCID: 'QmModel123',
                modelHash: '0xabcd',
              }),
              { status: 200 },
            )
          }
          return new Response('Not found', { status: 404 })
        },
      )

      const client = new ComputeTrainingClient({
        mode: 'jeju',
        cloudEndpoint: 'https://cloud.test',
        timeoutMinutes: 1,
      })

      // submitTrainingJob returns immediately after starting the job
      const jobId = await client.submitTrainingJob({
        batchId: 'test-batch',
        baseModel: 'gpt2',
        datasetCID: 'QmTest',
        trainingSteps: 100,
        batchSize: 4,
        learningRate: 2e-5,
      })

      expect(jobId).toMatch(/^train-/)
      expect(rentCalled).toBe(true)

      // Job should be in 'training' status right after submission
      const status = client.getJobStatus(jobId)
      expect(status).toBeDefined()
      expect(status?.status).toBe('training')
    })
  })
})
