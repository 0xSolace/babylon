/**
 * Cognitive Memory Engine Integration Tests
 *
 * Tests the core engine functionality:
 * - Schema definition and validation
 * - Metadata type inference
 * - Type guards
 */

import { describe, expect, it } from 'bun:test';
import { createCognitiveMemory } from '../src/cognitive';
import {
  type CognitiveMemorySchema,
  defineSchema,
  getMetadataType,
  isMemoryOfType,
} from '../src/schema';
import { conversationSchema, cultureSchema } from '../src/schemas/index';

describe('Schema Definition', () => {
  it('should create a valid schema with defineSchema', () => {
    const schema = defineSchema({
      name: 'test',
      table: 'tests',
      scope: 'room',
      fields: {
        title: { type: 'string', description: 'Test title' },
        score: { type: 'number', min: 0, max: 100, description: 'Test score' },
      },
      prompts: {
        task: 'Test task',
      },
    });

    expect(schema.name).toBe('test');
    expect(schema.table).toBe('tests');
    expect(schema.scope).toBe('room');
    expect(Object.keys(schema.fields)).toContain('title');
    expect(Object.keys(schema.fields)).toContain('score');
  });

  it('should generate correct metadata type key', () => {
    const type = getMetadataType(conversationSchema);
    expect(type).toBe('neuro:conversation');
  });

  it('should generate correct metadata type for culture schema', () => {
    const type = getMetadataType(cultureSchema);
    expect(type).toBe('neuro:culture');
  });
});

describe('Type Guards', () => {
  it('should identify memory of correct type', () => {
    const memory = {
      id: 'test-id',
      entityId: 'entity-id',
      agentId: 'agent-id',
      roomId: 'room-id',
      content: {},
      metadata: {
        type: 'neuro:conversation',
        title: 'Test',
        summary: 'Test summary',
      },
    };

    expect(isMemoryOfType(memory as any, conversationSchema)).toBe(true);
    expect(isMemoryOfType(memory as any, cultureSchema)).toBe(false);
  });

  it('should reject memory with wrong type', () => {
    const memory = {
      id: 'test-id',
      entityId: 'entity-id',
      agentId: 'agent-id',
      roomId: 'room-id',
      content: {},
      metadata: {
        type: 'neuro:culture',
        terminology: ['test'],
        tone: 'casual',
      },
    };

    expect(isMemoryOfType(memory as any, conversationSchema)).toBe(false);
    expect(isMemoryOfType(memory as any, cultureSchema)).toBe(true);
  });

  it('should reject memory without metadata type', () => {
    const memory = {
      id: 'test-id',
      entityId: 'entity-id',
      agentId: 'agent-id',
      roomId: 'room-id',
      content: {},
      metadata: {},
    };

    expect(isMemoryOfType(memory as any, conversationSchema)).toBe(false);
  });
});

describe('createCognitiveMemory', () => {
  it('should create evaluator and provider from schema', () => {
    const result = createCognitiveMemory(conversationSchema);

    expect(result.evaluator).toBeDefined();
    expect(result.evaluator.name).toBe('CONVERSATIONS');
    expect(result.provider).toBeDefined();
    expect(result.provider.name).toBe('CONVERSATIONS');
    expect(result.metadataType).toBe('neuro:conversation');
    expect(result.typeGuard).toBeInstanceOf(Function);
  });

  it('should use custom evaluator/provider names if specified', () => {
    const schema = defineSchema({
      name: 'custom',
      table: 'customs',
      scope: 'global',
      fields: {
        value: { type: 'string', description: 'Value' },
      },
      prompts: { task: 'Task' },
      evaluator: { name: 'MY_CUSTOM_EVALUATOR', description: 'Custom eval' },
      provider: { name: 'MY_CUSTOM_PROVIDER', description: 'Custom prov' },
    });

    const result = createCognitiveMemory(schema);
    expect(result.evaluator.name).toBe('MY_CUSTOM_EVALUATOR');
    expect(result.provider.name).toBe('MY_CUSTOM_PROVIDER');
  });
});
