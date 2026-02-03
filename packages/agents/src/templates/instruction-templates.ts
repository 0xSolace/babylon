/**
 * Instruction Templates
 *
 * Pre-built instruction patterns for common use cases.
 * Used by the CreateInstructionModal to provide quick template-based creation.
 */

import type {
  InstructionCategory,
  InstructionDirectiveType,
} from '@babylon/db';

// =============================================================================
// Types
// =============================================================================

/**
 * Variable types for instruction templates:
 * - 'string': Free-form text input
 * - 'number': Numeric input with optional min/max validation
 * - 'ticker': Asset ticker - validated against known tickers
 * - 'date': ISO date string, UI shows date picker
 */
export type TemplateVariableType = 'string' | 'number' | 'ticker' | 'date';

/**
 * Known tickers for validation (common crypto assets)
 */
export const KNOWN_TICKERS = [
  'BTC',
  'ETH',
  'SOL',
  'BTCN', // BitcAIn (in-game)
  'DOGE',
  'XRP',
  'AVAX',
  'MATIC',
  'ADA',
  'DOT',
  'LINK',
  'UNI',
  'AAVE',
  'CRV',
  'MKR',
] as const;

/**
 * Template variable definition
 */
export interface TemplateVariable {
  /** Variable name (matches {name} in template) */
  name: string;
  /** Variable type for input rendering */
  type: TemplateVariableType;
  /** Description shown to user */
  description: string;
  /** Whether this variable is required */
  required: boolean;
  /** For 'number' type: minimum value */
  min?: number;
  /** For 'number' type: maximum value */
  max?: number;
  /** Default value */
  defaultValue?: string | number;
}

/**
 * Instruction template definition
 */
export interface InstructionTemplate {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this template does */
  description: string;
  /** Category for the resulting instruction */
  category: InstructionCategory;
  /** Directive type for the resulting instruction */
  directiveType: InstructionDirectiveType;
  /** Template string with {variable} placeholders */
  ruleTemplate: string;
  /** Variables to fill in */
  variables: TemplateVariable[];
  /** Default priority (1-10) */
  defaultPriority: number;
  /** Suggested duration string (e.g., "7d", "24h") */
  suggestedDuration?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Interpolate template with user-provided values
 *
 * @example
 * interpolateTemplate("Never buy {ticker}", { ticker: "BTC" })
 * // => "Never buy BTC"
 */
export function interpolateTemplate(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    if (value === undefined || value === null) {
      return match; // Keep placeholder if no value
    }
    return String(value);
  });
}

/**
 * Validate that all required variables are provided
 */
export function validateTemplateValues(
  template: InstructionTemplate,
  values: Record<string, string | number>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const variable of template.variables) {
    const value = values[variable.name];

    if (variable.required) {
      if (value === undefined || value === null || value === '') {
        errors.push(`${variable.name} is required`);
        continue;
      }
    }

    if (value !== undefined && value !== null && value !== '') {
      // Type-specific validation
      if (variable.type === 'number') {
        const numValue = typeof value === 'number' ? value : parseFloat(value);
        if (isNaN(numValue)) {
          errors.push(`${variable.name} must be a number`);
        } else {
          if (variable.min !== undefined && numValue < variable.min) {
            errors.push(`${variable.name} must be at least ${variable.min}`);
          }
          if (variable.max !== undefined && numValue > variable.max) {
            errors.push(`${variable.name} must be at most ${variable.max}`);
          }
        }
      }

      // Note: ticker validation is lenient - we allow unknown tickers
      // as new assets may be added to the platform
    }
  }

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// Template Definitions
// =============================================================================

export const INSTRUCTION_TEMPLATES: InstructionTemplate[] = [
  // ===== TRADING TEMPLATES =====
  {
    id: 'avoid-asset',
    name: 'Avoid Asset',
    description: 'Prevent trading a specific asset',
    category: 'trading',
    directiveType: 'never',
    ruleTemplate: 'Never buy {ticker}',
    variables: [
      {
        name: 'ticker',
        type: 'ticker',
        description: 'Asset ticker (e.g., BTC, ETH)',
        required: true,
      },
    ],
    defaultPriority: 8,
  },
  {
    id: 'price-threshold-buy',
    name: 'Buy Below Price',
    description: 'Only buy when price is below a threshold',
    category: 'trading',
    directiveType: 'until',
    ruleTemplate: 'Only buy {ticker} when price is below ${price}',
    variables: [
      {
        name: 'ticker',
        type: 'ticker',
        description: 'Asset ticker',
        required: true,
      },
      {
        name: 'price',
        type: 'number',
        description: 'Maximum price to buy at',
        required: true,
        min: 0,
      },
    ],
    defaultPriority: 7,
  },
  {
    id: 'price-threshold-sell',
    name: 'Sell Above Price',
    description: 'Sell when price exceeds a threshold',
    category: 'trading',
    directiveType: 'until',
    ruleTemplate: 'Sell {ticker} positions when price is above ${price}',
    variables: [
      {
        name: 'ticker',
        type: 'ticker',
        description: 'Asset ticker',
        required: true,
      },
      {
        name: 'price',
        type: 'number',
        description: 'Price target to sell at',
        required: true,
        min: 0,
      },
    ],
    defaultPriority: 7,
  },
  {
    id: 'position-limit',
    name: 'Position Size Limit',
    description: 'Limit maximum position size per trade',
    category: 'trading',
    directiveType: 'always',
    ruleTemplate: 'Limit position sizes to ${maxSize} points per trade',
    variables: [
      {
        name: 'maxSize',
        type: 'number',
        description: 'Maximum points per trade',
        required: true,
        min: 1,
        max: 10000,
      },
    ],
    defaultPriority: 6,
  },
  {
    id: 'focus-predictions',
    name: 'Focus on Predictions',
    description: 'Prioritize prediction markets over perps',
    category: 'trading',
    directiveType: 'prefer',
    ruleTemplate:
      'Prioritize prediction market trades over perpetual positions',
    variables: [],
    defaultPriority: 5,
  },
  {
    id: 'focus-perps',
    name: 'Focus on Perps',
    description: 'Prioritize perp trading over predictions',
    category: 'trading',
    directiveType: 'prefer',
    ruleTemplate:
      'Prioritize perpetual position trades over prediction markets',
    variables: [],
    defaultPriority: 5,
  },
  {
    id: 'conservative-trading',
    name: 'Be Conservative',
    description: 'Trade more conservatively with smaller positions',
    category: 'trading',
    directiveType: 'prefer',
    ruleTemplate:
      'Be conservative with trades - prefer smaller position sizes and higher-confidence opportunities',
    variables: [],
    defaultPriority: 6,
  },

  // ===== SOCIAL TEMPLATES =====
  {
    id: 'increase-engagement',
    name: 'Increase Engagement',
    description: 'Prioritize social engagement and comments',
    category: 'social',
    directiveType: 'prefer',
    ruleTemplate:
      'Prioritize responding to comments and engaging with posts over trading',
    variables: [],
    defaultPriority: 5,
    suggestedDuration: '7d',
  },
  {
    id: 'post-about-topic',
    name: 'Post About Topic',
    description: 'Create posts about a specific topic',
    category: 'social',
    directiveType: 'prefer',
    ruleTemplate: 'Create posts about {topic} when relevant',
    variables: [
      {
        name: 'topic',
        type: 'string',
        description:
          'Topic to post about (e.g., "market analysis", "trading tips")',
        required: true,
      },
    ],
    defaultPriority: 5,
    suggestedDuration: '7d',
  },
  {
    id: 'avoid-controversial',
    name: 'Avoid Controversy',
    description: 'Avoid controversial or polarizing topics',
    category: 'social',
    directiveType: 'avoid',
    ruleTemplate:
      'Avoid posting about controversial, political, or polarizing topics',
    variables: [],
    defaultPriority: 7,
  },

  // ===== BEHAVIOR TEMPLATES =====
  {
    id: 'no-weekend-trading',
    name: 'No Weekend Trading',
    description: 'Pause trading on weekends',
    category: 'behavior',
    directiveType: 'never',
    ruleTemplate: 'Do not execute any trades on Saturdays or Sundays',
    variables: [],
    defaultPriority: 6,
  },
  {
    id: 'respond-to-owner',
    name: 'Respond to Owner',
    description: 'Prioritize responding to owner messages',
    category: 'behavior',
    directiveType: 'always',
    ruleTemplate:
      'Always check and respond to team chat messages from owner before taking other actions',
    variables: [],
    defaultPriority: 9,
  },
];

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): InstructionTemplate | undefined {
  return INSTRUCTION_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: InstructionCategory
): InstructionTemplate[] {
  return INSTRUCTION_TEMPLATES.filter((t) => t.category === category);
}
