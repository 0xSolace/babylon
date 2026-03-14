/**
 * Understanding Schema - Track entity's knowledge level on topics (ELI5)
 */
import { defineSchema } from '../schema.ts';

export const understandingSchema = defineSchema({
  name: 'understanding',
  table: 'understandings',
  scope: 'entity',
  fields: {
    entityId: { type: 'string', description: 'ID of the entity' },
    topic: { type: 'string', description: 'Topic or keyword' },
    level: {
      type: 'enum',
      options: ['novice', 'beginner', 'intermediate', 'advanced', 'expert'],
      description: 'Understanding level',
    },
    signals: {
      type: 'array',
      description: 'Evidence of their understanding level',
    },
    misconceptions: {
      type: 'array',
      description: 'Identified misunderstandings',
    },
  },
  prompts: {
    task: "Assess the entity's understanding level on topics. Look for signals: terminology used, questions asked, depth of discussion.",
  },
  provider: {
    name: 'UNDERSTANDING',
    description: 'Entity topic understanding levels',
    headerText: '# Entity understanding',
    emptyText: 'No understanding levels tracked.\n',
  },
  hooks: {
    formatProvider: (memories, message, _runtime) => {
      const relevant = memories.filter(
        (m) => m.metadata.entityId === message.entityId
      );
      if (relevant.length === 0) return 'Unknown understanding level.\n';

      const lines = relevant.slice(0, 5).map((m) => {
        const topic = m.metadata.topic as string;
        const level = m.metadata.level as string;
        return `- ${topic}: ${level.toUpperCase()}`;
      });

      const priming = relevant.some(
        (m) => m.metadata.level === 'novice' || m.metadata.level === 'beginner'
      )
        ? 'Use simple terms and analogies.'
        : 'Can use technical language.';

      return `# Entity understanding\n${lines.join('\n')}\nNote: ${priming}\n`;
    },
  },
});
