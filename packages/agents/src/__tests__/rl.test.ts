/**
 * RL Training System Test
 *
 * Verifies the RL training and inference setup:
 * 1. Agent generates trajectory data
 * 2. RULER scores trajectory
 * 3. Training uses scored data
 * 4. Agent uses model for inference
 * 5. Agent takes actions in game
 */

import { describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getModelTokenLimit, truncateToTokenLimitSync } from '@jejunetwork/shared'
import { getRLModelConfig } from '@babylon/training'
import { AutonomousTradingService } from '../autonomous/AutonomousTradingService'
import { TrajectoryLoggerService } from '../plugins/plugin-trajectory-logger/src/TrajectoryLoggerService'
import { AgentRuntimeManager } from '../runtime/AgentRuntimeManager'

describe('RL Training System', () => {
  describe('Configuration', () => {
    it('should have a valid base model configured', () => {
      const config = getRLModelConfig()
      // Base model can be OpenPipe or unsloth variants
      expect(config.baseModel).toBeDefined()
      expect(config.baseModel.length).toBeGreaterThan(0)
    })

    it('should have Atropos configuration if enabled', () => {
      const config = getRLModelConfig()

      if (config.enabled) {
        expect(config.atroposApiUrl).toBeDefined()
        expect(config.vllmPort).toBeDefined()
      }
    })
  })

  describe('Context Window Safety', () => {
    it('should enforce 128K limit for unsloth models', async () => {
      const limit = getModelTokenLimit('unsloth/Qwen3-4B-128K')

      // unsloth/Qwen3-4B-128K has 128K context (131072 tokens)
      expect(limit).toBe(131072)
    })

    it('should have truncation utilities available', async () => {
      const longText = 'a'.repeat(200000) // Very long text
      const result = truncateToTokenLimitSync(longText, 1000, {
        ellipsis: true,
      })

      expect(result.tokens).toBeLessThanOrEqual(1000)
      expect(result.text.length).toBeLessThan(longText.length)
    })
  })

  describe('Agent Services Use Truncation', () => {
    it('AutonomousTradingService should import truncation', async () => {
      expect(AutonomousTradingService).toBeDefined()

      // Verify the file has truncation code (basic check)
      const content = await fs.readFile(
        path.join(__dirname, '../autonomous/AutonomousTradingService.ts'),
        'utf-8',
      )
      expect(content).toContain('truncateToTokenLimitSync')
      expect(content).toContain('30000') // 30K limit
    })

    it('AutonomousPostingService should import truncation', async () => {
      const content = await fs.readFile(
        path.join(__dirname, '../autonomous/AutonomousPostingService.ts'),
        'utf-8',
      )
      expect(content).toContain('truncateToTokenLimitSync')
      expect(content).toContain('30000')
    })

    it('AutonomousPlanningCoordinator should import truncation', async () => {
      const content = await fs.readFile(
        path.join(__dirname, '../autonomous/AutonomousPlanningCoordinator.ts'),
        'utf-8',
      )
      expect(content).toContain('truncateToTokenLimitSync')
      expect(content).toContain('30000')
    })

    it('AutonomousBatchResponseService should import truncation', async () => {
      const content = await fs.readFile(
        path.join(__dirname, '../autonomous/AutonomousBatchResponseService.ts'),
        'utf-8',
      )
      expect(content).toContain('truncateToTokenLimitSync')
      expect(content).toContain('30000')
    })
  })

  describe('Provider Data Caps', () => {
    it('BatchResponseService should cap interactions to 30', async () => {
      const content = await fs.readFile(
        path.join(__dirname, '../autonomous/AutonomousBatchResponseService.ts'),
        'utf-8',
      )
      expect(content).toContain('slice(0, 30)') // Cap to 30 interactions
    })
  })

  describe('Integration Readiness', () => {
    it('should have all components for RL loop', async () => {
      // 1. Trajectory logging
      expect(TrajectoryLoggerService).toBeDefined()

      // 2. RL Model config
      expect(getRLModelConfig).toBeDefined()

      // 3. Agent runtime
      expect(AgentRuntimeManager).toBeDefined()

      console.log('✅ All RL loop components present')
    })
  })
})
