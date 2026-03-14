/**
 * Utils Tests
 *
 * Tests XML parsing and shared utilities.
 */

import { describe, expect, it } from 'bun:test';
import {
  asRecord,
  extractNodes,
  getDirective,
  parseDirectiveList,
  parseXml,
} from '../src/utils';

describe('parseXml', () => {
  it('should parse simple XML', () => {
    const xml = '<response><title>Test</title><value>123</value></response>';
    const result = parseXml(xml);

    expect(result).toBeDefined();
    expect(result?.title).toBe('Test');
    expect(result?.value).toBe(123); // coercePrimitives is true by default
  });

  it('should parse nested XML', () => {
    const xml = `<response>
      <conversation>
        <title>Test</title>
        <topics>a, b, c</topics>
      </conversation>
    </response>`;
    const result = parseXml(xml);

    expect(result).toBeDefined();
    expect(asRecord(result?.conversation)).toBeDefined();
  });

  it('should return null for invalid XML', () => {
    const result = parseXml('<invalid>no closing tag');
    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = parseXml('');
    expect(result).toBeNull();
  });

  it('should handle arrays with arrayize option', () => {
    const xml = `<response>
      <item>one</item>
      <item>two</item>
    </response>`;
    const result = parseXml(xml, { arrayize: true });

    expect(result).toBeDefined();
    expect(Array.isArray(result?.item)).toBe(true);
    expect(result?.item).toContain('one');
    expect(result?.item).toContain('two');
  });

  it('should coerce booleans', () => {
    const xml =
      '<response><enabled>true</enabled><disabled>false</disabled></response>';
    const result = parseXml(xml, { coercePrimitives: true });

    expect(result?.enabled).toBe(true);
    expect(result?.disabled).toBe(false);
  });
});

describe('asRecord', () => {
  it('should return object as record', () => {
    const obj = { key: 'value' };
    expect(asRecord(obj)).toBe(obj);
  });

  it('should return null for non-objects', () => {
    expect(asRecord(null)).toBeNull();
    expect(asRecord(undefined)).toBeNull();
    expect(asRecord('string')).toBeNull();
    expect(asRecord(123)).toBeNull();
    expect(asRecord([])).toBeNull();
  });
});

describe('extractNodes', () => {
  it('should extract nodes from plural key', () => {
    const root = {
      conversations: [{ title: 'One' }, { title: 'Two' }],
    };
    const nodes = extractNodes(root, 'conversation', 'conversations');

    expect(nodes.length).toBe(2);
    expect(nodes[0].title).toBe('One');
    expect(nodes[1].title).toBe('Two');
  });

  it('should extract single node from singular key', () => {
    const root = {
      conversation: { title: 'Only One' },
    };
    const nodes = extractNodes(root, 'conversation', 'conversations');

    expect(nodes.length).toBe(1);
    expect(nodes[0].title).toBe('Only One');
  });

  it('should handle nested structure', () => {
    const root = {
      conversations: {
        conversation: [{ title: 'Nested One' }, { title: 'Nested Two' }],
      },
    };
    const nodes = extractNodes(root, 'conversation', 'conversations');

    expect(nodes.length).toBe(2);
  });

  it('should return empty array for null root', () => {
    const nodes = extractNodes(null, 'item', 'items');
    expect(nodes.length).toBe(0);
  });

  it('should fallback to root itself', () => {
    const root = { title: 'Root itself' };
    const nodes = extractNodes(root, 'conversation', 'conversations');

    expect(nodes.length).toBe(1);
    expect(nodes[0].title).toBe('Root itself');
  });
});

describe('getDirective', () => {
  it('should extract directive from first matching key', () => {
    const parsed = {
      conversationIdOrNew: 'new',
      conversationId: 'some-id',
    };
    const directive = getDirective(
      parsed,
      'conversationIdOrNew',
      'conversationId'
    );

    expect(directive).toBe('new');
  });

  it('should fallback to second key', () => {
    const parsed = {
      conversationId: 'some-id',
    };
    const directive = getDirective(
      parsed,
      'conversationIdOrNew',
      'conversationId'
    );

    expect(directive).toBe('some-id');
  });

  it('should return empty string if no keys match', () => {
    const parsed = { unrelated: 'value' };
    const directive = getDirective(parsed, 'key1', 'key2');

    expect(directive).toBe('');
  });
});

describe('parseDirectiveList', () => {
  it('should parse comma-separated values', () => {
    const result = parseDirectiveList('a, b, c');

    expect(result.length).toBe(3);
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).toContain('c');
  });

  it('should trim whitespace', () => {
    const result = parseDirectiveList('  foo  ,  bar  ');

    expect(result).toEqual(['foo', 'bar']);
  });

  it('should filter empty values', () => {
    const result = parseDirectiveList('a,,b,');

    expect(result.length).toBe(2);
  });

  it('should handle single value', () => {
    const result = parseDirectiveList('single');

    expect(result).toEqual(['single']);
  });

  it('should return empty array for empty input', () => {
    expect(parseDirectiveList('')).toEqual([]);
    expect(parseDirectiveList(null)).toEqual([]);
    expect(parseDirectiveList(undefined)).toEqual([]);
  });
});
