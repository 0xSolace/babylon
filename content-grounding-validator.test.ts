import { describe, it, expect, beforeEach } from 'vitest';
import { ContentGroundingValidator } from './content-grounding-validator';

describe('ContentGroundingValidator', () => {
  let validator: ContentGroundingValidator;

  beforeEach(() => {
    validator = new ContentGroundingValidator();
  });

  describe('validate', () => {
    it('should accept content grounded in source facts', () => {
      const sourceFacts = [
        'The capital of France is Paris.',
        'Paris has a population of 2.1 million.',
      ];
      const content = 'Paris is the capital of France with about 2.1 million residents.';

      const result = validator.validate(content, sourceFacts);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.7);
    });

    it('should reject content with ungrounded claims', () => {
      const sourceFacts = ['The capital of France is Paris.'];
      const content = 'Paris is the capital of France and has the best cuisine in the world.';

      const result = validator.validate(content, sourceFacts);

      expect(result.isValid).toBe(false);
      expect(result.ungroundedClaims).toContain('has the best cuisine in the world');
    });

    it('should return valid for empty content', () => {
      const sourceFacts = ['Some fact.'];
      const content = '';

      const result = validator.validate(content, sourceFacts);

      expect(result.isValid).toBe(true);
    });

    it('should handle multiple source facts', () => {
      const sourceFacts = [
        'Water boils at 100 degrees Celsius.',
        'Water freezes at 0 degrees Celsius.',
        'Water is composed of hydrogen and oxygen.',
      ];
      const content = 'Water boils at 100°C and freezes at 0°C. It contains hydrogen and oxygen.';

      const result = validator.validate(content, sourceFacts);

      expect(result.isValid).toBe(true);
      expect(result.groundedClaims.length).toBeGreaterThan(0);
    });
  });

  describe('extractClaims', () => {
    it('should extract individual claims from content', () => {
      const content = 'The sky is blue. Grass is green. Water is wet.';

      const claims = validator.extractClaims(content);

      expect(claims).toHaveLength(3);
      expect(claims).toContain('The sky is blue');
      expect(claims).toContain('Grass is green');
      expect(claims).toContain('Water is wet');
    });

    it('should handle content with no clear claims', () => {
      const content = 'Hello world';

      const claims = validator.extractClaims(content);

      expect(Array.isArray(claims)).toBe(true);
    });
  });

  describe('checkCoherence', () => {
    it('should detect coherent content', () => {
      const content = 'Paris is in France. France is in Europe. European countries share borders.';

      const result = validator.checkCoherence(content);

      expect(result.isCoherent).toBe(true);
      expect(result.coherenceScore).toBeGreaterThan(0.5);
    });

    it('should detect contradictory statements', () => {
      const content = 'The door is open. The door is closed.';

      const result = validator.checkCoherence(content);

      expect(result.isCoherent).toBe(false);
      expect(result.contradictions).toHaveLength(1);
    });
  });

  describe('detectEntities', () => {
    it('should detect named entities in content', () => {
      const content = 'John Smith works at Google in New York.';

      const entities = validator.detectEntities(content);

      expect(entities).toContainEqual(expect.objectContaining({ name: 'John Smith', type: 'person' }));
      expect(entities).toContainEqual(expect.objectContaining({ name: 'Google', type: 'organization' }));
      expect(entities).toContainEqual(expect.objectContaining({ name: 'New York', type: 'location' }));
    });

    it('should return empty array for content without entities', () => {
      const content = 'This is a simple sentence.';

      const entities = validator.detectEntities(content);

      expect(Array.isArray(entities)).toBe(true);
    });
  });

  describe('filterUngrounded', () => {
    it('should filter out ungrounded content', () => {
      const sourceFacts = ['Apples are red.', 'Bananas are yellow.'];
      const contents = [
        'Apples are red fruits.',
        'Oranges are the best fruit.',
        'Bananas are yellow.',
      ];

      const filtered = validator.filterUngrounded(contents, sourceFacts);

      expect(filtered).toContain('Apples are red fruits.');
      expect(filtered).toContain('Bananas are yellow.');
      expect(filtered).not.toContain('Oranges are the best fruit.');
    });

    it('should return empty array when all content is ungrounded', () => {
      const sourceFacts = ['The earth is round.'];
      const contents = ['Pizza is delicious.', 'Music is fun.'];

      const filtered = validator.filterUngrounded(contents, sourceFacts);

      expect(filtered).toHaveLength(0);
    });
  });
});
