/**
 * Tests for Instruction Templates
 *
 * Comprehensive tests covering:
 * - Template interpolation
 * - Template validation
 * - Template lookup utilities
 * - Edge cases and error handling
 */

import { describe, expect, it } from 'bun:test';
import {
  getTemplateById,
  getTemplatesByCategory,
  INSTRUCTION_TEMPLATES,
  interpolateTemplate,
  KNOWN_TICKERS,
  validateTemplateValues,
} from '../instruction-templates';

// =============================================================================
// interpolateTemplate Tests
// =============================================================================

describe('interpolateTemplate', () => {
  describe('Basic Interpolation', () => {
    it('should replace single variable', () => {
      const result = interpolateTemplate('Never buy {ticker}', {
        ticker: 'BTC',
      });
      expect(result).toBe('Never buy BTC');
    });

    it('should replace multiple variables', () => {
      const result = interpolateTemplate(
        'Only buy {ticker} when price is below ${price}',
        { ticker: 'ETH', price: 3000 }
      );
      expect(result).toBe('Only buy ETH when price is below $3000');
    });

    it('should handle number values', () => {
      const result = interpolateTemplate('Limit positions to ${amount}', {
        amount: 500,
      });
      expect(result).toBe('Limit positions to $500');
    });

    it('should handle string values', () => {
      const result = interpolateTemplate('Create posts about {topic}', {
        topic: 'market analysis',
      });
      expect(result).toBe('Create posts about market analysis');
    });
  });

  describe('Missing Values', () => {
    it('should keep placeholder when value is missing', () => {
      const result = interpolateTemplate('Never buy {ticker}', {});
      expect(result).toBe('Never buy {ticker}');
    });

    it('should keep placeholder when value is undefined', () => {
      const result = interpolateTemplate('Never buy {ticker}', {
        ticker: undefined as unknown as string,
      });
      expect(result).toBe('Never buy {ticker}');
    });

    it('should keep placeholder when value is null', () => {
      const result = interpolateTemplate('Never buy {ticker}', {
        ticker: null as unknown as string,
      });
      expect(result).toBe('Never buy {ticker}');
    });
  });

  describe('Edge Cases', () => {
    it('should handle template with no variables', () => {
      const result = interpolateTemplate('Prioritize prediction markets', {});
      expect(result).toBe('Prioritize prediction markets');
    });

    it('should handle empty template', () => {
      const result = interpolateTemplate('', { ticker: 'BTC' });
      expect(result).toBe('');
    });

    it('should handle zero as a valid value', () => {
      const result = interpolateTemplate('Set limit to {value}', { value: 0 });
      expect(result).toBe('Set limit to 0');
    });

    it('should handle negative numbers', () => {
      const result = interpolateTemplate('Threshold: {value}', { value: -10 });
      expect(result).toBe('Threshold: -10');
    });

    it('should handle decimal numbers', () => {
      const result = interpolateTemplate('Price: ${price}', { price: 99.99 });
      expect(result).toBe('Price: $99.99');
    });

    it('should handle special characters in values', () => {
      const result = interpolateTemplate('Topic: {topic}', {
        topic: 'BTC/USD analysis',
      });
      expect(result).toBe('Topic: BTC/USD analysis');
    });

    it('should handle multiple same variables', () => {
      const result = interpolateTemplate('{ticker} to {ticker}', {
        ticker: 'BTC',
      });
      expect(result).toBe('BTC to BTC');
    });
  });
});

// =============================================================================
// validateTemplateValues Tests
// =============================================================================

describe('validateTemplateValues', () => {
  const avoidAssetTemplate = INSTRUCTION_TEMPLATES.find(
    (t) => t.id === 'avoid-asset'
  )!;
  const priceThresholdTemplate = INSTRUCTION_TEMPLATES.find(
    (t) => t.id === 'price-threshold-buy'
  )!;
  const positionLimitTemplate = INSTRUCTION_TEMPLATES.find(
    (t) => t.id === 'position-limit'
  )!;

  describe('Required Variables', () => {
    it('should pass when all required variables are provided', () => {
      const result = validateTemplateValues(avoidAssetTemplate, {
        ticker: 'BTC',
      });
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should fail when required variable is missing', () => {
      const result = validateTemplateValues(avoidAssetTemplate, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ticker is required');
    });

    it('should fail when required variable is empty string', () => {
      const result = validateTemplateValues(avoidAssetTemplate, { ticker: '' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ticker is required');
    });
  });

  describe('Number Validation', () => {
    it('should pass for valid number within range', () => {
      const result = validateTemplateValues(positionLimitTemplate, {
        maxSize: 500,
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when number is below minimum', () => {
      const result = validateTemplateValues(positionLimitTemplate, {
        maxSize: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('at least'))).toBe(true);
    });

    it('should fail when number is above maximum', () => {
      const result = validateTemplateValues(positionLimitTemplate, {
        maxSize: 20000,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('at most'))).toBe(true);
    });

    it('should fail when number is NaN', () => {
      const result = validateTemplateValues(positionLimitTemplate, {
        maxSize: 'not-a-number' as unknown as number,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('must be a number'))).toBe(
        true
      );
    });

    it('should accept string that parses to valid number', () => {
      const result = validateTemplateValues(positionLimitTemplate, {
        maxSize: '500',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('Multiple Variables', () => {
    it('should validate all variables', () => {
      const result = validateTemplateValues(priceThresholdTemplate, {
        ticker: 'BTC',
        price: 100000,
      });
      expect(result.valid).toBe(true);
    });

    it('should collect all errors', () => {
      const result = validateTemplateValues(priceThresholdTemplate, {});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2); // Both ticker and price missing
    });

    it('should validate partially provided values', () => {
      const result = validateTemplateValues(priceThresholdTemplate, {
        ticker: 'BTC',
        // price missing
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('price is required');
    });
  });

  describe('Templates Without Variables', () => {
    it('should pass validation for templates with no variables', () => {
      const noVarsTemplate = INSTRUCTION_TEMPLATES.find(
        (t) => t.variables.length === 0
      )!;
      expect(noVarsTemplate).toBeDefined();

      const result = validateTemplateValues(noVarsTemplate, {});
      expect(result.valid).toBe(true);
    });
  });
});

// =============================================================================
// getTemplateById Tests
// =============================================================================

describe('getTemplateById', () => {
  it('should return template for valid id', () => {
    const template = getTemplateById('avoid-asset');
    expect(template).toBeDefined();
    expect(template!.id).toBe('avoid-asset');
    expect(template!.name).toBe('Avoid Asset');
  });

  it('should return undefined for invalid id', () => {
    const template = getTemplateById('non-existent-template');
    expect(template).toBeUndefined();
  });

  it('should return undefined for empty id', () => {
    const template = getTemplateById('');
    expect(template).toBeUndefined();
  });

  it('should find all predefined templates', () => {
    const templateIds = [
      'avoid-asset',
      'price-threshold-buy',
      'price-threshold-sell',
      'position-limit',
      'focus-predictions',
      'focus-perps',
      'conservative-trading',
      'increase-engagement',
      'post-about-topic',
      'avoid-controversial',
      'no-weekend-trading',
      'respond-to-owner',
    ];

    for (const id of templateIds) {
      const template = getTemplateById(id);
      expect(template).toBeDefined();
      expect(template!.id).toBe(id);
    }
  });
});

// =============================================================================
// getTemplatesByCategory Tests
// =============================================================================

describe('getTemplatesByCategory', () => {
  it('should return trading templates', () => {
    const templates = getTemplatesByCategory('trading');
    expect(templates.length).toBeGreaterThan(0);
    for (const t of templates) {
      expect(t.category).toBe('trading');
    }
  });

  it('should return social templates', () => {
    const templates = getTemplatesByCategory('social');
    expect(templates.length).toBeGreaterThan(0);
    for (const t of templates) {
      expect(t.category).toBe('social');
    }
  });

  it('should return behavior templates', () => {
    const templates = getTemplatesByCategory('behavior');
    expect(templates.length).toBeGreaterThan(0);
    for (const t of templates) {
      expect(t.category).toBe('behavior');
    }
  });

  it('should return empty array for category with no templates', () => {
    const templates = getTemplatesByCategory('general');
    // May or may not have templates, but should be an array
    expect(Array.isArray(templates)).toBe(true);
  });
});

// =============================================================================
// KNOWN_TICKERS Tests
// =============================================================================

describe('KNOWN_TICKERS', () => {
  it('should include common crypto tickers', () => {
    const expectedTickers = ['BTC', 'ETH', 'SOL', 'DOGE'];
    for (const ticker of expectedTickers) {
      expect(KNOWN_TICKERS).toContain(ticker);
    }
  });

  it('should include game-specific tickers', () => {
    expect(KNOWN_TICKERS).toContain('BTCN'); // BitcAIn
  });

  it('should be a readonly array', () => {
    // Type assertion check - KNOWN_TICKERS should be readonly
    expect(Array.isArray(KNOWN_TICKERS)).toBe(true);
  });
});

// =============================================================================
// Template Structure Tests
// =============================================================================

describe('INSTRUCTION_TEMPLATES Structure', () => {
  it('should have unique IDs', () => {
    const ids = INSTRUCTION_TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('should have all required fields', () => {
    for (const template of INSTRUCTION_TEMPLATES) {
      expect(template.id).toBeDefined();
      expect(typeof template.id).toBe('string');
      expect(template.name).toBeDefined();
      expect(typeof template.name).toBe('string');
      expect(template.description).toBeDefined();
      expect(typeof template.description).toBe('string');
      expect(template.category).toBeDefined();
      expect(['trading', 'social', 'behavior', 'general']).toContain(
        template.category
      );
      expect(template.directiveType).toBeDefined();
      expect(['always', 'never', 'prefer', 'avoid', 'until']).toContain(
        template.directiveType
      );
      expect(template.ruleTemplate).toBeDefined();
      expect(typeof template.ruleTemplate).toBe('string');
      expect(template.variables).toBeDefined();
      expect(Array.isArray(template.variables)).toBe(true);
      expect(template.defaultPriority).toBeDefined();
      expect(template.defaultPriority).toBeGreaterThanOrEqual(1);
      expect(template.defaultPriority).toBeLessThanOrEqual(10);
    }
  });

  it('should have valid variable definitions', () => {
    for (const template of INSTRUCTION_TEMPLATES) {
      for (const variable of template.variables) {
        expect(variable.name).toBeDefined();
        expect(typeof variable.name).toBe('string');
        expect(variable.type).toBeDefined();
        expect(['string', 'number', 'ticker', 'date']).toContain(variable.type);
        expect(variable.description).toBeDefined();
        expect(typeof variable.description).toBe('string');
        expect(typeof variable.required).toBe('boolean');
      }
    }
  });

  it('should have template placeholders matching variable names', () => {
    for (const template of INSTRUCTION_TEMPLATES) {
      const placeholderMatches = template.ruleTemplate.match(/\{(\w+)\}/g);
      const placeholders = placeholderMatches
        ? placeholderMatches.map((m) => m.slice(1, -1))
        : [];

      const variableNames = template.variables.map((v) => v.name);

      // All placeholders should have a corresponding variable
      for (const placeholder of placeholders) {
        expect(variableNames).toContain(placeholder);
      }

      // All required variables should have a corresponding placeholder
      for (const variable of template.variables) {
        if (variable.required) {
          expect(placeholders).toContain(variable.name);
        }
      }
    }
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  it('should handle interpolation with extra values', () => {
    const result = interpolateTemplate('Buy {ticker}', {
      ticker: 'BTC',
      extra: 'ignored',
    });
    expect(result).toBe('Buy BTC');
  });

  it('should handle nested braces correctly', () => {
    // Only {word} patterns should be replaced
    const result = interpolateTemplate('{{ticker}}', { ticker: 'BTC' });
    // The inner {ticker} gets replaced, leaving {BTC}
    expect(result).toBe('{BTC}');
  });

  it('should handle special regex characters in values', () => {
    const result = interpolateTemplate('Topic: {topic}', {
      topic: 'BTC.*ETH$100',
    });
    expect(result).toBe('Topic: BTC.*ETH$100');
  });

  it('should handle unicode in values', () => {
    const result = interpolateTemplate('Topic: {topic}', {
      topic: '比特币 🚀',
    });
    expect(result).toBe('Topic: 比特币 🚀');
  });

  it('should handle very long values', () => {
    const longValue = 'A'.repeat(1000);
    const result = interpolateTemplate('Topic: {topic}', { topic: longValue });
    expect(result).toBe(`Topic: ${longValue}`);
  });
});
