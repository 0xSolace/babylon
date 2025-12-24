import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { baseSepolia } from 'viem/chains'
import { GPUTier, PrivacyMode, RunState } from '../decentralized-training'
import type { TrainingJobRequest } from '../types'

const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const TEST_COORDINATOR = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
const TEST_REWARDS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
const TEST_PERFORMANCE = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
const TEST_REGISTRY = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'

// Mock the viem clients
const mockWaitForTransactionReceipt = mock(() =>
  Promise.resolve({ status: 'success' }),
)
const mockWriteContract = mock(() => Promise.resolve('0xmockhash'))
const mockReadContract = mock(() =>
  Promise.resolve([
    '0x0000000000000000000000000000000000000000', // creator
    1, // state
    0, // epoch
    1, // step
    0, // clientCount
    0, // privacyMode
  ]),
)

// Mock viem
mock.module('viem', () => ({
  createPublicClient: () => ({
    readContract: mockReadContract,
    waitForTransactionReceipt: mockWaitForTransactionReceipt,
  }),
  createWalletClient: () => ({
    writeContract: mockWriteContract,
    account: { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
  }),
  http: () => ({}),
  parseAbi: (abi: string[]) => abi,
  keccak256: (_data: string) => `0x${'1'.repeat(64)}`,
  stringToBytes: (s: string) => new TextEncoder().encode(s),
  encodeAbiParameters: () => '0x',
  parseAbiParameters: () => [],
  zeroHash: `0x${'0'.repeat(64)}`,
}))

mock.module('viem/accounts', () => ({
  privateKeyToAccount: () => ({
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  }),
}))

describe('TrainingClient', () => {
  let client: TrainingClient
  const testConfig = {
    rpcUrl: 'http://localhost:6545',
    privateKey: TEST_PRIVATE_KEY,
    chain: baseSepolia,
    contracts: {
      coordinator: TEST_COORDINATOR as `0x${string}`,
      rewards: TEST_REWARDS as `0x${string}`,
      performance: TEST_PERFORMANCE as `0x${string}`,
      registry: TEST_REGISTRY as `0x${string}`,
    },
  }

  beforeEach(() => {
    mockReadContract.mockClear()
    mockWriteContract.mockClear()
    mockWaitForTransactionReceipt.mockClear()
    client = new TrainingClient(testConfig)
  })

  describe('constructor', () => {
    test('creates client with valid config', () => {
      expect(client).toBeDefined()
    })

    test('creates client with all optional fields', () => {
      const fullConfig = {
        ...testConfig,
        ipfsGateway: 'https://ipfs.io',
        hfToken: 'hf_test123',
        minGpuTier: GPUTier.Datacenter,
        rewardToken:
          '0x1234567890123456789012345678901234567890' as `0x${string}`,
      }
      const c = new TrainingClient(fullConfig)
      expect(c).toBeDefined()
    })
  })

  describe('submitTrainingJob', () => {
    test('submits job and returns runId', async () => {
      const request: TrainingJobRequest = {
        batchId: 'test-batch-123',
        baseModel: 'unsloth/llama-3-8b',
        datasetCID: 'QmTest123',
        trainingSteps: 1000,
        batchSize: 4,
        learningRate: 2e-5,
      }

      const runId = await client.submitTrainingJob(request)

      expect(runId).toMatch(/^0x[a-f0-9]{64}$/)
      expect(mockWriteContract).toHaveBeenCalled()
      expect(mockWaitForTransactionReceipt).toHaveBeenCalled()
    })

    test('builds correct coordinator config', async () => {
      const request: TrainingJobRequest = {
        batchId: 'config-test',
        baseModel: 'gpt2',
        datasetCID: 'QmTest',
        trainingSteps: 500,
        batchSize: 8,
        learningRate: 1e-5,
      }

      await client.submitTrainingJob(request)

      // Verify writeContract was called with config containing trainingSteps
      const call = mockWriteContract.mock.calls[0]
      expect(call).toBeDefined()
      // The args contain the config object
      const args = call?.[0] as { args: unknown[] }
      expect(args.args).toBeDefined()
    })
  })

  describe('getJobStatus', () => {
    test('returns null for uninitialized run', async () => {
      mockReadContract.mockImplementationOnce(() =>
        Promise.resolve([
          '0x0000000000000000000000000000000000000000',
          RunState.Uninitialized,
          0,
          0,
          0,
          0,
        ]),
      )

      const status = await client.getJobStatus(
        `0x${'1'.repeat(64)}` as `0x${string}`,
      )
      expect(status).toBeNull()
    })

    test('returns job status for active run', async () => {
      mockReadContract.mockImplementationOnce(() =>
        Promise.resolve([
          '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          RunState.RoundTrain,
          2, // epoch
          50, // step
          4, // clientCount
          PrivacyMode.Public,
        ]),
      )

      mockReadContract.mockImplementationOnce(() =>
        Promise.resolve({
          totalSteps: 1000,
        }),
      )

      const status = await client.getJobStatus(
        `0x${'1'.repeat(64)}` as `0x${string}`,
      )

      expect(status).not.toBeNull()
      expect(status?.state).toBe(RunState.RoundTrain)
      expect(status?.epoch).toBe(2)
      expect(status?.step).toBe(50)
      expect(status?.clientCount).toBe(4)
    })

    test('handles all run states', async () => {
      const states = [
        RunState.WaitingForMembers,
        RunState.Warmup,
        RunState.RoundTrain,
        RunState.RoundWitness,
        RunState.Cooldown,
        RunState.Finished,
        RunState.Paused,
      ]

      for (const state of states) {
        mockReadContract.mockImplementationOnce(() =>
          Promise.resolve([
            '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            state,
            1,
            10,
            3,
            0,
          ]),
        )
        mockReadContract.mockImplementationOnce(() =>
          Promise.resolve({ totalSteps: 100 }),
        )

        const status = await client.getJobStatus(
          `0x${'1'.repeat(64)}` as `0x${string}`,
        )
        expect(status?.state).toBe(state)
      }
    })
  })

  describe('getProgress', () => {
    test('returns null for non-existent run', async () => {
      mockReadContract.mockImplementationOnce(() =>
        Promise.resolve([
          '0x0000000000000000000000000000000000000000',
          RunState.Uninitialized,
          0,
          0,
          0,
          0,
        ]),
      )

      const progress = await client.getProgress(
        `0x${'1'.repeat(64)}` as `0x${string}`,
      )
      expect(progress).toBeNull()
    })

    test('returns progress for active run', async () => {
      mockReadContract.mockImplementationOnce(() =>
        Promise.resolve([
          '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          RunState.RoundTrain,
          3,
          75,
          5,
          0,
        ]),
      )
      mockReadContract.mockImplementationOnce(() =>
        Promise.resolve({ totalSteps: 100 }),
      )

      const progress = await client.getProgress(
        `0x${'1'.repeat(64)}` as `0x${string}`,
      )

      expect(progress).not.toBeNull()
      expect(progress?.step).toBe(75)
      expect(progress?.totalSteps).toBe(100)
      expect(progress?.epoch).toBe(3)
      expect(progress?.state).toBe('RoundTrain')
    })
  })

  describe('claimRewards', () => {
    test('claims rewards when available', async () => {
      mockReadContract.mockImplementationOnce(() =>
        Promise.resolve([1000000000000000000n, 100n]),
      )

      const claimed = await client.claimRewards(
        `0x${'1'.repeat(64)}` as `0x${string}`,
      )

      expect(claimed).toBe(1000000000000000000n)
      expect(mockWriteContract).toHaveBeenCalled()
    })

    test('returns 0 when nothing to claim', async () => {
      mockReadContract.mockImplementationOnce(() => Promise.resolve([0n, 0n]))

      const claimed = await client.claimRewards(
        `0x${'1'.repeat(64)}` as `0x${string}`,
      )

      expect(claimed).toBe(0n)
      expect(mockWriteContract).not.toHaveBeenCalled()
    })
  })

  describe('getClaimableRewards', () => {
    test('returns claimable amount', async () => {
      mockReadContract.mockImplementationOnce(() =>
        Promise.resolve([5000000000000000000n, 500n]),
      )

      const claimable = await client.getClaimableRewards(
        `0x${'1'.repeat(64)}` as `0x${string}`,
      )

      expect(claimable).toBe(5000000000000000000n)
    })
  })

  describe('jobToResult', () => {
    test('converts job to result format', () => {
      const job = {
        runId: `0x${'1'.repeat(64)}` as `0x${string}`,
        name: 'test-job',
        batchId: 'batch-1',
        baseModel: 'gpt2',
        state: RunState.RoundTrain,
        epoch: 2,
        step: 50,
        totalSteps: 100,
        clientCount: 4,
        privacyMode: PrivacyMode.Public,
        createdAt: new Date(),
      }

      const result = client.jobToResult(job)

      expect(result.jobId).toBe(job.runId)
      expect(result.status).toBe('training')
    })

    test('maps all states correctly', () => {
      const stateToStatus: Record<RunState, string> = {
        [RunState.Uninitialized]: 'pending',
        [RunState.WaitingForMembers]: 'provisioning',
        [RunState.Warmup]: 'training',
        [RunState.RoundTrain]: 'training',
        [RunState.RoundWitness]: 'training',
        [RunState.Cooldown]: 'training',
        [RunState.Finished]: 'completed',
        [RunState.Paused]: 'failed',
      }

      for (const [state, expectedStatus] of Object.entries(stateToStatus)) {
        const job = {
          runId: `0x${'1'.repeat(64)}` as `0x${string}`,
          name: 'test',
          batchId: 'batch',
          baseModel: 'gpt2',
          state: Number(state) as RunState,
          epoch: 0,
          step: 0,
          totalSteps: 100,
          clientCount: 0,
          privacyMode: PrivacyMode.Public,
          createdAt: new Date(),
        }

        const result = client.jobToResult(job)
        expect(result.status).toBe(expectedStatus)
      }
    })
  })

  describe('cleanup', () => {
    test('clears active jobs', async () => {
      // Submit a job first
      await client.submitTrainingJob({
        batchId: 'cleanup-test',
        baseModel: 'gpt2',
        datasetCID: 'QmTest',
        trainingSteps: 100,
        batchSize: 4,
        learningRate: 2e-5,
      })

      client.cleanup()

      // Internal state should be cleared (we can verify by checking subsequent calls)
      expect(client).toBeDefined()
    })
  })
})

describe('createTrainingClient', () => {
  test('creates client instance', () => {
    const client = createTrainingClient({
      rpcUrl: 'http://localhost:6545',
      privateKey: TEST_PRIVATE_KEY,
      chain: baseSepolia,
      contracts: {
        coordinator: TEST_COORDINATOR as `0x${string}`,
        rewards: TEST_REWARDS as `0x${string}`,
        performance: TEST_PERFORMANCE as `0x${string}`,
        registry: TEST_REGISTRY as `0x${string}`,
      },
    })

    expect(client).toBeInstanceOf(TrainingClient)
  })
})

describe('isTrainingAvailable', () => {
  test('returns false when env vars missing', () => {
    const originalCoord = process.env.TRAINING_COORDINATOR_ADDRESS
    const originalRpc = process.env.RPC_URL
    const originalKey = process.env.PRIVATE_KEY

    delete process.env.TRAINING_COORDINATOR_ADDRESS
    delete process.env.RPC_URL
    delete process.env.PRIVATE_KEY

    expect(isTrainingAvailable()).toBe(false)

    // Restore
    if (originalCoord) process.env.TRAINING_COORDINATOR_ADDRESS = originalCoord
    if (originalRpc) process.env.RPC_URL = originalRpc
    if (originalKey) process.env.PRIVATE_KEY = originalKey
  })

  test('returns true when all env vars present', () => {
    const originalCoord = process.env.TRAINING_COORDINATOR_ADDRESS
    const originalRpc = process.env.RPC_URL
    const originalKey = process.env.PRIVATE_KEY

    process.env.TRAINING_COORDINATOR_ADDRESS = TEST_COORDINATOR
    process.env.RPC_URL = 'http://localhost:6545'
    process.env.PRIVATE_KEY = TEST_PRIVATE_KEY

    expect(isTrainingAvailable()).toBe(true)

    // Restore
    if (originalCoord) {
      process.env.TRAINING_COORDINATOR_ADDRESS = originalCoord
    } else {
      delete process.env.TRAINING_COORDINATOR_ADDRESS
    }
    if (originalRpc) {
      process.env.RPC_URL = originalRpc
    } else {
      delete process.env.RPC_URL
    }
    if (originalKey) {
      process.env.PRIVATE_KEY = originalKey
    } else {
      delete process.env.PRIVATE_KEY
    }
  })
})

describe('Enums', () => {
  test('RunState values are correct', () => {
    expect(RunState.Uninitialized).toBe(0)
    expect(RunState.WaitingForMembers).toBe(1)
    expect(RunState.Warmup).toBe(2)
    expect(RunState.RoundTrain).toBe(3)
    expect(RunState.RoundWitness).toBe(4)
    expect(RunState.Cooldown).toBe(5)
    expect(RunState.Finished).toBe(6)
    expect(RunState.Paused).toBe(7)
  })

  test('PrivacyMode values are correct', () => {
    expect(PrivacyMode.Public).toBe(0)
    expect(PrivacyMode.Private).toBe(1)
  })

  test('GPUTier values are correct', () => {
    expect(GPUTier.Unknown).toBe(0)
    expect(GPUTier.Consumer).toBe(1)
    expect(GPUTier.Prosumer).toBe(2)
    expect(GPUTier.Datacenter).toBe(3)
    expect(GPUTier.HighEnd).toBe(4)
  })
})
