/**
 * JSON Continuation Parser
 *
 * Handles parsing of potentially incomplete JSON from LLM responses,
 * attempting to repair and complete truncated JSON structures.
 */

/**
 * Clean markdown code blocks from text
 */
export function cleanMarkdownCodeBlocks(text: string): string {
  return text
    .replace(/```json\n?/g, '')
    .replace(/```xml\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
}

/**
 * Extract JSON from text that may contain other content (lowercase alias)
 */
export function extractJsonFromText(text: string): string {
  return extractJSONFromText(text)
}

/**
 * Parse continuation content from LLM responses
 */
export function parseContinuationContent<T>(text: string): T | null {
  const cleaned = cleanMarkdownCodeBlocks(text)
  return cleanAndParseJSON<T>(cleaned)
}

/**
 * Attempt to parse potentially incomplete JSON
 */
export function parseIncompleteJSON<T>(jsonString: string): T | null {
  // First try standard parse
  try {
    return JSON.parse(jsonString) as T
  } catch {
    // Continue to repair attempts
  }

  // Clean markdown code blocks
  let cleaned = jsonString
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  // Try again after cleaning
  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Continue to repair attempts
  }

  // Try to repair common truncation issues
  cleaned = repairTruncatedJSON(cleaned)

  try {
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}

/**
 * Repair truncated JSON by closing open brackets/braces
 */
function repairTruncatedJSON(json: string): string {
  let repaired = json.trim()

  // Remove trailing commas
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1')
  repaired = repaired.replace(/,\s*$/g, '')

  // Count open brackets and braces
  let openBraces = 0
  let openBrackets = 0
  let inString = false
  let escaped = false

  for (const char of repaired) {
    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"' && !escaped) {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') openBraces++
    else if (char === '}') openBraces--
    else if (char === '[') openBrackets++
    else if (char === ']') openBrackets--
  }

  // Close unclosed structures
  // If we're in a string, close it
  if (inString) {
    repaired += '"'
  }

  // Close brackets and braces
  while (openBrackets > 0) {
    repaired += ']'
    openBrackets--
  }
  while (openBraces > 0) {
    repaired += '}'
    openBraces--
  }

  return repaired
}

/**
 * Extract JSON from text that may contain other content
 */
export function extractJSONFromText(text: string): string {
  // Find the first { or [
  const objectStart = text.indexOf('{')
  const arrayStart = text.indexOf('[')

  let startIndex: number
  if (objectStart === -1) {
    startIndex = arrayStart
  } else if (arrayStart === -1) {
    startIndex = objectStart
  } else {
    startIndex = Math.min(objectStart, arrayStart)
  }

  if (startIndex === -1) {
    return text
  }

  // Extract from start to end
  const extracted = text.slice(startIndex)

  // Try to find the matching end bracket/brace
  const isArray = extracted[0] === '['
  const endChar = isArray ? ']' : '}'

  // Find the last occurrence of the end character
  const endIndex = extracted.lastIndexOf(endChar)
  if (endIndex === -1) {
    return extracted
  }

  return extracted.slice(0, endIndex + 1)
}

/**
 * Clean and parse JSON from LLM response
 */
export function cleanAndParseJSON<T>(text: string): T | null {
  const extracted = extractJSONFromText(text)
  return parseIncompleteJSON<T>(extracted)
}
