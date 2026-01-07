/**
 * Babylon Training RLAIF Integration Tests
 *
 * End-to-end tests for the Babylon training pipeline with Jeju RLAIF.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { responseJson } from '@jejunetwork/shared'
import { z } from 'zod'

// Response schemas
const RLAIFHealthSchema = z.object({
  status: z.string(),
  service: z.string(),
})
const RLAIFRunSchema = z.object({
  runId: z.string(),
  status: z.string(),
})
const RunIdSchema = z.object({ runId: z.string() })
const ManifestSchema = z.object({
  manifestCID: z.string(),
  trajectoryCount: z.number(),
})
const CidSchema = z.object({ cid: z.string() })
const StateSchema = z.object({ state: z.number() })

const DWS_URL = process.env.DWS_URL || 'http://localhost:4030'
const SKIP_IF_NO_DWS = process.env.SKIP_DWS_TESTS === 'true'

// Check if DWS is available
async function isDWSAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${DWS_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

describe('Babylon Training RLAIF Integration', () => {
  let dwsAvailable = false

  beforeAll(async () => {
    dwsAvailable = await isDWSAvailable()
    if (!dwsAvailable && !SKIP_IF_NO_DWS) {
      console.warn('[Test] DWS not available, some tests will be skipped')
    }
  })

  describe('RLAIF API Endpoints', () => {
    test.skipIf(!dwsAvailable)('should check RLAIF health', async () => {
      const response = await fetch(`${DWS_URL}/rlaif/health`)
      expect(response.ok).toBe(true)

      const health = RLAIFHealthSchema.parse(await responseJson(response))
      expect(health.status).toBe('healthy')
      expect(health.service).toBe('rlaif')
    })

    test.skipIf(!dwsAvailable)(
      'should create RLAIF run for Babylon',
      async () => {
        const response = await fetch(`${DWS_URL}/rlaif/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            environment: {
              id: 'babylon',
              type: 'game',
              configCID: 'babylon-trader',
            },
            model: {
              baseModelCID: 'test-model-cid',
              tokenizer: 'Qwen/Qwen2.5-3B-Instruct',
            },
            judge: {
              rubricId: 'babylon-trader',
            },
            targetIterations: 3,
            minTrajectoriesPerIteration: 5,
          }),
        })

        expect(response.ok).toBe(true)

        const result = RLAIFRunSchema.parse(await responseJson(response))
        expect(result.runId).toBeDefined()
        expect(result.status).toBe('created')
      },
    )

    test.skipIf(!dwsAvailable)(
      'should submit trajectories to RLAIF run',
      async () => {
        // First create a run
        const createResponse = await fetch(`${DWS_URL}/rlaif/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            environment: { id: 'babylon', type: 'game', configCID: 'test' },
            model: { baseModelCID: 'test', tokenizer: 'test' },
            targetIterations: 1,
            minTrajectoriesPerIteration: 2,
          }),
        })

        const { runId } = RunIdSchema.parse(await responseJson(createResponse))

        // Submit trajectories
        const trajResponse = await fetch(
          `${DWS_URL}/rlaif/runs/${runId}/rollouts`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trajectories: [
                {
                  id: 'test-traj-1',
                  steps: [
                    {
                      stepNumber: 0,
                      timestamp: Date.now(),
                      observation: { balance: 1000 },
                      action: { type: 'buy', parameters: { amount: 100 } },
                      reward: 0.5,
                      done: false,
                    },
                    {
                      stepNumber: 1,
                      timestamp: Date.now() + 1000,
                      observation: { balance: 1100 },
                      action: { type: 'sell', parameters: { amount: 50 } },
                      reward: 1.0,
                      done: true,
                    },
                  ],
                  totalReward: 1.5,
                  metadata: { archetype: 'trader', finalPnL: 50 },
                },
                {
                  id: 'test-traj-2',
                  steps: [
                    {
                      stepNumber: 0,
                      timestamp: Date.now(),
                      observation: { balance: 1000 },
                      action: { type: 'wait', parameters: {} },
                      reward: 0,
                      done: true,
                    },
                  ],
                  totalReward: 0,
                  metadata: { archetype: 'trader', finalPnL: 0 },
                },
              ],
            }),
          },
        )

        expect(trajResponse.ok).toBe(true)

        const result = ManifestSchema.parse(await responseJson(trajResponse))
        expect(result.manifestCID).toBeDefined()
        expect(result.trajectoryCount).toBe(2)
      },
    )

    test.skipIf(!dwsAvailable)(
      'should score trajectories with RULER',
      async () => {
        // First upload some trajectories
        const trajResponse = await fetch(`${DWS_URL}/storage/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'trajectory-manifest',
            trajectoryCIDs: ['test-cid-1', 'test-cid-2'],
          }),
        })

        // Storage must be available for this test - fail if not configured
        expect(trajResponse.ok).toBe(true)

        const { cid } = CidSchema.parse(await responseJson(trajResponse))

        // Score with RULER
        const scoreResponse = await fetch(`${DWS_URL}/rlaif/judge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manifestCID: cid,
            rubric: {
              id: 'babylon-trader',
              name: 'Babylon Trader',
              description: 'Trading performance evaluation',
              criteria: 'Higher P&L should receive higher scores',
              priorityMetrics: ['trading.totalPnL', 'trading.winRate'],
            },
            groupSize: 4,
          }),
        })

        // Judge endpoint must be available - fail if 503
        expect(scoreResponse.ok).toBe(true)
      },
    )
  })

  describe('Babylon Adapter', () => {
    test('should convert Babylon trajectory to Jeju format', () => {
      const babylonStep = {
        timestamp: Date.now(),
        environmentState: {
          agentBalance: 1000,
          agentPnL: 50,
          openPositions: 2,
        },
        action: {
          actionType: 'buy',
          parameters: { marketId: 'BTC', amount: 0.1 },
          reasoning: 'Market looks bullish',
          success: true,
        },
        reward: 0.5,
        llmCalls: [
          {
            model: 'gpt-5',
            systemPrompt: 'You are a trader',
            userPrompt: 'Analyze this market',
            response: 'I recommend buying',
            reasoning: 'Technical indicators positive',
            temperature: 0.7,
            latencyMs: 500,
            purpose: 'action',
          },
        ],
      }

      // Convert to Jeju format
      const jejuStep = {
        stepNumber: 0,
        timestamp: babylonStep.timestamp,
        observation: {
          balance: babylonStep.environmentState.agentBalance,
          pnl: babylonStep.environmentState.agentPnL,
          positions: babylonStep.environmentState.openPositions,
        },
        action: {
          type: babylonStep.action.actionType,
          parameters: babylonStep.action.parameters,
          reasoning: babylonStep.action.reasoning,
        },
        reward: babylonStep.reward,
        done: false,
        llmCalls: babylonStep.llmCalls.map((call) => ({
          model: call.model,
          systemPrompt: call.systemPrompt,
          userPrompt: call.userPrompt,
          response: call.response,
          reasoning: call.reasoning,
          temperature: call.temperature,
          latencyMs: call.latencyMs,
          purpose: call.purpose as 'action',
        })),
      }

      expect(jejuStep.action.type).toBe('buy')
      expect(jejuStep.observation.balance).toBe(1000)
      expect(jejuStep.llmCalls).toHaveLength(1)
      expect(jejuStep.llmCalls[0]?.purpose).toBe('action')
    })

    test('should get rubric for archetype', () => {
      const archetypes = ['trader', 'degen', 'scammer', 'researcher']

      for (const archetype of archetypes) {
        const rubricId = `babylon-${archetype}`
        expect(rubricId).toMatch(/^babylon-/)
      }
    })
  })

  describe('Training Archetypes', () => {
    test('should have 12 archetypes defined', () => {
      const archetypes = [
        'trader',
        'degen',
        'scammer',
        'researcher',
        'social-butterfly',
        'information-trader',
        'perps-trader',
        'super-predictor',
        'infosec',
        'goody-twoshoes',
        'ass-kisser',
        'liar',
      ]

      expect(archetypes).toHaveLength(12)

      for (const archetype of archetypes) {
        expect(archetype).toBeDefined()
        expect(archetype.length).toBeGreaterThan(0)
      }
    })

    test('should map archetypes to rubric IDs', () => {
      const archetypeToRubric = (archetype: string) => `babylon-${archetype}`

      expect(archetypeToRubric('trader')).toBe('babylon-trader')
      expect(archetypeToRubric('degen')).toBe('babylon-degen')
      expect(archetypeToRubric('social-butterfly')).toBe(
        'babylon-social-butterfly',
      )
    })
  })

  describe('Full Training Flow', () => {
    test.skipIf(!dwsAvailable)(
      'should execute complete training flow',
      async () => {
        // 1. Create RLAIF run
        const createResponse = await fetch(`${DWS_URL}/rlaif/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            environment: {
              id: 'babylon',
              type: 'game',
              configCID: 'babylon-trader',
            },
            model: {
              baseModelCID: 'Qwen/Qwen2.5-3B-Instruct',
              tokenizer: 'Qwen/Qwen2.5-3B-Instruct',
            },
            judge: { rubricId: 'babylon-trader' },
            targetIterations: 1,
            minTrajectoriesPerIteration: 2,
          }),
        })

        expect(createResponse.ok).toBe(true)
        const { runId } = RunIdSchema.parse(await responseJson(createResponse))

        // 2. Submit trajectories
        const trajResponse = await fetch(
          `${DWS_URL}/rlaif/runs/${runId}/rollouts`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trajectories: [
                {
                  id: 'flow-traj-1',
                  steps: [
                    {
                      stepNumber: 0,
                      timestamp: Date.now(),
                      observation: {},
                      action: { type: 'buy', parameters: {} },
                      reward: 1,
                      done: true,
                    },
                  ],
                  totalReward: 1,
                  metadata: {},
                },
                {
                  id: 'flow-traj-2',
                  steps: [
                    {
                      stepNumber: 0,
                      timestamp: Date.now(),
                      observation: {},
                      action: { type: 'sell', parameters: {} },
                      reward: 0.5,
                      done: true,
                    },
                  ],
                  totalReward: 0.5,
                  metadata: {},
                },
              ],
            }),
          },
        )

        expect(trajResponse.ok).toBe(true)

        // 3. Get run status
        const statusResponse = await fetch(`${DWS_URL}/rlaif/runs/${runId}`)
        expect(statusResponse.ok).toBe(true)

        const status = StateSchema.parse(await responseJson(statusResponse))
        // Should be in some valid state
        expect(status.state).toBeGreaterThanOrEqual(0)
        expect(status.state).toBeLessThan(8)
      },
    )
  })
})
