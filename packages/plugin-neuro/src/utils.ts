/**
 * XML Parsing and Node Extraction Utilities
 *
 * WHY THIS MODULE EXISTS:
 * ======================
 * LLMs return XML, but XML is messy. They might return:
 * - <conversations><conversation>...</conversation></conversations>
 * - <conversation>...</conversation> (single, no wrapper)
 * - <conversations>...</conversations> (array directly)
 * - <conversationIdOrNew> or <conservationIdOrNew> (typos!)
 *
 * These utilities handle the mess so the cognitive engine doesn't have to.
 * They're battle-tested against real LLM outputs.
 */

import { toStringSafe } from './metadata.ts';

// =============================================================================
// Shared Types
// =============================================================================

/**
 * WHY ParsedNode TYPE:
 * After XML parsing, we get a tree of unknown shape. ParsedNode represents
 * "some object with string keys". We use this instead of `any` for:
 * - Type checking (can't call .foo on null)
 * - Code clarity (explicit "I don't know the shape")
 */
export type ParsedNode = Record<string, unknown>;

// =============================================================================
// XML Node Utilities
// =============================================================================

/**
 * Safely cast unknown value to a record type.
 *
 * WHY THIS FUNCTION:
 * TypeScript's `value as ParsedNode` is unsafe—it doesn't check.
 * This function actually validates the value is a non-array object.
 * Returns null for primitives, arrays, null, undefined.
 *
 * WHY EXCLUDE ARRAYS:
 * Arrays are objects in JS, but ParsedNode is for key-value structures.
 * extractNodes() handles arrays separately.
 */
export function asRecord(value: unknown): ParsedNode | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as ParsedNode;
  }
  return null;
}

/**
 * Generic node extractor for XML responses.
 *
 * WHY THIS IS COMPLEX:
 * LLMs return XML in many equivalent formats. We need to handle all of them:
 *
 * CASE 1: Direct array under plural key
 * <response><conversations>[{...}, {...}]</conversations></response>
 *
 * CASE 2: Nested structure
 * <response><conversations><conversation>{...}</conversation></conversations></response>
 *
 * CASE 3: Single item under singular key
 * <response><conversation>{...}</conversation></response>
 *
 * CASE 4: Root is the node itself (no wrapper)
 * <response>{...fields directly...}</response>
 *
 * Without this, each evaluator would need its own extraction logic.
 */
export function extractNodes(
  root: ParsedNode | null,
  singularKey: string,
  pluralKey: string
): ParsedNode[] {
  if (!root) {
    return [];
  }

  const nodes: ParsedNode[] = [];
  const pushRecord = (value: unknown) => {
    const record = asRecord(value);
    if (record) {
      nodes.push(record);
    }
  };

  // WHY TRY PLURAL FIRST: If LLM followed instructions, it used plural.
  // Fallback to singular handles "I only found one" cases.
  const container = root[pluralKey] ?? root[singularKey];

  // CASE 1: Direct array (most common correct format)
  if (Array.isArray(container)) {
    for (const item of container) {
      pushRecord(item);
    }
    return nodes;
  }

  // CASE 2 & 3: Object wrapper (might have nested array or single item)
  const containerRecord = asRecord(container);
  if (containerRecord) {
    const nested = containerRecord[singularKey];
    // CASE 2a: Nested array <conversations><conversation>[...]</conversation></conversations>
    if (Array.isArray(nested)) {
      for (const nestedItem of nested) {
        pushRecord(nestedItem);
      }
      return nodes;
    }
    // CASE 2b: Single nested <conversations><conversation>{...}</conversation></conversations>
    if (nested) {
      pushRecord(nested);
      return nodes;
    }
    // CASE 3: Container IS the node <conversation>{...}</conversation>
    pushRecord(containerRecord);
    return nodes;
  }

  // CASE 4: Root is the node (no wrapper, fields directly on root)
  // WHY LAST: This is the fallback. Only use if nothing else matched.
  pushRecord(root);
  return nodes;
}

/**
 * Extract directive value from parsed XML, trying multiple possible keys.
 *
 * WHY MULTIPLE KEYS:
 * LLMs make typos! We've seen:
 * - conversationIdOrNew (correct)
 * - conservationIdOrNew (typo)
 * - conversationId (abbreviated)
 *
 * By trying multiple keys, we're more robust to LLM variation.
 */
export function getDirective(parsed: ParsedNode, ...keys: string[]): string {
  for (const key of keys) {
    const value = toStringSafe(parsed[key]);
    if (value) {
      return value;
    }
  }
  return '';
}

/**
 * Parse a directive that may contain multiple comma-separated values.
 *
 * WHY THIS EXISTS:
 * Some directives return lists: "abc-123, def-456" (update both).
 * This normalizes various formats:
 * - "a, b, c" → ['a', 'b', 'c']
 * - "a,b,c" → ['a', 'b', 'c']
 * - "  a  ,  b  " → ['a', 'b']
 * - "" → []
 * - null/undefined → []
 */
export function parseDirectiveList(value: unknown): string[] {
  const str = toStringSafe(value);
  if (!str) return [];
  return str
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// =============================================================================
// XML Parsing
// =============================================================================

export interface ParseXmlOptions {
  arrayize?: boolean;
  includeAttributes?: boolean;
  coercePrimitives?: boolean;
}

type XmlPrimitive = string | number | boolean | null;

interface XmlContentArray extends Array<XmlContent> {}

interface XmlObject {
  [key: string]: XmlContent;
}

type XmlContent = XmlPrimitive | XmlObject | XmlContentArray;

function coerceValue(value: string, coercePrimitives: boolean): XmlPrimitive {
  if (!coercePrimitives) {
    return value;
  }
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed !== '' && Number.isFinite(Number(trimmed))) {
    return Number(trimmed);
  }
  return trimmed;
}

function isTextOnlyElement(element: Element): boolean {
  return (
    element.childNodes.length > 0 &&
    Array.from(element.childNodes).every(
      (node) =>
        node.nodeType === Node.TEXT_NODE ||
        node.nodeType === Node.CDATA_SECTION_NODE
    )
  );
}

function setNodeProperty(
  node: XmlObject,
  key: string,
  value: XmlContent,
  arrayize: boolean
): void {
  if (node[key] === undefined) {
    node[key] = value;
    return;
  }

  if (!arrayize) {
    node[key] = value;
    return;
  }

  const existing = node[key];
  if (Array.isArray(existing)) {
    existing.push(value);
    return;
  }

  node[key] = [existing, value];
}

function parseChildren(
  element: Element,
  options: Required<ParseXmlOptions>
): XmlContent {
  if (isTextOnlyElement(element)) {
    const text = element.textContent ?? '';
    return coerceValue(text, options.coercePrimitives);
  }

  const result: XmlObject = {};

  if (options.includeAttributes && element.hasAttributes()) {
    const attributes: Record<string, XmlPrimitive> = {};
    for (const attr of Array.from(element.attributes)) {
      attributes[attr.name] = coerceValue(attr.value, options.coercePrimitives);
    }
    if (Object.keys(attributes).length > 0) {
      result['@attrs'] = attributes;
    }
  }

  for (const child of Array.from(element.children)) {
    const childValue = parseChildren(child, options);
    setNodeProperty(result, child.tagName, childValue, options.arrayize);
  }

  return result;
}

function parseFlatByRegex(
  innerXml: string,
  options: Required<ParseXmlOptions>
): XmlObject | null {
  const output: XmlObject = {};
  const tagRegex = /<([A-Za-z0-9:_-]+)(\s[^>]*)?>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((match = tagRegex.exec(innerXml))) {
    const [, tagName, , body] = match;
    const nestedRegex = /<([A-Za-z0-9:_-]+)(\s[^>]*)?>([\s\S]*?)<\/\1>/;
    const hasNested = nestedRegex.test(body);
    const value = hasNested
      ? parseFlatByRegex(body, options)
      : coerceValue(body.trim(), options.coercePrimitives);

    if (value === null) {
      continue;
    }

    setNodeProperty(output, tagName, value, options.arrayize);
  }

  return Object.keys(output).length > 0 ? output : null;
}

export function parseXml(
  xml: string,
  options: ParseXmlOptions = {}
): XmlObject | null {
  if (typeof xml !== 'string' || !xml.trim()) {
    return null;
  }

  const mergedOptions: Required<ParseXmlOptions> = {
    arrayize: options.arrayize ?? true,
    includeAttributes: options.includeAttributes ?? false,
    coercePrimitives: options.coercePrimitives ?? true,
  };

  if (typeof DOMParser !== 'undefined') {
    const documentInstance = new DOMParser().parseFromString(
      xml,
      'application/xml'
    );
    if (documentInstance.getElementsByTagName('parsererror').length > 0) {
      return null;
    }

    const root = documentInstance.documentElement;
    const parsed = parseChildren(root, mergedOptions);
    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as XmlObject)
      : null;
  }

  try {
    const rootMatch = xml.match(/<([A-Za-z0-9:_-]+)[^>]*>([\s\S]*)<\/\1>/);
    if (!rootMatch) {
      return null;
    }

    return parseFlatByRegex(rootMatch[2], mergedOptions);
  } catch {
    return null;
  }
}
