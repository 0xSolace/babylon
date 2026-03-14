/**
 * Narrative Schema - Story synthesis from interactions
 *
 * Synthesizes coherent narratives from conversations, patterns, and hypotheses.
 * Reduced noise by requiring minimum confidence and substance.
 */
import { defineSchema } from '../schema.ts';

export const narrativeSchema = defineSchema({
  name: 'narrative',
  table: 'narratives',
  scope: 'global',
  fields: {
    title: { type: 'string', description: 'Narrative title' },
    summary: { type: 'string', description: 'Brief summary' },
    details: { type: 'string', description: 'Detailed explanation' },
    intent: {
      type: 'string',
      description: 'What is the narrative trying to convey',
    },
    motivation: { type: 'string', description: 'Why this narrative matters' },
    confidence: {
      type: 'number',
      min: 0,
      max: 100,
      description: 'Confidence in narrative',
    },
    topics: { type: 'array', description: 'Related topics' },
    who: { type: 'array', description: 'Involved entities' },
    keywords: { type: 'array', description: 'Keywords' },
    sourceConversations: {
      type: 'ref',
      refType: 'conversation',
      multiple: true,
      description: 'Related conversations',
    },
    sourceHypotheses: {
      type: 'ref',
      refType: 'hypothesis',
      multiple: true,
      description: 'Related hypotheses',
    },
    sourcePatterns: {
      type: 'ref',
      refType: 'pattern',
      multiple: true,
      description: 'Related patterns',
    },
    result: { type: 'string', description: 'Narrative conclusion/takeaway' },
  },
  prompts: {
    task: 'Synthesize coherent narratives from conversations, patterns, and hypotheses. Only create narratives with clear intent and sufficient supporting evidence. Minimum 60% confidence required.',
    additionalContext: '{{providers}}',
    routingDirective: 'NONE', // Always create new narratives
  },
  provider: {
    name: 'NARRATIVES',
    description: 'Agent-constructed narratives',
    headerText: '# Agent narratives',
    emptyText: '',
    dynamic: false, // Only show when explicitly needed
  },
  hooks: {
    // Reduce noise: only run when there's substantial conversation history
    validate: async (runtime, message, _state) => {
      const conversationLength = runtime.getConversationLength();
      const messages = await runtime.getMemories({
        tableName: 'messages',
        roomId: message.roomId,
        count: conversationLength,
        unique: false,
      });
      // Only run if we have at least 10 messages to synthesize from
      return messages.length >= 10;
    },

    // Filter out low-confidence narratives before saving
    beforeSave: async (_runtime, memory, _isNew) => {
      const confidence = (memory.metadata.confidence as number) || 0;
      if (confidence < 60) {
        // Skip low-confidence narratives by throwing
        throw new Error('Narrative confidence too low, skipping');
      }
    },

    formatProvider: (memories, _message, _runtime) => {
      if (memories.length === 0) return '';

      // Only show high-confidence narratives
      const highConfidence = memories.filter(
        (m) => ((m.metadata.confidence as number) || 0) >= 70
      );

      if (highConfidence.length === 0) return '';

      const lines = highConfidence.slice(0, 3).map((m) => {
        const title = m.metadata.title as string;
        const summary = m.metadata.summary as string;
        return `- **${title}**: ${summary}`;
      });

      return `# Agent narratives\n${lines.join('\n')}\n`;
    },
  },
});
