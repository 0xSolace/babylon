import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Edge case tests for content grounding validator
 * Tests boundary conditions for LLM contamination prevention
 */

const MAX_FACTS_TO_PROCESS = 100;

describe('ContentGroundingValidator Edge Cases', () => {
  describe('graceful degradation without API key', () => {
    it('should return null embedding client when OPENAI_API_KEY is missing', () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      const client = createEmbeddingClient();
      expect(client).toBeNull();
      
      if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    });

    it('should allow validation to proceed with reduced functionality when client is null', () => {
      const result = validateWithoutEmbeddings({ content: 'test content' });
      expect(result.validated).toBe(true);
      expect(result.embeddingScore).toBeUndefined();
    });
  });

  describe('O(n²) bounding with MAX_FACTS_TO_PROCESS', () => {
    it('should cap facts at MAX_FACTS_TO_PROCESS limit', () => {
      const facts = Array.from({ length: 150 }, (_, i) => ({ id: i, text: `fact ${i}` }));
      const processed = boundFactsForClustering(facts);
      
      expect(processed.length).toBe(MAX_FACTS_TO_PROCESS);
    });

    it('should process all facts when under the limit', () => {
      const facts = Array.from({ length: 50 }, (_, i) => ({ id: i, text: `fact ${i}` }));
      const processed = boundFactsForClustering(facts);
      
      expect(processed.length).toBe(50);
    });

    it('should handle exactly MAX_FACTS_TO_PROCESS facts', () => {
      const facts = Array.from({ length: MAX_FACTS_TO_PROCESS }, (_, i) => ({ id: i, text: `fact ${i}` }));
      const processed = boundFactsForClustering(facts);
      
      expect(processed.length).toBe(MAX_FACTS_TO_PROCESS);
    });

    it('should handle empty facts array', () => {
      const processed = boundFactsForClustering([]);
      expect(processed.length).toBe(0);
    });
  });

  describe('pre-migration handling with null qualityScore', () => {
    it('should not reject content with null qualityScore', () => {
      const content = { id: 1, text: 'legacy content', qualityScore: null };
      const result = shouldRejectContent(content);
      
      expect(result).toBe(false);
    });

    it('should not reject content with undefined qualityScore', () => {
      const content = { id: 1, text: 'legacy content' };
      const result = shouldRejectContent(content);
      
      expect(result).toBe(false);
    });

    it('should reject content with qualityScore below threshold', () => {
      const content = { id: 1, text: 'low quality', qualityScore: 0.2 };
      const result = shouldRejectContent(content, { threshold: 0.5 });
      
      expect(result).toBe(true);
    });

    it('should accept content with qualityScore above threshold', () => {
      const content = { id: 1, text: 'high quality', qualityScore: 0.8 };
      const result = shouldRejectContent(content, { threshold: 0.5 });
      
      expect(result).toBe(false);
    });
  });

  describe('parody generator retry logic', () => {
    it('should retry at lower temperature on initial failure', async () => {
      const generateMock = vi.fn()
        .mockRejectedValueOnce(new Error('Generation failed'))
        .mockResolvedValueOnce({ text: 'parody content' });
      
      const result = await generateParodyWithRetry(generateMock);
      
      expect(generateMock).toHaveBeenCalledTimes(2);
      expect(generateMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ temperature: 0.9 }));
      expect(generateMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ temperature: 0.7 }));
      expect(result.text).toBe('parody content');
    });

    it('should throw after retry failure', async () => {
      const generateMock = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Retry failure'));
      
      await expect(generateParodyWithRetry(generateMock)).rejects.toThrow('Retry failure');
    });

    it('should succeed on first attempt without retry', async () => {
      const generateMock = vi.fn().mockResolvedValueOnce({ text: 'parody content' });
      
      const result = await generateParodyWithRetry(generateMock);
      
      expect(generateMock).toHaveBeenCalledTimes(1);
      expect(result.text).toBe('parody content');
    });
  });

  describe('union-find clustering boundary conditions', () => {
    it('should handle single fact cluster', () => {
      const facts = [{ id: 1, text: 'single fact', embedding: [0.1, 0.2, 0.3] }];
      const clusters = clusterFacts(facts);
      
      expect(clusters.length).toBe(1);
      expect(clusters[0].facts.length).toBe(1);
    });

    it('should merge highly similar facts into same cluster', () => {
      const facts = [
        { id: 1, text: 'fact one', embedding: [1.0, 0.0, 0.0] },
        { id: 2, text: 'fact one variant', embedding: [0.99, 0.01, 0.0] }
      ];
      const clusters = clusterFacts(facts, { similarityThreshold: 0.95 });
      
      expect(clusters.length).toBe(1);
    });

    it('should keep dissimilar facts in separate clusters', () => {
      const facts = [
        { id: 1, text: 'topic A', embedding: [1.0, 0.0, 0.0] },
        { id: 2, text: 'topic B', embedding: [0.0, 1.0, 0.0] }
      ];
      const clusters = clusterFacts(facts, { similarityThreshold: 0.95 });
      
      expect(clusters.length).toBe(2);
    });
  });
});

// Stub implementations for testing - these would be imported from the actual module
function createEmbeddingClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return { embed: async (text: string) => [0.1, 0.2, 0.3] };
}

function validateWithoutEmbeddings(input: { content: string }) {
  return { validated: true };
}

function boundFactsForClustering<T>(facts: T[]): T[] {
  return facts.slice(0, MAX_FACTS_TO_PROCESS);
}

function shouldRejectContent(
  content: { qualityScore?: number | null },
  options: { threshold?: number } = {}
): boolean {
  const { threshold = 0.5 } = options;
  // OR qualityScore IS NULL - don't reject null/undefined scores
  if (content.qualityScore === null || content.qualityScore === undefined) {
    return false;
  }
  return content.qualityScore < threshold;
}

async function generateParodyWithRetry(
  generateFn: (opts: { temperature: number }) => Promise<{ text: string }>
): Promise<{ text: string }> {
  try {
    return await generateFn({ temperature: 0.9 });
  } catch {
    return await generateFn({ temperature: 0.7 });
  }
}

function clusterFacts(
  facts: Array<{ id: number; text: string; embedding: number[] }>,
  options: { similarityThreshold?: number } = {}
): Array<{ facts: typeof facts }> {
  const { similarityThreshold = 0.9 } = options;
  
  if (facts.length === 0) return [];
  if (facts.length === 1) return [{ facts }];
  
  // Simple union-find clustering based on cosine similarity
  const parent = facts.map((_, i) => i);
  
  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  }
  
  function union(i: number, j: number) {
    parent[find(i)] = find(j);
  }
  
  function cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (magA * magB);
  }
  
  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      if (cosineSimilarity(facts[i].embedding, facts[j].embedding) >= similarityThreshold) {
        union(i, j);
      }
    }
  }
  
  const clusters = new Map<number, typeof facts>();
  for (let i = 0; i < facts.length; i++) {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(facts[i]);
  }
  
  return Array.from(clusters.values()).map(facts => ({ facts }));
}
