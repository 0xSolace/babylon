/**
 * XML Parser for LLM Responses
 *
 * Robust handling of XML responses that may contain reasoning text
 * before or after the actual XML content.
 */

import { parseStringPromise } from 'xml2js';

/**
 * Result type for XML parsing operations
 */
export interface XMLParseResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Strip thinking/reasoning blocks from LLM responses
 */
export function stripThinkingBlocks(text: string): string {
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .trim();
}

/**
 * Clean markdown code blocks from XML content
 */
export function cleanXMLMarkdown(text: string): string {
  return text
    .replace(/```xml\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
}

/**
 * Extract XML from text that may contain reasoning/preamble
 */
export function extractXMLFromText(text: string): string {
  const cleaned = cleanXMLMarkdown(text);

  // Known root tags to look for
  const knownTags = [
    'decisions',
    'response',
    'result',
    'output',
    'data',
    'items',
    'list',
  ];

  // Try to find known tags first
  for (const tag of knownTags) {
    const startPattern = new RegExp(`<${tag}[^>]*>`, 'i');
    const endPattern = new RegExp(`</${tag}>`, 'i');

    const startMatch = cleaned.match(startPattern);
    const endMatch = cleaned.match(endPattern);

    if (startMatch && endMatch && startMatch.index !== undefined) {
      const startIndex = startMatch.index;
      const endIndex = cleaned.lastIndexOf(`</${tag}>`);
      if (endIndex > startIndex) {
        return cleaned.slice(startIndex, endIndex + `</${tag}>`.length);
      }
    }
  }

  // Fallback: try to find any XML-like structure
  const genericXmlMatch = cleaned.match(
    /<([a-zA-Z][a-zA-Z0-9]*)[^>]*>[\s\S]*?<\/\1>/
  );
  if (genericXmlMatch) {
    return genericXmlMatch[0];
  }

  // Return original if no XML found
  return cleaned;
}

/**
 * Parse XML string to JavaScript object (returns XMLParseResult)
 * Falls back to JSON parsing if no XML found
 */
export function parseXML<T>(xmlString: string): XMLParseResult<T> {
  const extracted = extractXMLFromText(xmlString);

  // Check if input looks like JSON (no XML tags found)
  const hasXmlTag = /<[a-zA-Z][a-zA-Z0-9]*[^>]*>/.test(extracted);
  if (!hasXmlTag) {
    // Try JSON parsing as fallback
    try {
      const jsonData = JSON.parse(extracted);
      return { success: true, data: jsonData as T };
    } catch {
      return { success: false, error: 'No valid XML or JSON found' };
    }
  }

  // Use synchronous regex-based parsing for simple XML
  // (xml2js is async, but we need sync for backwards compat)
  const result = parseXMLSync<T>(extracted);
  return result;
}

/**
 * Synchronous XML parser using regex for simple structures
 */
function parseXMLSync<T>(xmlString: string): XMLParseResult<T> {
  try {
    // Extract root tag
    const rootMatch = xmlString.match(
      /<([a-zA-Z][a-zA-Z0-9]*)[^>]*>([\s\S]*)<\/\1>/
    );
    if (!rootMatch) {
      return { success: false, error: 'No valid XML root element found' };
    }

    const rootTag = rootMatch[1];
    const content = rootMatch[2];
    if (!rootTag || !content) {
      return { success: false, error: 'Invalid XML structure' };
    }

    // Parse child elements
    const childPattern = /<([a-zA-Z][a-zA-Z0-9]*)[^>]*>([\s\S]*?)<\/\1>/g;
    const children: Record<string, unknown[]> = {};

    let match: RegExpExecArray | null;
    while ((match = childPattern.exec(content)) !== null) {
      const tag = match[1];
      const text = match[2];
      if (!tag || text === undefined) continue;

      const value = text.trim();

      // Check if this is a nested structure
      if (value.includes('<')) {
        const nested = parseXMLSync(match[0]);
        if (nested.success && nested.data !== undefined) {
          if (!children[tag]) children[tag] = [];
          // Extract the inner content from nested result
          const nestedData = nested.data as Record<string, unknown>;
          const innerKey = Object.keys(nestedData)[0];
          if (innerKey) {
            children[tag].push(nestedData[innerKey]);
          }
        }
      } else {
        if (!children[tag]) children[tag] = [];
        children[tag].push(value);
      }
    }

    // Keep arrays as arrays, only flatten if single element AND not a repeated tag
    const flattened: Record<string, unknown> = {};
    for (const [key, values] of Object.entries(children)) {
      // Keep as array if more than one element
      flattened[key] = values.length === 1 ? values[0] : values;
    }

    return { success: true, data: flattened as T };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'XML parse error',
    };
  }
}

/**
 * Async XML parser using xml2js
 */
export async function parseXMLAsync<T>(
  xmlString: string
): Promise<XMLParseResult<T>> {
  try {
    const extracted = extractXMLFromText(xmlString);
    const result = await parseStringPromise(extracted, {
      explicitArray: false,
      trim: true,
      ignoreAttrs: false,
      attrkey: '@_',
    });
    return { success: true, data: result as T };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'XML parse error',
    };
  }
}

/**
 * Safely parse XML with error handling (returns null on failure)
 */
export function safeParseXML<T>(xmlString: string): T | null {
  const result = parseXML<T>(xmlString);
  return result.success ? (result.data ?? null) : null;
}
