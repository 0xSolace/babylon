import { describe, expect, it } from 'bun:test';
import {
  checkQuestionSimilarity,
  deduplicateQuestions,
  extractSignificantTokens,
  extractTemplate,
  jaccardSimilarity,
} from '@babylon/engine';

describe('extractSignificantTokens', () => {
  it('removes stop words and short tokens', () => {
    const tokens = extractSignificantTokens(
      'Will the SEC classify Bitcoin as a security?'
    );
    expect(tokens.has('will')).toBe(false);
    expect(tokens.has('the')).toBe(false);
    expect(tokens.has('sec')).toBe(true);
    expect(tokens.has('classify')).toBe(true);
    expect(tokens.has('bitcoin')).toBe(true);
    expect(tokens.has('security')).toBe(true);
  });

  it('handles parody names correctly', () => {
    const tokens = extractSignificantTokens(
      'Will AIlon Musk announce TeslAI partnership?'
    );
    expect(tokens.has('ailon')).toBe(true);
    expect(tokens.has('musk')).toBe(true);
    expect(tokens.has('teslai')).toBe(true);
    expect(tokens.has('announce')).toBe(true);
    expect(tokens.has('partnership')).toBe(true);
  });

  it('strips punctuation', () => {
    const tokens = extractSignificantTokens("What's happening with OpenAGI?!");
    expect(tokens.has('happening')).toBe(true);
    expect(tokens.has('openagi')).toBe(true);
    for (const t of tokens) {
      expect(t).toMatch(/^[a-z0-9]+$/);
    }
  });
});

describe('jaccardSimilarity', () => {
  it('returns 1 for identical sets', () => {
    const s = new Set(['foo', 'bar', 'baz']);
    expect(jaccardSimilarity(s, s)).toBe(1);
  });

  it('returns 0 for disjoint sets', () => {
    const a = new Set(['foo', 'bar']);
    const b = new Set(['baz', 'qux']);
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  it('returns correct value for partial overlap', () => {
    const a = new Set(['foo', 'bar', 'baz']);
    const b = new Set(['bar', 'baz', 'qux']);
    expect(jaccardSimilarity(a, b)).toBe(0.5);
  });

  it('returns 0 for two empty sets', () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
  });
});

describe('extractTemplate', () => {
  it('replaces known entity names with [ENTITY]', () => {
    const template = extractTemplate(
      'Will AIlon Musk announce TeslAI partnership?'
    );
    // Template uses uppercase [ENTITY] placeholders
    expect(template).toContain('[ENTITY]');
    expect(template).not.toContain('ailon musk');
    expect(template).not.toContain('teslai');
  });

  it('replaces numbers with [NUM]', () => {
    const template = extractTemplate(
      'Will NVIDAI release 5000 units by December 15?'
    );
    expect(template).toContain('[NUM]');
    expect(template).not.toMatch(/\d/);
  });

  it('replaces day names with [DAY]', () => {
    const template = extractTemplate('Will X happen by Friday?');
    expect(template).toContain('[DAY]');
    expect(template.toLowerCase()).not.toContain('friday');
  });

  it('produces identical template for entity-swapped questions', () => {
    const t1 = extractTemplate(
      'Will AIlon Musk announce a major partnership with MetAI by Friday?'
    );
    const t2 = extractTemplate(
      'Will Sam AIltman announce a major partnership with TeslAI by Friday?'
    );
    expect(t1).toBe(t2);
  });
});

describe('checkQuestionSimilarity', () => {
  it('detects near-duplicate questions (high token overlap)', () => {
    const result = checkQuestionSimilarity(
      'Will AIlon Musk deploy TeslAI to cause a 10-minute AI-activated dill dilemma at a farmer market?',
      [
        'Will AIlon Musk deploy TeslAI to stage a 12-minute AI-caused fennel feud at a farmer market?',
      ]
    );
    expect(result.isTooSimilar).toBe(true);
    expect(result.score).toBeGreaterThan(0.3);
  });

  it('allows genuinely different questions', () => {
    const result = checkQuestionSimilarity(
      'Will the SEC classify ZcAIsh as a security?',
      [
        'Will NVIDAI release a new GPU that requires a second GPU just to run the driver?',
      ]
    );
    expect(result.isTooSimilar).toBe(false);
  });

  it('detects same-template different-entity questions', () => {
    // Use real entity names from StaticDataRegistry
    const result = checkQuestionSimilarity(
      'Will Sam AIltman announce a major partnership with TeslAI by Friday?',
      ['Will AIlon Musk announce a major partnership with MetAI by Friday?']
    );
    expect(result.isTooSimilar).toBe(true);
    expect(result.reason).toContain('template');
  });

  it('allows same entity with genuinely different predicates', () => {
    const result = checkQuestionSimilarity(
      'Will AIlon Musk launch a satellite constellation for global internet?',
      ['Will AIlon Musk resign from TeslAI board of directors?']
    );
    expect(result.isTooSimilar).toBe(false);
  });

  it('returns not similar for empty existing list', () => {
    const result = checkQuestionSimilarity('Any question here', []);
    expect(result.isTooSimilar).toBe(false);
  });

  it('detects entity overlap with high token similarity', () => {
    const result = checkQuestionSimilarity(
      'Will TeslAI stock price surge above 500 dollars after the quarterly earnings call this week?',
      [
        'Will TeslAI stock price rise above 400 dollars after the quarterly earnings report this week?',
      ]
    );
    expect(result.isTooSimilar).toBe(true);
  });
});

describe('deduplicateQuestions', () => {
  it('removes duplicates from batch while keeping originals', () => {
    const result = deduplicateQuestions(
      [
        'Will AIlon Musk deploy TeslAI to cause a dill dilemma?',
        'Will AIlon Musk deploy TeslAI to stage a fennel feud?',
        'Will the SEC investigate BitcAIn manipulation?',
      ],
      []
    );
    expect(result.accepted.length).toBeGreaterThanOrEqual(2);
    expect(result.accepted).toContain(
      'Will the SEC investigate BitcAIn manipulation?'
    );
  });

  it('deduplicates within batch — first wins', () => {
    const result = deduplicateQuestions(
      [
        'Will AIlon Musk deploy TeslAI to cause a dill dilemma?',
        'Will AIlon Musk deploy TeslAI to stage a fennel feud?',
      ],
      []
    );
    expect(result.accepted.length).toBe(1);
    expect(result.accepted[0]).toContain('dill dilemma');
    expect(result.rejected.length).toBe(1);
  });

  it('deduplicates against existing questions with high overlap', () => {
    const result = deduplicateQuestions(
      [
        'Will TeslAI stock price surge above 500 dollars after the quarterly earnings call this week?',
      ],
      [
        'Will TeslAI stock price rise above 400 dollars after the quarterly earnings report this week?',
      ]
    );
    expect(result.rejected.length).toBe(1);
  });

  it('returns all when no duplicates', () => {
    const result = deduplicateQuestions(
      [
        'Will the SEC classify ZcAIsh as a security?',
        'Will NVIDAI release a new GPU architecture?',
        'Will AIlon Musk resign from TeslAI?',
      ],
      []
    );
    expect(result.accepted.length).toBe(3);
    expect(result.rejected.length).toBe(0);
  });
});

describe('Edge cases', () => {
  it('handles very short questions without crashing', () => {
    const result = checkQuestionSimilarity('Yes or no?', ['Maybe?']);
    expect(result.isTooSimilar).toBe(false);
  });

  it('handles questions with no known entities', () => {
    const result = checkQuestionSimilarity(
      'Will the weather be sunny tomorrow in an imaginary city?',
      ['Will the market crash next week due to unknown factors?']
    );
    expect(result.isTooSimilar).toBe(false);
  });

  it('handles identical questions', () => {
    const question = 'Will AIlon Musk announce TeslAI partnership?';
    const result = checkQuestionSimilarity(question, [question]);
    expect(result.isTooSimilar).toBe(true);
    expect(result.score).toBe(1);
  });

  it('handles unicode and special characters', () => {
    const result = checkQuestionSimilarity(
      'Will the price hit $1,000 (USD) — a new record?',
      ['Will the price reach €500 — another milestone?']
    );
    // Should not crash, should handle gracefully
    expect(typeof result.isTooSimilar).toBe('boolean');
  });

  it('handles single-word questions', () => {
    const tokens = extractSignificantTokens('Bitcoin?');
    expect(tokens.size).toBeGreaterThanOrEqual(1);
  });

  it('empty string produces empty token set', () => {
    const tokens = extractSignificantTokens('');
    expect(tokens.size).toBe(0);
  });

  it('deduplicateQuestions handles empty inputs', () => {
    const result = deduplicateQuestions([], []);
    expect(result.accepted.length).toBe(0);
    expect(result.rejected.length).toBe(0);
  });

  it('deduplicateQuestions handles empty new with existing', () => {
    const result = deduplicateQuestions([], ['Some existing question here']);
    expect(result.accepted.length).toBe(0);
    expect(result.rejected.length).toBe(0);
  });
});
