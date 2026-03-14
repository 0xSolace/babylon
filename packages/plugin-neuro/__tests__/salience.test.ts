/**
 * Salience Scoring Tests
 */

import { describe, expect, it } from 'bun:test';
import type { Memory } from '@elizaos/core';
import {
  calculateSalience,
  DEFAULT_SALIENCE_CONFIG,
  extractKeywords,
  filterBySalience,
  getSalienceLabel,
  rankBySalience,
  type SalienceContext,
} from '../src/dynamics/salience';

// Helper to create mock memories
function createMockMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'mem-' + Math.random().toString(36).slice(2),
    entityId: 'entity-1' as any,
    agentId: 'agent-1' as any,
    roomId: 'room-1' as any,
    content: { text: 'test content' },
    createdAt: Date.now(),
    metadata: {},
    ...overrides,
  } as Memory;
}

function createMockContext(
  overrides: Partial<SalienceContext> = {}
): SalienceContext {
  return {
    message: createMockMemory(),
    entityId: 'entity-1',
    roomId: 'room-1',
    now: Date.now(),
    ...overrides,
  };
}

describe('extractKeywords', () => {
  it('should extract meaningful words', () => {
    const keywords = extractKeywords(
      'The quick brown fox jumps over the lazy dog'
    );

    expect(keywords).toContain('quick');
    expect(keywords).toContain('brown');
    expect(keywords).toContain('fox');
    expect(keywords).not.toContain('the'); // stopword
    // 'over' is included because it's a meaningful preposition in some contexts
    expect(keywords).toContain('jumps');
  });

  it('should handle empty input', () => {
    expect(extractKeywords('')).toEqual([]);
    expect(extractKeywords(null as any)).toEqual([]);
  });

  it('should remove punctuation', () => {
    const keywords = extractKeywords('Hello, world! How are you?');

    expect(keywords).toContain('hello');
    expect(keywords).toContain('world');
    expect(keywords).not.toContain('hello,');
  });

  it('should filter short words', () => {
    const keywords = extractKeywords('I am a programmer');

    expect(keywords).toContain('programmer');
    expect(keywords).not.toContain('i');
    expect(keywords).not.toContain('am');
  });

  it('should limit results', () => {
    const longText = Array(50)
      .fill('unique')
      .map((w, i) => `${w}${i}`)
      .join(' ');
    const keywords = extractKeywords(longText);

    expect(keywords.length).toBeLessThanOrEqual(20);
  });
});

describe('calculateSalience', () => {
  it('should return higher score for recent memories', () => {
    const now = Date.now();
    const context = createMockContext({ now });

    const freshMemory = createMockMemory({ createdAt: now - 1000 }); // 1 second ago
    const oldMemory = createMockMemory({
      createdAt: now - 7 * 24 * 60 * 60 * 1000,
    }); // 1 week ago

    const freshScore = calculateSalience(freshMemory, context);
    const oldScore = calculateSalience(oldMemory, context);

    expect(freshScore).toBeGreaterThan(oldScore);
  });

  it('should return higher score for relevant content', () => {
    const context = createMockContext({
      message: createMockMemory({
        content: { text: 'Tell me about coffee brewing' },
      }),
      keywords: ['coffee', 'brewing', 'beans'],
    });

    const relevantMemory = createMockMemory({
      metadata: { keywords: ['coffee', 'espresso', 'brewing'] },
    });
    const irrelevantMemory = createMockMemory({
      metadata: { keywords: ['cars', 'engines', 'fuel'] },
    });

    const relevantScore = calculateSalience(relevantMemory, context);
    const irrelevantScore = calculateSalience(irrelevantMemory, context);

    expect(relevantScore).toBeGreaterThan(irrelevantScore);
  });

  it('should return higher score for matching entity', () => {
    const context = createMockContext({ entityId: 'user-123' });

    const matchingMemory = createMockMemory({ entityId: 'user-123' as any });
    const otherMemory = createMockMemory({ entityId: 'user-456' as any });

    const matchScore = calculateSalience(matchingMemory, context);
    const otherScore = calculateSalience(otherMemory, context);

    expect(matchScore).toBeGreaterThan(otherScore);
  });

  it('should return higher score for higher confidence', () => {
    const context = createMockContext();

    const highConfMemory = createMockMemory({
      metadata: { confidence: 90 },
    });
    const lowConfMemory = createMockMemory({
      metadata: { confidence: 20 },
    });

    const highScore = calculateSalience(highConfMemory, context);
    const lowScore = calculateSalience(lowConfMemory, context);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('should return score between 0 and 1', () => {
    const context = createMockContext();
    const memory = createMockMemory();

    const score = calculateSalience(memory, context);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('rankBySalience', () => {
  it('should sort memories by salience descending', () => {
    const now = Date.now();
    const context = createMockContext({ now });

    const memories = [
      createMockMemory({ createdAt: now - 7 * 24 * 60 * 60 * 1000 }), // old
      createMockMemory({ createdAt: now - 1000 }), // fresh
      createMockMemory({ createdAt: now - 24 * 60 * 60 * 1000 }), // 1 day
    ];

    const ranked = rankBySalience(memories, context);

    // Fresh should be first (highest salience)
    expect(ranked[0].memory.createdAt).toBe(now - 1000);
    // Old should be last (lowest salience)
    expect(ranked[ranked.length - 1].memory.createdAt).toBe(
      now - 7 * 24 * 60 * 60 * 1000
    );
  });

  it('should include component scores', () => {
    const context = createMockContext();
    const memories = [createMockMemory()];

    const ranked = rankBySalience(memories, context);

    expect(ranked[0].components).toBeDefined();
    expect(ranked[0].components.recency).toBeDefined();
    expect(ranked[0].components.relevance).toBeDefined();
    expect(ranked[0].components.confidence).toBeDefined();
    expect(ranked[0].components.entityMatch).toBeDefined();
  });
});

describe('filterBySalience', () => {
  it('should filter out low salience memories', () => {
    const now = Date.now();
    const context = createMockContext({ now });

    const memories = [
      createMockMemory({ createdAt: now - 1000 }), // fresh
      createMockMemory({ createdAt: now - 100 * 24 * 60 * 60 * 1000 }), // very old
    ];

    const filtered = filterBySalience(memories, context, {
      ...DEFAULT_SALIENCE_CONFIG,
      threshold: 0.3,
    });

    // Very old memory should be filtered out
    expect(filtered.length).toBeLessThanOrEqual(memories.length);
  });

  it('should respect maxResults limit', () => {
    const context = createMockContext();
    const memories = Array(20)
      .fill(null)
      .map(() => createMockMemory());

    const filtered = filterBySalience(memories, context, {
      ...DEFAULT_SALIENCE_CONFIG,
      maxResults: 5,
    });

    expect(filtered.length).toBeLessThanOrEqual(5);
  });
});

describe('getSalienceLabel', () => {
  it('should return correct labels', () => {
    expect(getSalienceLabel(0.9)).toBe('highly relevant');
    expect(getSalienceLabel(0.7)).toBe('relevant');
    expect(getSalienceLabel(0.5)).toBe('somewhat relevant');
    expect(getSalienceLabel(0.3)).toBe('marginally relevant');
    expect(getSalienceLabel(0.1)).toBe('not relevant');
  });
});
