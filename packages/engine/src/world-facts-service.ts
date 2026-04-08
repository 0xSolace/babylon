/**
 * World Facts Service
 *
 * Manages world facts that provide context for game generation.
 * Includes crypto prices, political state, AI developments, etc.
 *
 * @module services/world-facts-service
 */

import {
  deleteWorldFactById,
  fetchWorldFactByCategoryAndKey,
  fetchWorldFactById,
  insertDefaultWorldFact,
  insertDynamicWorldFact,
  listActiveWorldFactsByCreatedDesc,
  toggleWorldFactActiveById,
  updateWorldFactByIdForDefaultSet,
  updateWorldFactValueById,
  type WorldFact,
} from '@babylon/db';
import { logger } from '@babylon/shared';
import {
  buildDailyTopicPromptContext,
  dailyTopicService,
} from './services/daily-topic-service';
import { createParodyHeadlineGenerator } from './services/parody-headline-generator';
import { isSimulationMode } from './storage-bridge';

export interface WorldFactsContext {
  crypto: string;
  politics: string;
  economy: string;
  technology: string;
  general: string;
  timestamp: string;
  headlines?: string;
  dailyTopic?: string;
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
          key: 'market_state',
          label: 'Market State',
          value:
            'The crypto market is experiencing high volatility due to regulatory rumors.',
          source: 'simulation',
          priority: 1,
          isActive: true,
          lastUpdated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'sim-fact-2',
          category: 'politics',
          key: 'election_season',
          label: 'Election Season',
          value: 'Tensions are rising as the election approaches.',
          source: 'simulation',
          priority: 1,
          isActive: true,
          lastUpdated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }

    const facts = await listActiveWorldFactsByCreatedDesc(100);

    // Randomize order for entropy
    for (let i = facts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = facts[i];
      if (temp && facts[j]) {
        facts[i] = facts[j];
        facts[j] = temp;
      }
    }

    return facts;
  }

  /**
   * Get recent world facts
   */
  async getRecentFacts(limit = 100): Promise<WorldFact[]> {
    // Simulation Mode Bypass
    if (isSimulationMode()) {
      return this.getAllFacts(); // Reuse the mock above
    }

    return listActiveWorldFactsByCreatedDesc(limit);
  }

  /**
   * Add a new dynamic world fact
   */
  async addDynamicFact(value: string): Promise<WorldFact> {
    const key = this.generateKey(value);
    const label = this.generateLabel(value);

    logger.info(
      `Adding dynamic world fact: ${value}`,
      undefined,
      'WorldFactsService'
    );

    return insertDynamicWorldFact({ key, label, value });
  }

  /**
   * Get a single fact by category and key (internal use for updates)
   */
  private async getFact(
    category: string,
    key: string
  ): Promise<WorldFact | null> {
    return fetchWorldFactByCategoryAndKey(category, key);
  }

  /**
   * Generate a key from a value string (for database lookup)
   */
  private generateKey(value: string): string {
    let keyPart = (value.split(':')[0] ?? '').trim();
    if (keyPart.length > 50) {
      keyPart = (keyPart.split('.')[0] ?? '').trim();
    }
    return keyPart
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50);
  }

  /**
   * Generate a label from a value string
   */
  private generateLabel(value: string): string {
    const beforeColon = (value.split(':')[0] ?? '').trim();
    if (beforeColon.length <= 60 && beforeColon.length > 0) {
      return beforeColon;
    }
    const firstSentence = (value.split('.')[0] ?? '').trim();
    if (firstSentence.length <= 60) {
      return firstSentence;
    }
    return value.substring(0, 60).trim();
  }

  /**
   * Update or create a world fact by value (simple string)
   */
  async setFactByValue(value: string): Promise<WorldFact> {
    const defaultCategory = 'general';
    const key = this.generateKey(value);
    const label = this.generateLabel(value);

    const existing = await this.getFact(defaultCategory, key);

    if (existing) {
      return updateWorldFactByIdForDefaultSet({
        id: existing.id,
        label,
        value,
      });
    }

    return insertDefaultWorldFact({ key, label, value });
  }

  /**
   * Update an existing fact by ID
   */
  async updateFactById(id: string, value: string): Promise<WorldFact> {
    const existing = await fetchWorldFactById(id);
    if (!existing) {
      throw new Error('Fact not found');
    }

    const label = this.generateLabel(value);

    return updateWorldFactValueById({ id, label, value });
  }

  /**
   * Generate formatted context string for game generation
   * This is injected into LLM prompts for events, questions, etc.
   */
  async generateWorldContext(
    includeHeadlines = true
  ): Promise<WorldFactsContext> {
    const facts = await this.getAllFacts();
    const dailyTopic = await dailyTopicService.getCurrentTopic();

    // Format all facts (already randomized) - just use the value directly
    const formattedFacts = facts.map((f) => `- ${f.value}`).join('\n');

    // Get recent headlines if requested
    let headlinesContext;
    if (includeHeadlines) {
      const generator = createParodyHeadlineGenerator();
      headlinesContext = await generator.generateDailySummary();
    }

    return {
      crypto: formattedFacts,
      politics: formattedFacts,
      economy: formattedFacts,
      technology: formattedFacts,
      general: formattedFacts,
      timestamp: new Date().toISOString(),
      headlines: headlinesContext,
      dailyTopic: dailyTopic
        ? buildDailyTopicPromptContext(dailyTopic)
        : undefined,
    };
  }

  /**
   * Generate formatted string for injection into prompts
   */
  async generatePromptContext(): Promise<string> {
    const context = await this.generateWorldContext(true);

    return `
=== WORLD CONTEXT (Current Reality) ===
Date/Time: ${context.timestamp}

${context.dailyTopic ? `${context.dailyTopic}\n` : ''}

${context.general}

${context.headlines ? `\n${context.headlines}\n` : ''}
=========================================

This context reflects the current state of the world. Use these facts to make your content feel grounded in current reality (within our satirical universe).
`.trim();
  }

  /**
   * Delete a world fact
   */
  async deleteFact(id: string): Promise<void> {
    await deleteWorldFactById(id);
  }

  /**
   * Toggle fact active status
   */
  async toggleFactActive(id: string): Promise<WorldFact> {
    return toggleWorldFactActiveById(id);
  }

  /**
   * Bulk update facts (array of simple strings)
   */
  async bulkUpdateFacts(values: string[]): Promise<void> {
    for (const value of values) {
      await this.setFactByValue(value);
    }

    logger.info(
      `Bulk updated ${values.length} world facts`,
      { count: values.length },
      'WorldFactsService'
    );
  }
}

// Singleton instance
export const worldFactsService = new WorldFactsService();
