/**
 * Tests for cross-memory relations and graph queries.
 */

import { describe, expect, it } from 'bun:test';
import type { Memory } from '@elizaos/core';
import {
  extractRefs,
  formatRelationshipMap,
  getRefFields,
  type MemoryRef,
  type RelationshipMap,
} from '../src/relations.ts';
import { type CognitiveMemorySchema, defineSchema } from '../src/schema.ts';

// =============================================================================
// Test Schemas
// =============================================================================

const taskSchema = defineSchema({
  name: 'task',
  table: 'tasks',
  scope: 'room',
  fields: {
    title: { type: 'string', description: 'Task title' },
    status: {
      type: 'enum',
      description: 'Task status',
      options: ['pending', 'done'],
    },
    parentTaskId: { type: 'ref', description: 'Parent task', refType: 'task' },
  },
  prompts: { task: 'Track tasks' },
});

const hypothesisSchema = defineSchema({
  name: 'hypothesis',
  table: 'hypotheses',
  scope: 'global',
  fields: {
    prediction: { type: 'string', description: 'What we predict' },
    confidence: { type: 'number', description: 'Confidence', min: 0, max: 100 },
    relatedPatterns: {
      type: 'ref',
      description: 'Patterns',
      refType: 'pattern',
      multiple: true,
    },
  },
  prompts: { task: 'Form hypotheses' },
});

const narrativeSchema = defineSchema({
  name: 'narrative',
  table: 'narratives',
  scope: 'global',
  fields: {
    story: { type: 'string', description: 'The narrative' },
    conversationIds: {
      type: 'ref',
      description: 'Related conversations',
      refType: 'conversation',
      multiple: true,
    },
    hypothesisId: {
      type: 'ref',
      description: 'Source hypothesis',
      refType: 'hypothesis',
    },
  },
  prompts: { task: 'Build narratives' },
});

// =============================================================================
// Test Memories
// =============================================================================

const createMemory = (
  id: string,
  type: string,
  extra: Record<string, unknown> = {}
): Memory => ({
  id: id as Memory['id'],
  entityId: 'agent-1' as Memory['entityId'],
  agentId: 'agent-1' as Memory['agentId'],
  content: {},
  roomId: 'room-1' as Memory['roomId'],
  createdAt: Date.now(),
  metadata: { type: `neuro:${type}`, ...extra },
});

// =============================================================================
// Tests: Schema Introspection
// =============================================================================

describe('getRefFields', () => {
  it('should extract ref fields from schema', () => {
    const refs = getRefFields(taskSchema);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      name: 'parentTaskId',
      refType: 'task',
      multiple: false,
    });
  });

  it('should handle multiple ref fields', () => {
    const refs = getRefFields(narrativeSchema);

    expect(refs).toHaveLength(2);
    expect(refs.find((r) => r.name === 'conversationIds')).toEqual({
      name: 'conversationIds',
      refType: 'conversation',
      multiple: true,
    });
    expect(refs.find((r) => r.name === 'hypothesisId')).toEqual({
      name: 'hypothesisId',
      refType: 'hypothesis',
      multiple: false,
    });
  });

  it('should return empty array for schema without refs', () => {
    const noRefsSchema = defineSchema({
      name: 'simple',
      table: 'simples',
      scope: 'room',
      fields: {
        name: { type: 'string', description: 'Name' },
      },
      prompts: { task: 'Simple' },
    });

    expect(getRefFields(noRefsSchema)).toHaveLength(0);
  });
});

// =============================================================================
// Tests: Reference Extraction
// =============================================================================

describe('extractRefs', () => {
  it('should extract single ref from memory', () => {
    const memory = createMemory('task-2', 'task', {
      title: 'Subtask',
      parentTaskId: 'task-1',
    });

    const refs = extractRefs(memory, taskSchema);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      field: 'parentTaskId',
      refType: 'task',
      targetIds: ['task-1'],
    });
  });

  it('should extract multiple refs from array field', () => {
    const memory = createMemory('hyp-1', 'hypothesis', {
      prediction: 'Test',
      relatedPatterns: ['pattern-1', 'pattern-2', 'pattern-3'],
    });

    const refs = extractRefs(memory, hypothesisSchema);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      field: 'relatedPatterns',
      refType: 'pattern',
      targetIds: ['pattern-1', 'pattern-2', 'pattern-3'],
    });
  });

  it('should handle memory with no ref values', () => {
    const memory = createMemory('task-1', 'task', {
      title: 'Root task',
      // no parentTaskId
    });

    const refs = extractRefs(memory, taskSchema);

    expect(refs).toHaveLength(0);
  });

  it('should handle memory with multiple ref fields', () => {
    const memory = createMemory('narr-1', 'narrative', {
      story: 'A tale',
      conversationIds: ['conv-1', 'conv-2'],
      hypothesisId: 'hyp-1',
    });

    const refs = extractRefs(memory, narrativeSchema);

    expect(refs).toHaveLength(2);
    expect(refs.find((r) => r.field === 'conversationIds')?.targetIds).toEqual([
      'conv-1',
      'conv-2',
    ]);
    expect(refs.find((r) => r.field === 'hypothesisId')?.targetIds).toEqual([
      'hyp-1',
    ]);
  });
});

// =============================================================================
// Tests: Relationship Map Formatting
// =============================================================================

describe('formatRelationshipMap', () => {
  it('should format relationship map', () => {
    const map: RelationshipMap = {
      center: createMemory('hyp-1', 'hypothesis', { prediction: 'Test' }),
      related: new Map([
        [
          'task',
          [
            createMemory('task-1', 'task', { title: 'Task 1' }),
            createMemory('task-2', 'task', { title: 'Task 2' }),
          ],
        ],
        [
          'pattern',
          [createMemory('patt-1', 'pattern', { summary: 'Pattern 1' })],
        ],
      ]),
      nodes: new Map(),
      depth: 1,
    };

    const formatted = formatRelationshipMap(map);

    expect(formatted).toContain('Relations for hypothesis');
    expect(formatted).toContain('task (2)');
    expect(formatted).toContain('pattern (1)');
  });

  it('should respect maxPerType limit', () => {
    const map: RelationshipMap = {
      center: createMemory('hyp-1', 'hypothesis', { prediction: 'Test' }),
      related: new Map([
        [
          'task',
          [
            createMemory('task-1', 'task', { title: 'Task 1' }),
            createMemory('task-2', 'task', { title: 'Task 2' }),
            createMemory('task-3', 'task', { title: 'Task 3' }),
            createMemory('task-4', 'task', { title: 'Task 4' }),
            createMemory('task-5', 'task', { title: 'Task 5' }),
          ],
        ],
      ]),
      nodes: new Map(),
      depth: 1,
    };

    const formatted = formatRelationshipMap(map, { maxPerType: 2 });

    expect(formatted).toContain('task (5)');
    expect(formatted).toContain('... and 3 more');
  });

  it('should show IDs when requested', () => {
    const map: RelationshipMap = {
      center: createMemory('hyp-123', 'hypothesis', { prediction: 'Test' }),
      related: new Map(),
      nodes: new Map(),
      depth: 1,
    };

    const formatted = formatRelationshipMap(map, { showIds: true });

    expect(formatted).toContain('ID: hyp-123');
  });
});

// =============================================================================
// Tests: Integration
// =============================================================================

describe('Integration', () => {
  it('should handle complex schema with multiple ref types', () => {
    const memory = createMemory('narr-1', 'narrative', {
      story: 'The user has been asking about crypto frequently',
      conversationIds: ['conv-1', 'conv-2', 'conv-3'],
      hypothesisId: 'hyp-1',
    });

    const refs = extractRefs(memory, narrativeSchema);

    // Should have both ref types
    expect(refs).toHaveLength(2);

    // Check conversation refs
    const convRef = refs.find((r) => r.field === 'conversationIds');
    expect(convRef?.refType).toBe('conversation');
    expect(convRef?.targetIds).toHaveLength(3);

    // Check hypothesis ref
    const hypRef = refs.find((r) => r.field === 'hypothesisId');
    expect(hypRef?.refType).toBe('hypothesis');
    expect(hypRef?.targetIds).toHaveLength(1);
  });
});
