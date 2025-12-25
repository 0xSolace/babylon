/**
 * World Facts Service
 *
 * Manages world facts that provide context for game generation.
 * Includes crypto prices, political state, AI developments, etc.
 *
 * Uses the typed CQL repository pattern (db.worldFact) for strong typing.
 *
 * @module services/world-facts-service
 */

import type { WorldFact } from '@babylon/db'
import { db } from '@babylon/db'
import { logger } from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { createParodyHeadlineGenerator } from './services/parody-headline-generator'
import { isSimulationMode } from './storage-bridge'

export interface WorldFactsContext {
  crypto: string
  politics: string
  economy: string
  technology: string
  general: string
  timestamp: string
  headlines?: string
}

/**
 * World Facts Service
 * Provides context about the world state for game generation
 */
export class WorldFactsService {
  /**
   * Get all active world facts in randomized order for entropy
   * Limits to the 100 most recent facts
   */
  async getAllFacts(): Promise<WorldFact[]> {
    // Simulation Mode Bypass
    if (isSimulationMode()) {
      return [
        {
          id: 'sim-fact-1',
          category: 'general',
          fact: 'The crypto market is experiencing high volatility due to regulatory rumors.',
          source: 'simulation',
          createdAt: new Date(),
          verifiedAt: new Date(),
          metadata: null,
        },
        {
          id: 'sim-fact-2',
          category: 'politics',
          fact: 'Tensions are rising as the election approaches.',
          source: 'simulation',
          createdAt: new Date(),
          verifiedAt: new Date(),
          metadata: null,
        },
      ]
    }

    // Use typed repository for strong typing
    const facts = await db.worldFact.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Randomize order for entropy
    for (let i = facts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = facts[i]
      if (temp && facts[j]) {
        facts[i] = facts[j]
        facts[j] = temp
      }
    }

    return facts
  }

  /**
   * Get recent world facts
   */
  async getRecentFacts(limit = 100): Promise<WorldFact[]> {
    // Simulation Mode Bypass
    if (isSimulationMode()) {
      return this.getAllFacts() // Reuse the mock above
    }

    return db.worldFact.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  /**
   * Add a new dynamic world fact
   */
  async addDynamicFact(factText: string): Promise<WorldFact> {
    logger.info(
      `Adding dynamic world fact: ${factText}`,
      undefined,
      'WorldFactsService',
    )

    return db.worldFact.create({
      data: {
        id: await generateSnowflakeId(),
        category: 'general',
        fact: factText,
        source: 'dynamic',
      },
    })
  }

  /**
   * Get a single fact by ID
   */
  private async getFactById(id: string): Promise<WorldFact | null> {
    return db.worldFact.findUnique({
      where: { id },
    })
  }

  /**
   * Update or create a world fact by fact text (simple string)
   */
  async setFactByValue(factText: string): Promise<WorldFact> {
    return db.worldFact.create({
      data: {
        id: await generateSnowflakeId(),
        category: 'general',
        fact: factText,
        source: 'default',
      },
    })
  }

  /**
   * Update an existing fact by ID
   */
  async updateFactById(id: string, factText: string): Promise<WorldFact> {
    const existing = await this.getFactById(id)
    if (!existing) {
      throw new Error('Fact not found')
    }

    return db.worldFact.update({
      where: { id },
      data: { fact: factText },
    })
  }

  /**
   * Generate formatted context string for game generation
   * This is injected into LLM prompts for events, questions, etc.
   */
  async generateWorldContext(
    includeHeadlines = true,
  ): Promise<WorldFactsContext> {
    const facts = await this.getAllFacts()

    // Format all facts (already randomized) - just use the fact directly
    const formattedFacts = facts.map((f) => `- ${f.fact}`).join('\n')

    // Get recent headlines if requested
    let headlinesContext: string | undefined
    if (includeHeadlines) {
      const generator = createParodyHeadlineGenerator()
      // Generate summary from facts as events
      const events = facts.slice(0, 5).map((f) => f.fact)
      headlinesContext = await generator.generateDailySummary(events)
    }

    return {
      crypto: formattedFacts,
      politics: formattedFacts,
      economy: formattedFacts,
      technology: formattedFacts,
      general: formattedFacts,
      timestamp: new Date().toISOString(),
      headlines: headlinesContext,
    }
  }

  /**
   * Generate formatted string for injection into prompts
   */
  async generatePromptContext(): Promise<string> {
    const context = await this.generateWorldContext(true)

    return `
=== WORLD CONTEXT (Current Reality) ===
Date/Time: ${context.timestamp}

${context.general}

${context.headlines ? `\n${context.headlines}\n` : ''}
=========================================

This context reflects the current state of the world. Use these facts to make your content feel grounded in current reality (within our satirical universe).
`.trim()
  }

  /**
   * Delete a world fact
   */
  async deleteFact(id: string): Promise<void> {
    await db.worldFact.delete({ where: { id } })
  }

  /**
   * Toggle fact verified status (marks as verified/unverified)
   */
  async toggleFactVerified(id: string): Promise<WorldFact> {
    const fact = await this.getFactById(id)
    if (!fact) throw new Error('Fact not found')

    const newVerifiedAt = fact.verifiedAt ? null : new Date()

    return db.worldFact.update({
      where: { id },
      data: { verifiedAt: newVerifiedAt },
    })
  }

  /**
   * Bulk update facts (array of simple strings)
   */
  async bulkUpdateFacts(values: string[]): Promise<void> {
    for (const value of values) {
      await this.setFactByValue(value)
    }

    logger.info(
      `Bulk updated ${values.length} world facts`,
      { count: values.length },
      'WorldFactsService',
    )
  }
}

// Singleton instance
export const worldFactsService = new WorldFactsService()
