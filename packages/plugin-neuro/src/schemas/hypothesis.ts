/**
 * Hypothesis Schema - Agent predictions with lifecycle tracking
 */

import { DECAY_PRESETS, getEffectiveValue } from '../dynamics/index.ts';
import { defineSchema } from '../schema.ts';

export type HypothesisStatus =
  | 'active'
  | 'testing'
  | 'confirmed'
  | 'refuted'
  | 'expired';

export const hypothesisSchema = defineSchema({
  name: 'hypothesis',
  table: 'hypotheses',
  scope: 'global',
  fields: {
    title: { type: 'string', description: 'Concise hypothesis statement' },
    summary: { type: 'string', description: 'Brief summary' },
    detail: { type: 'string', description: 'Detailed explanation' },
    status: {
      type: 'enum',
      options: ['active', 'testing', 'confirmed', 'refuted', 'expired'],
      default: 'active',
      description: 'Lifecycle status',
    },
    confidence: {
      type: 'number',
      min: 0,
      max: 100,
      description: 'Confidence level',
    },
    priority: {
      type: 'number',
      min: 1,
      max: 100,
      description: 'Priority for testing',
    },
    daysAllocated: { type: 'number', description: 'Days allocated to test' },
    tests: { type: 'array', description: 'How to test this hypothesis' },
    disprove: { type: 'array', description: 'How to disprove this hypothesis' },
    learn: { type: 'array', description: 'What we learn by testing' },
    evidence: {
      type: 'array',
      description: 'Supporting/contradicting evidence',
    },
    keywords: { type: 'array', description: 'Keywords' },
    topics: { type: 'array', description: 'Related topics' },
    who: { type: 'array', description: 'Involved entities' },
    context: { type: 'array', description: 'Related source/room/message IDs' },
    narratives: { type: 'array', description: 'Narratives this could support' },
    result: { type: 'string', description: 'Conclusion if resolved' },
  },
  prompts: {
    task: 'Analyze messages for prediction opportunities. Hypotheses are costly to test - ensure value. Track evidence for/against existing hypotheses.',
    additionalContext: '{{providers}}',
  },
  provider: {
    name: 'HYPOTHESES',
    description: 'Agent hypotheses and predictions',
    headerText: '# Active hypotheses',
    emptyText: 'No active hypotheses.\n',
  },
  hooks: {
    formatProvider: (memories, _message, _runtime) => {
      // Filter to active/testing only
      const active = memories.filter(
        (m) => m.metadata.status === 'active' || m.metadata.status === 'testing'
      );
      if (active.length === 0) return 'No active hypotheses.\n';

      // Apply decay to confidence
      const now = Date.now();
      const withEffectiveConfidence = active.map((m) => ({
        ...m,
        effectiveConfidence: getEffectiveValue(
          (m.metadata.confidence as number) || 50,
          m.createdAt || now,
          DECAY_PRESETS.standard,
          now
        ),
      }));

      // Sort by effective confidence descending
      withEffectiveConfidence.sort(
        (a, b) => b.effectiveConfidence - a.effectiveConfidence
      );

      const lines = withEffectiveConfidence.slice(0, 5).map((m) => {
        const title = m.metadata.title as string;
        const status = m.metadata.status as string;
        const conf = Math.round(m.effectiveConfidence);
        return `- [${status}] ${title} (${conf}% confidence)`;
      });

      return `# Active hypotheses\n${lines.join('\n')}\n`;
    },

    afterSave: async (runtime, memory, isNew) => {
      const logger = runtime.logger.child({ namespace: 'neuro:hypothesis' });

      if (isNew) {
        logger.info(
          {
            id: memory.id,
            title: memory.metadata.title,
          },
          'New hypothesis created'
        );
      } else {
        const status = memory.metadata.status;
        if (status === 'confirmed' || status === 'refuted') {
          logger.info(
            {
              id: memory.id,
              title: memory.metadata.title,
              status,
              result: memory.metadata.result,
            },
            'Hypothesis resolved'
          );
        }
      }
    },
  },
});
