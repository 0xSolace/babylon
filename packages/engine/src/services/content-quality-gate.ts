/**
 * Content Quality Gate
 *
 * Validates LLM-generated content before it's written to the database.
 * Sits at the write boundary for parodyHeadlines and worldFacts — the two
 * tables whose contents propagate into every generation prompt via
 * {{worldFactsContext}} in shared-sections.ts.
 *
 * Four checks, cheapest first:
 *  1. Structure    — degenerate output (empty, too short/long, verbatim copy)
 *  2. Contamination — known bad terms (reuses isContaminated())
 *  3. Entity        — invented proper nouns not in StaticDataRegistry
 *  4. Embedding     — semantic drift between source and generated text
 */

import { logger } from '@babylon/shared';
import { cosineSimilarity, getEmbedding } from '../llm/embedding-client';
import { isContaminated } from './content-contamination-filter';
import { StaticDataRegistry } from './static-data-registry';

export interface QualityCheckResult {
  passed: boolean;
  score: number; // 0–1 composite
  reasons: string[]; // failure reasons (empty if passed)
}

/**
 * Content Quality Gate — stateless validation service.
 *
 * Methods are static because the gate has no per-instance state.
 * All data comes from StaticDataRegistry (in-memory) and the
 * embedding client (lazy-init singleton).
 */
export class ContentQualityGate {
  // ─── Public API ──────────────────────────────────────────────

  /**
   * Validate a parody headline before inserting into parodyHeadlines.
   * Runs all 4 checks including embedding similarity against the original.
   */
  static async validateParody(
    originalTitle: string,
    parodyTitle: string,
    parodyContent?: string
  ): Promise<QualityCheckResult> {
    const reasons: string[] = [];
    const scores: number[] = [];

    // 1. Structure
    const structure = this.checkStructure(parodyTitle, {
      minLength: 10,
      maxLength: 500,
      original: originalTitle,
    });
    scores.push(structure.score);
    if (!structure.passed) reasons.push(...structure.reasons);

    // 2. Contamination
    const contamination = this.checkContamination(parodyTitle);
    scores.push(contamination.score);
    if (!contamination.passed) reasons.push(...contamination.reasons);

    if (parodyContent) {
      const contentContamination = this.checkContamination(parodyContent);
      scores.push(contentContamination.score);
      if (!contentContamination.passed)
        reasons.push(...contentContamination.reasons);
    }

    // 3. Entity allowlist
    const entity = this.checkEntityAllowlist(parodyTitle);
    scores.push(entity.score);
    if (!entity.passed) reasons.push(...entity.reasons);

    // 4. Embedding similarity (original → parody)
    const embedding = await this.checkEmbeddingSimilarity(
      originalTitle,
      parodyTitle
    );
    scores.push(embedding.score);
    if (!embedding.passed) reasons.push(...embedding.reasons);

    const compositeScore =
      scores.length > 0
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length
        : 0;

    const passed = reasons.length === 0;

    if (!passed) {
      logger.warn(
        'Parody failed quality gate',
        {
          originalTitle,
          parodyTitle,
          score: compositeScore.toFixed(2),
          reasons,
        },
        'ContentQualityGate'
      );
    }

    return { passed, score: compositeScore, reasons };
  }

  /**
   * Validate a world fact before inserting into worldFacts.
   * Runs structure + contamination + entity checks (no embedding —
   * there's no single source text to compare against).
   */
  static validateWorldFact(factText: string): QualityCheckResult {
    const reasons: string[] = [];
    const scores: number[] = [];

    // 1. Structure
    const structure = this.checkStructure(factText, {
      minLength: 15,
      maxLength: 1000,
    });
    scores.push(structure.score);
    if (!structure.passed) reasons.push(...structure.reasons);

    // 2. Contamination
    const contamination = this.checkContamination(factText);
    scores.push(contamination.score);
    if (!contamination.passed) reasons.push(...contamination.reasons);

    // 3. Entity allowlist
    const entity = this.checkEntityAllowlist(factText);
    scores.push(entity.score);
    if (!entity.passed) reasons.push(...entity.reasons);

    const compositeScore =
      scores.length > 0
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length
        : 0;

    const passed = reasons.length === 0;

    if (!passed) {
      logger.warn(
        'World fact failed quality gate',
        {
          factText: factText.substring(0, 100),
          score: compositeScore.toFixed(2),
          reasons,
        },
        'ContentQualityGate'
      );
    }

    return { passed, score: compositeScore, reasons };
  }

  // ─── Individual Checks ───────────────────────────────────────

  /**
   * Check structural validity — catches degenerate LLM output.
   */
  private static checkStructure(
    text: string,
    opts: { minLength: number; maxLength: number; original?: string }
  ): { passed: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];

    const trimmed = text.trim();
    if (trimmed.length < opts.minLength) {
      reasons.push(`Too short (${trimmed.length} < ${opts.minLength})`);
    }
    if (trimmed.length > opts.maxLength) {
      reasons.push(`Too long (${trimmed.length} > ${opts.maxLength})`);
    }

    // Verbatim copy detection
    if (opts.original) {
      const normalizedOriginal = opts.original.toLowerCase().trim();
      const normalizedText = trimmed.toLowerCase();
      if (normalizedText === normalizedOriginal) {
        reasons.push('Verbatim copy of original');
      }
    }

    const score = reasons.length === 0 ? 1 : 0;
    return { passed: reasons.length === 0, score, reasons };
  }

  /**
   * Check for known contamination terms via the existing filter.
   */
  private static checkContamination(text: string): {
    passed: boolean;
    score: number;
    reasons: string[];
  } {
    const contaminated = isContaminated(text);
    return {
      passed: !contaminated,
      score: contaminated ? 0 : 1,
      reasons: contaminated ? ['Contains known contamination terms'] : [],
    };
  }

  /**
   * Check that capitalized multi-word proper nouns exist in StaticDataRegistry.
   *
   * Extracts capitalized phrases (2+ words starting with uppercase) that look
   * like proper nouns and checks them against known actor names and org names.
   * Single unknown proper nouns are allowed (common in news), but 2+ unknown
   * multi-word proper nouns suggest the LLM invented entities.
   */
  private static checkEntityAllowlist(text: string): {
    passed: boolean;
    score: number;
    reasons: string[];
  } {
    const knownNames = this.getKnownNames();

    // Match sequences of 2+ capitalized words (likely proper nouns).
    // "The market" won't match because "market" is lowercase.
    // Multi-word capitalized phrases are proper nouns regardless of position.
    const properNounPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    const matches = text.match(properNounPattern) ?? [];

    const unknownEntities: string[] = [];
    for (const match of matches) {
      const lower = match.toLowerCase();
      if (!knownNames.has(lower)) {
        unknownEntities.push(match);
      }
    }

    // Allow 1 unknown proper noun (could be a real-world reference),
    // but 2+ suggests the LLM is inventing entities
    const passed = unknownEntities.length < 2;
    const score = passed ? 1 : 0;
    const reasons =
      unknownEntities.length >= 2
        ? [
            `${unknownEntities.length} unknown entities: ${unknownEntities.slice(0, 3).join(', ')}`,
          ]
        : [];

    return { passed, score, reasons };
  }

  /**
   * Check embedding similarity between source and generated text.
   * Rejects if similarity is too low (unrelated) or too high (near-copy).
   *
   * Returns passed:true with score:1 if embeddings are unavailable
   * (missing API key) — graceful degradation, not a gate failure.
   */
  private static async checkEmbeddingSimilarity(
    source: string,
    generated: string
  ): Promise<{ passed: boolean; score: number; reasons: string[] }> {
    const [sourceEmb, generatedEmb] = await Promise.all([
      getEmbedding(source),
      getEmbedding(generated),
    ]);

    // Graceful degradation — if embeddings unavailable, pass through
    if (!sourceEmb || !generatedEmb) {
      return { passed: true, score: 1, reasons: [] };
    }

    const similarity = cosineSimilarity(sourceEmb, generatedEmb);

    const reasons: string[] = [];
    if (similarity < 0.15) {
      reasons.push(
        `Embedding similarity too low (${similarity.toFixed(3)}) — unrelated to source`
      );
    }
    if (similarity > 0.95) {
      reasons.push(
        `Embedding similarity too high (${similarity.toFixed(3)}) — near-verbatim copy`
      );
    }

    const passed = reasons.length === 0;
    // Normalize similarity to a 0-1 score within the acceptable range
    const score = passed ? similarity : 0;

    return { passed, score, reasons };
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private static knownNamesCache: Set<string> | null = null;

  /**
   * Build a lowercase set of all known actor and organization names
   * for fast entity checking. Cached after first call.
   */
  private static getKnownNames(): Set<string> {
    if (this.knownNamesCache) return this.knownNamesCache;

    const names = new Set<string>();

    for (const actor of StaticDataRegistry.getAllActors()) {
      names.add(actor.name.toLowerCase());
      if (actor.username) names.add(actor.username.toLowerCase());
      if (actor.realName) names.add(actor.realName.toLowerCase());
    }

    for (const org of StaticDataRegistry.getAllOrganizations()) {
      names.add(org.name.toLowerCase());
      if (org.originalName) names.add(org.originalName.toLowerCase());
    }

    this.knownNamesCache = names;
    return names;
  }
}
