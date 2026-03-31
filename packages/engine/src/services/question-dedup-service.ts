/**
 * Question Deduplication Service
 *
 * Structural similarity checking for prediction market questions.
 * Prevents the LLM from generating near-duplicate questions that
 * prompt-only anti-repetition rules fail to catch.
 *
 * Uses multi-layer comparison:
 * 1. Entity overlap — shared actors/organizations
 * 2. Token Jaccard similarity — significant word overlap
 * 3. Template detection — same sentence scaffold with swapped nouns
 */

import { logger } from '@babylon/shared';
import { StaticDataRegistry } from './static-data-registry';

// Words that don't contribute to question meaning
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'will',
  'be',
  'been',
  'by',
  'to',
  'of',
  'in',
  'for',
  'and',
  'or',
  'on',
  'at',
  'it',
  'its',
  'as',
  'if',
  'do',
  'does',
  'did',
  'has',
  'have',
  'had',
  'not',
  'no',
  'but',
  'that',
  'this',
  'with',
  'from',
  'they',
  'them',
  'their',
  'what',
  'which',
  'who',
  'whom',
  'how',
  'when',
  'where',
  'why',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'than',
  'too',
  'very',
  'can',
  'could',
  'may',
  'might',
  'must',
  'shall',
  'should',
  'would',
  'about',
  'above',
  'after',
  'again',
  'before',
  'below',
  'between',
  'during',
  'into',
  'through',
  'under',
  'until',
  'while',
  'just',
  'also',
  'over',
  'only',
  'then',
  'here',
  'there',
  'once',
  'any',
  'new',
]);

// Similarity thresholds
const JACCARD_THRESHOLD = 0.45;
// Entity overlap alone is not enough — need substantial token overlap too.
// Raised to 0.40 to avoid false positives on questions with same subject
// but different predicates (e.g., "Will X announce Y?" vs "Will X resign from Z?")
const ENTITY_OVERLAP_WITH_JACCARD_THRESHOLD = 0.4;

/**
 * Extract significant tokens from a question text.
 * Removes stop words, lowercases, strips punctuation, filters short tokens.
 */
export function extractSignificantTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
  );
}

/**
 * Extract entity names (actors and organizations) mentioned in text.
 * Uses StaticDataRegistry for known entity matching.
 */
export function extractQuestionEntities(text: string): Set<string> {
  const lower = text.toLowerCase();
  const entities = new Set<string>();

  for (const actor of StaticDataRegistry.getAllActors()) {
    if (lower.includes(actor.name.toLowerCase())) {
      entities.add(actor.id);
    }
  }

  for (const org of StaticDataRegistry.getAllOrganizations()) {
    if (lower.includes(org.name.toLowerCase())) {
      entities.add(org.id);
    }
  }

  return entities;
}

/**
 * Compute Jaccard similarity between two token sets.
 * Returns 0-1 where 1 means identical sets.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Extract a structural template by replacing entity names with placeholders.
 * "Will AIlon Musk announce TeslAI partnership?" → "will [ENTITY] announce [ENTITY] partnership"
 */
export function extractTemplate(text: string): string {
  let template = text.toLowerCase();

  // Replace known actor and org names with [ENTITY]
  for (const actor of StaticDataRegistry.getAllActors()) {
    const name = actor.name.toLowerCase();
    if (template.includes(name)) {
      template = template.replaceAll(name, '[ENTITY]');
    }
  }

  for (const org of StaticDataRegistry.getAllOrganizations()) {
    const name = org.name.toLowerCase();
    if (template.includes(name)) {
      template = template.replaceAll(name, '[ENTITY]');
    }
  }

  // Normalize numbers and time references
  template = template.replace(/\d+/g, '[NUM]');
  template = template.replace(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    '[DAY]'
  );
  template = template.replace(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
    '[MONTH]'
  );

  // Collapse whitespace
  template = template.replace(/\s+/g, ' ').trim();

  return template;
}

export interface SimilarityResult {
  isTooSimilar: boolean;
  score: number;
  reason: string;
  matchedQuestionText?: string;
}

/**
 * Check if a new question is too similar to any existing question.
 * Returns the first match found, or a "not similar" result.
 */
export function checkQuestionSimilarity(
  newQuestion: string,
  existingQuestions: string[]
): SimilarityResult {
  if (existingQuestions.length === 0) {
    return { isTooSimilar: false, score: 0, reason: 'no existing questions' };
  }

  const newTokens = extractSignificantTokens(newQuestion);
  const newEntities = extractQuestionEntities(newQuestion);
  const newTemplate = extractTemplate(newQuestion);

  for (const existing of existingQuestions) {
    const existingTokens = extractSignificantTokens(existing);
    const existingEntities = extractQuestionEntities(existing);

    // Layer 1: Token Jaccard similarity
    const jaccard = jaccardSimilarity(newTokens, existingTokens);

    if (jaccard >= JACCARD_THRESHOLD) {
      return {
        isTooSimilar: true,
        score: jaccard,
        reason: `token similarity ${(jaccard * 100).toFixed(0)}% exceeds ${JACCARD_THRESHOLD * 100}% threshold`,
        matchedQuestionText: existing,
      };
    }

    // Layer 2: Entity overlap + moderate Jaccard
    // If questions share entities AND have moderate token overlap, they're likely duplicates
    if (newEntities.size > 0 && existingEntities.size > 0) {
      const entityOverlap = jaccardSimilarity(newEntities, existingEntities);
      if (
        entityOverlap >= 0.5 &&
        jaccard >= ENTITY_OVERLAP_WITH_JACCARD_THRESHOLD
      ) {
        return {
          isTooSimilar: true,
          score: jaccard,
          reason: `shared entities (${(entityOverlap * 100).toFixed(0)}% overlap) with ${(jaccard * 100).toFixed(0)}% token similarity`,
          matchedQuestionText: existing,
        };
      }
    }

    // Layer 3: Template detection
    // If the structural template is identical (same scaffold, different entity/number slots)
    const existingTemplate = extractTemplate(existing);
    if (
      newTemplate === existingTemplate &&
      newTemplate.includes('[ENTITY]') &&
      newTemplate.length > 20
    ) {
      return {
        isTooSimilar: true,
        score: 1.0,
        reason: 'identical question template with different entities/numbers',
        matchedQuestionText: existing,
      };
    }
  }

  return {
    isTooSimilar: false,
    score: 0,
    reason: 'no similar questions found',
  };
}

/**
 * Filter a batch of new questions, removing those too similar to existing
 * or to each other within the batch.
 */
export function deduplicateQuestions(
  newQuestions: string[],
  existingQuestions: string[]
): { accepted: string[]; rejected: Array<{ text: string; reason: string }> } {
  const accepted: string[] = [];
  const rejected: Array<{ text: string; reason: string }> = [];

  // Include existing + already-accepted questions in the comparison set
  const comparisonSet = [...existingQuestions];

  for (const question of newQuestions) {
    const result = checkQuestionSimilarity(question, comparisonSet);

    if (result.isTooSimilar) {
      rejected.push({
        text: question,
        reason: result.reason,
      });
      logger.debug(
        'Question rejected by dedup',
        {
          question: question.substring(0, 80),
          reason: result.reason,
          score: result.score,
          matchedWith: result.matchedQuestionText?.substring(0, 80),
        },
        'QuestionDedup'
      );
    } else {
      accepted.push(question);
      comparisonSet.push(question);
    }
  }

  if (rejected.length > 0) {
    logger.info(
      'Question dedup results',
      {
        total: newQuestions.length,
        accepted: accepted.length,
        rejected: rejected.length,
      },
      'QuestionDedup'
    );
  }

  return { accepted, rejected };
}
