/**
 * Content Contamination Filter
 *
 * Detects and filters contaminated content from the narrative pipeline.
 * Prevents self-reinforcing loops where LLM-generated nonsense terms
 * (e.g. "burp-powered", "12D oscillator", "cumin seed") propagate
 * through question → context → question feedback cycles.
 */

/**
 * Known contamination terms that should never appear in generated content.
 * These originated from 2 parody headlines on Feb 5, 2026 and spiraled
 * into 100k+ contaminated posts through the narrative feedback loop.
 */
const CONTAMINATION_TERMS: readonly string[] = [
  // Core contamination terms
  'burp',
  'burps',
  'burping',
  'burp-powered',
  'burp-fueled',
  'burp-augmented',
  'burp-based',
  'oscillator',
  'oscillators',

  // Spice/food terms used as nonsense modifiers
  'cumin',
  'dill',
  'thyme',
  'basil',
  'sumac',
  'tamarind',
  'okra',
  'turmeric',
  'cinnamon',
  'cardamom',
  'saffron',
  'paprika',
  'oregano',
  'rosemary',
  'cilantro',
  'fennel',
  'parsley',
  'mustard',
  'coriander',
  'mango',
  'durian',
  'kiwi',

  // Compound nonsense patterns
  '12d ',
  '12d-',
  '12dimensional',
  '7d ai',
  'spice lab',
  'smoothie lab',
  'veggie lab',
  'condiment lab',
  'pancake lab',
  'brunch lab',
  'brunch module',
  'gourmand lab',
  'seasoning lab',
  'waffle iron',
  'financier financier',
];

/**
 * Regex patterns for detecting contamination that simple substring
 * matching might miss.
 */
const CONTAMINATION_PATTERNS: readonly RegExp[] = [
  /\b\d+d\s+(burp|spice|herb|lab|brunch|smoothie|veggie|condiment)/i,
  /burp[- ]?(powered|fueled|augmented|based|driven|activated)/i,
  /\b(cumin|dill|thyme|basil|tamarind|turmeric|saffron|cardamom|oregano|rosemary|cilantro|fennel|parsley|durian|okra|paprika|sumac|mango|kiwi|cinnamon|mustard|coriander)\s+(seed|pod|root|husk|shell|paste|stone)?\s*(oscillator|analyzer|booster|stabilizer|anchor|trigger|clamp)/i,
  /\b12d\b/i,
];

/**
 * Check whether a piece of text contains contamination markers.
 *
 * @param text - The text to check (question text, post content, etc.)
 * @returns true if contaminated, false if clean
 */
export function isContaminated(text: string): boolean {
  const lower = text.toLowerCase();

  for (const term of CONTAMINATION_TERMS) {
    if (lower.includes(term)) {
      return true;
    }
  }

  for (const pattern of CONTAMINATION_PATTERNS) {
    if (pattern.test(lower)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter an array of items, removing any whose text field is contaminated.
 *
 * @param items - Array of objects with a text-like field
 * @param textExtractor - Function to extract the text to check from each item
 * @returns Filtered array with contaminated items removed
 */
export function filterContaminated<T>(
  items: T[],
  textExtractor: (item: T) => string
): T[] {
  return items.filter((item) => !isContaminated(textExtractor(item)));
}
