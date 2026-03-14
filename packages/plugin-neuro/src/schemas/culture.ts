/**
 * Culture Schema - Room language, terminology, and subculture tracking
 */
import { defineSchema } from '../schema.ts';

export const cultureSchema = defineSchema({
  name: 'culture',
  table: 'cultures',
  scope: 'room',
  fields: {
    terminology: {
      type: 'array',
      description: 'Unique terms, slang, or jargon used',
    },
    tone: {
      type: 'enum',
      options: ['formal', 'casual', 'technical', 'playful', 'serious'],
      description: 'Communication tone',
    },
    subcultures: {
      type: 'array',
      description: 'Communities/interest groups (e.g., crypto, gaming)',
    },
    norms: { type: 'array', description: 'Behavioral norms or expectations' },
    taboos: { type: 'array', description: 'Unwelcome topics or behaviors' },
  },
  prompts: {
    task: 'Analyze communication patterns to identify cultural characteristics: terminology, tone, subcultures, norms, and taboos.',
  },
  provider: {
    name: 'CULTURE',
    description: 'Room culture and communication style',
    headerText: '# Room culture',
    emptyText: 'No cultural patterns detected.\n',
  },
});
