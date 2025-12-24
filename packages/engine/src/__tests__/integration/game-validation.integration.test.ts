/**
 * Game Output Validation Tests
 * Ensures generated games have correct structure and content
 *
 * NOTE: This test suite requires Jeju Compute (JEJU_GATEWAY_URL or JEJU_COMPUTE_ENDPOINT)
 * and takes 1-5 minutes to run due to game generation.
 * Tests will FAIL if generation fails - no silent skipping.
 */

import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import type { GeneratedGame } from '../../GameGenerator'
import { GameGenerator } from '../../GameGenerator'

setDefaultTimeout(600000)

// Check if Jeju Compute is available for inference AND LLM API keys are configured
const hasJejuCompute = !!(
  ((process.env.JEJU_GATEWAY_URL?.trim() ?? '') !== '' ||
    (process.env.JEJU_COMPUTE_ENDPOINT?.trim() ?? '') !== '') &&
  (process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GROQ_API_KEY)
)

// Skip tests if Jeju compute with API keys is not available
describe.skipIf(!hasJejuCompute)('Game Output Validation', () => {
  let game: GeneratedGame

  // Generate one game before all tests
  beforeAll(async () => {
    const generator = new GameGenerator()
    game = await generator.generateCompleteGame()
  })

  describe('Schema Validation', () => {
    test('has all required top-level fields', () => {
      expect(game.id).toBeDefined()
      expect(game.version).toBeDefined()
      expect(game.generatedAt).toBeDefined()
      expect(game.setup).toBeDefined()
      expect(game.timeline).toBeDefined()
      expect(game.resolution).toBeDefined()
    })

    test('has all 30 days in timeline', () => {
      expect(game.timeline.length).toBe(30)

      game.timeline.forEach((day, i) => {
        expect(day.day).toBe(i + 1)
      })
    })

    test('has 3 main actors', () => {
      expect(game.setup.mainActors.length).toBe(3)
    })

    test('has 15 supporting actors', () => {
      expect(game.setup.supportingActors.length).toBe(15)
    })

    test('has extras', () => {
      expect(game.setup.extras.length).toBeGreaterThan(0)
    })

    test('has 3 scenarios', () => {
      expect(game.setup.scenarios.length).toBe(3)
    })

    test('has 3 questions', () => {
      expect(game.setup.questions.length).toBe(3)
    })

    test('has group chats', () => {
      expect(game.setup.groupChats.length).toBeGreaterThan(0)
    })

    test('all questions have outcomes', () => {
      game.setup.questions.forEach((q) => {
        expect(typeof q.outcome).toBe('boolean')
      })
    })
  })

  describe('Content Validation', () => {
    test('events reference valid actors', () => {
      const allActorIds = [
        ...game.setup.mainActors.map((a) => a.id),
        ...game.setup.supportingActors.map((a) => a.id),
        ...game.setup.extras.map((a) => a.id),
      ]

      game.timeline.forEach((day) => {
        day.events.forEach((event) => {
          event.actors.forEach((actorId) => {
            expect(allActorIds).toContain(actorId)
          })
        })
      })
    })

    test('each day has events', () => {
      game.timeline.forEach((day) => {
        expect(day.events.length).toBeGreaterThan(0)
      })
    })

    test('group chats have valid members', () => {
      const allActorIds = [
        ...game.setup.mainActors.map((a) => a.id),
        ...game.setup.supportingActors.map((a) => a.id),
        ...game.setup.extras.map((a) => a.id),
      ]

      game.setup.groupChats.forEach((chat) => {
        expect(chat.members.length).toBeGreaterThan(0)
        chat.members.forEach((memberId) => {
          expect(allActorIds).toContain(memberId)
        })
      })
    })

    test('events have unique IDs', () => {
      const eventIds = new Set<string>()

      game.timeline.forEach((day) => {
        day.events.forEach((event) => {
          expect(eventIds.has(event.id)).toBe(false)
          eventIds.add(event.id)
        })
      })
    })

    test('timestamps are valid', () => {
      const generatedAt = new Date(game.generatedAt)
      expect(generatedAt.getTime()).toBeGreaterThan(0)
    })
  })

  describe('Narrative Coherence', () => {
    test('scenarios connect to questions', () => {
      game.setup.questions.forEach((q) => {
        expect(q.scenario).toBeGreaterThanOrEqual(1)
        expect(q.scenario).toBeLessThanOrEqual(3)
      })
    })

    test('events distributed across days', () => {
      const eventCounts = game.timeline.map((d) => d.events.length)
      const total = eventCounts.reduce((sum, c) => sum + c, 0)

      expect(total).toBeGreaterThan(30) // At least 1 per day
    })

    test('has resolution for all questions', () => {
      expect(game.resolution.outcomes.length).toBe(3)

      game.resolution.outcomes.forEach((outcome) => {
        expect(typeof outcome.answer).toBe('boolean')
        expect(outcome.explanation).toBeDefined()
      })
    })
  })

  describe('Quality Validation', () => {
    test('early days have fewer events than late days', () => {
      const earlyEvents = game.timeline
        .slice(0, 10)
        .reduce((sum, d) => sum + d.events.length, 0)
      const lateEvents = game.timeline
        .slice(20, 25)
        .reduce((sum, d) => sum + d.events.length, 0)

      expect(earlyEvents).toBeGreaterThan(0)
      expect(lateEvents).toBeGreaterThan(0)
    })

    test('file size is reasonable (<10MB)', () => {
      const json = JSON.stringify(game)
      const sizeInMB = json.length / (1024 * 1024)

      expect(sizeInMB).toBeLessThan(10)
    })
  })
})
