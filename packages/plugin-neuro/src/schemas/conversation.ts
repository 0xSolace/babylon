/**
 * Conversation Schema
 *
 * Tracks conversation threads within a room.
 * Identifies topics, participants, and key takeaways.
 */

import { defineSchema } from '../schema.ts';

export const conversationSchema = defineSchema({
  name: 'conversation',
  table: 'conversations',
  scope: 'room',

  fields: {
    title: {
      type: 'string',
      description: 'What you would call this conversation thread',
    },
    summary: {
      type: 'string',
      description: 'Summary of the conversation so far',
    },
    topics: {
      type: 'array',
      description: 'Main topics discussed',
    },
    keywords: {
      type: 'array',
      description: 'Keywords for this conversation',
    },
    who: {
      type: 'array',
      description: 'Participants involved',
    },
    result: {
      type: 'string',
      description: 'Key takeaway from this thread so far',
    },
  },

  prompts: {
    task: 'Parse and organize messages into conversation threads. Identify distinct topics and track who is involved.',
  },

  provider: {
    name: 'CONVERSATIONS',
    description: 'Provides takeaways from conversations in the current room',
    headerText: '# Agent conversations',
    emptyText: 'No tracked conversations for this room.\n',
  },

  evaluator: {
    name: 'CONVERSATIONS',
    description: 'Build conversation tracking',
  },
});

export type ConversationSchemaType = typeof conversationSchema;
