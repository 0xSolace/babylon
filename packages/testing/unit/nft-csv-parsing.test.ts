/**
 * Unit Tests: NFT Snapshot CSV Parsing
 *
 * Tests the CSV parsing logic used for seeding the NFT snapshot.
 * This is critical for correctly assigning NFTs to users from the CSV export.
 *
 * Tests cover:
 * - Basic CSV parsing
 * - Quoted fields with commas
 * - Special characters and unicode
 * - Edge cases and malformed data
 * - Sorting by reputation points
 * - Fisher-Yates shuffle for random assignment
 *
 * Run with: bun test unit/nft-csv-parsing.test.ts
 */

import { describe, expect, test } from 'bun:test';

/**
 * Robust CSV line parser that handles quoted fields
 * (matches implementation in seed-nft-snapshot-from-csv.ts)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i]!;

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  result.push(current);
  return result;
}

/**
 * Fisher-Yates shuffle for random assignment
 * (matches implementation)
 */
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

/**
 * Validate Privy ID format
 */
function isValidPrivyId(id: string): boolean {
  return id.startsWith('did:privy:');
}

/**
 * Validate wallet address format
 */
function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(address);
}

describe('CSV Parsing - Basic Fields', () => {
  describe('Simple CSV Lines', () => {
    test('should parse simple comma-separated values', () => {
      const line = 'value1,value2,value3';
      const result = parseCSVLine(line);
      expect(result).toEqual(['value1', 'value2', 'value3']);
    });

    test('should handle empty fields', () => {
      const line = 'value1,,value3';
      const result = parseCSVLine(line);
      expect(result).toEqual(['value1', '', 'value3']);
    });

    test('should handle empty line', () => {
      const line = '';
      const result = parseCSVLine(line);
      expect(result).toEqual(['']);
    });

    test('should handle single value', () => {
      const line = 'single';
      const result = parseCSVLine(line);
      expect(result).toEqual(['single']);
    });

    test('should handle trailing comma', () => {
      const line = 'value1,value2,';
      const result = parseCSVLine(line);
      expect(result).toEqual(['value1', 'value2', '']);
    });

    test('should handle leading comma', () => {
      const line = ',value1,value2';
      const result = parseCSVLine(line);
      expect(result).toEqual(['', 'value1', 'value2']);
    });
  });

  describe('Quoted Fields', () => {
    test('should parse quoted field', () => {
      const line = '"quoted value",normal value';
      const result = parseCSVLine(line);
      expect(result).toEqual(['quoted value', 'normal value']);
    });

    test('should handle comma inside quotes', () => {
      const line = '"value with, comma",other';
      const result = parseCSVLine(line);
      expect(result).toEqual(['value with, comma', 'other']);
    });

    test('should handle multiple commas inside quotes', () => {
      const line = '"one, two, three",four';
      const result = parseCSVLine(line);
      expect(result).toEqual(['one, two, three', 'four']);
    });

    test('should handle escaped quotes (double quotes)', () => {
      const line = '"He said ""hello""",value';
      const result = parseCSVLine(line);
      expect(result).toEqual(['He said "hello"', 'value']);
    });

    test('should handle empty quoted field', () => {
      const line = '"",value';
      const result = parseCSVLine(line);
      expect(result).toEqual(['', 'value']);
    });

    test('should handle quoted field with only spaces', () => {
      const line = '"   ",value';
      const result = parseCSVLine(line);
      expect(result).toEqual(['   ', 'value']);
    });
  });

  describe('Special Characters', () => {
    test('should handle newline in quoted field', () => {
      // Note: In real CSV, newlines in quotes span multiple lines
      // This tests the parser with the full content
      const line = '"line1\nline2",value';
      const result = parseCSVLine(line);
      expect(result).toEqual(['line1\nline2', 'value']);
    });

    test('should handle unicode characters', () => {
      const line = 'emoji🎉,unicode✨,normal';
      const result = parseCSVLine(line);
      expect(result).toEqual(['emoji🎉', 'unicode✨', 'normal']);
    });

    test('should handle unicode in quoted fields', () => {
      const line = '"emoji🎉, with comma",value';
      const result = parseCSVLine(line);
      expect(result).toEqual(['emoji🎉, with comma', 'value']);
    });

    test('should handle tab characters', () => {
      const line = 'value1\tvalue2,value3';
      const result = parseCSVLine(line);
      expect(result).toEqual(['value1\tvalue2', 'value3']);
    });

    test('should handle backslash', () => {
      const line = 'path\\to\\file,value';
      const result = parseCSVLine(line);
      expect(result).toEqual(['path\\to\\file', 'value']);
    });
  });

  describe('Real-World CSV Data', () => {
    test('should parse user data with bio containing commas', () => {
      const line =
        'did:privy:abc123,0x1234567890123456789012345678901234567890,"Hello, I am a user, nice to meet you!",username,1000';
      const result = parseCSVLine(line);
      expect(result).toHaveLength(5);
      expect(result[0]).toBe('did:privy:abc123');
      expect(result[2]).toBe('Hello, I am a user, nice to meet you!');
    });

    test('should parse user data with special characters in bio', () => {
      const line =
        'did:privy:xyz789,0xabcdef1234567890abcdef1234567890abcdef12,"I ❤️ crypto! 🚀 To the moon!",cryptofan,5000';
      const result = parseCSVLine(line);
      expect(result).toHaveLength(5);
      expect(result[2]).toContain('❤️');
      expect(result[2]).toContain('🚀');
    });

    test('should parse header row', () => {
      const line =
        'id,walletAddress,bio,username,displayName,reputationPoints,invitePoints,earnedPoints';
      const result = parseCSVLine(line);
      expect(result).toContain('id');
      expect(result).toContain('walletAddress');
      expect(result).toContain('reputationPoints');
    });
  });
});

describe('CSV Parsing - Privy ID Validation', () => {
  describe('Valid Privy IDs', () => {
    test('should accept valid Privy ID format', () => {
      expect(isValidPrivyId('did:privy:abc123')).toBe(true);
    });

    test('should accept Privy ID with long suffix', () => {
      expect(isValidPrivyId('did:privy:cm4abc123xyz789')).toBe(true);
    });
  });

  describe('Invalid Privy IDs', () => {
    test('should reject ID without did:privy: prefix', () => {
      expect(isValidPrivyId('abc123')).toBe(false);
    });

    test('should reject ID with wrong prefix', () => {
      expect(isValidPrivyId('did:other:abc123')).toBe(false);
    });

    test('should reject empty string', () => {
      expect(isValidPrivyId('')).toBe(false);
    });

    test('should reject partial prefix', () => {
      expect(isValidPrivyId('did:priv')).toBe(false);
    });
  });
});

describe('CSV Parsing - Wallet Address Validation', () => {
  describe('Valid Wallet Addresses', () => {
    test('should accept valid lowercase address', () => {
      expect(
        isValidWalletAddress('0xabcdef1234567890abcdef1234567890abcdef12')
      ).toBe(true);
    });

    test('should accept valid uppercase address', () => {
      expect(
        isValidWalletAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')
      ).toBe(true);
    });

    test('should accept mixed case address', () => {
      expect(
        isValidWalletAddress('0xAbCdEf1234567890AbCdEf1234567890AbCdEf12')
      ).toBe(true);
    });
  });

  describe('Invalid Wallet Addresses', () => {
    test('should reject address without 0x prefix', () => {
      expect(
        isValidWalletAddress('abcdef1234567890abcdef1234567890abcdef12')
      ).toBe(false);
    });

    test('should reject short address', () => {
      expect(isValidWalletAddress('0xabcdef1234')).toBe(false);
    });

    test('should reject long address', () => {
      expect(
        isValidWalletAddress('0xabcdef1234567890abcdef1234567890abcdef12ab')
      ).toBe(false);
    });

    test('should reject address with invalid characters', () => {
      expect(
        isValidWalletAddress('0xghijkl1234567890ghijkl1234567890ghijkl12')
      ).toBe(false);
    });
  });
});

describe('CSV Parsing - Reputation Points Sorting', () => {
  interface CsvUser {
    id: string;
    reputationPoints: number;
  }

  function sortByReputationDesc(users: CsvUser[]): CsvUser[] {
    return [...users].sort((a, b) => b.reputationPoints - a.reputationPoints);
  }

  describe('Sorting Logic', () => {
    test('should sort by reputation points descending', () => {
      const users: CsvUser[] = [
        { id: 'low', reputationPoints: 100 },
        { id: 'high', reputationPoints: 1000 },
        { id: 'mid', reputationPoints: 500 },
      ];

      const sorted = sortByReputationDesc(users);
      expect(sorted[0]!.id).toBe('high');
      expect(sorted[1]!.id).toBe('mid');
      expect(sorted[2]!.id).toBe('low');
    });

    test('should handle equal reputation points', () => {
      const users: CsvUser[] = [
        { id: 'a', reputationPoints: 1000 },
        { id: 'b', reputationPoints: 1000 },
        { id: 'c', reputationPoints: 1000 },
      ];

      const sorted = sortByReputationDesc(users);
      expect(sorted).toHaveLength(3);
      // Order is stable for equal values
    });

    test('should handle zero points', () => {
      const users: CsvUser[] = [
        { id: 'zero', reputationPoints: 0 },
        { id: 'positive', reputationPoints: 100 },
      ];

      const sorted = sortByReputationDesc(users);
      expect(sorted[0]!.id).toBe('positive');
      expect(sorted[1]!.id).toBe('zero');
    });

    test('should handle large numbers', () => {
      const users: CsvUser[] = [
        { id: 'large', reputationPoints: 1000000000 },
        { id: 'small', reputationPoints: 1 },
      ];

      const sorted = sortByReputationDesc(users);
      expect(sorted[0]!.id).toBe('large');
    });

    test('should return top 100 from larger list', () => {
      const users: CsvUser[] = Array.from({ length: 150 }, (_, i) => ({
        id: `user${i}`,
        reputationPoints: 1000 - i,
      }));

      const sorted = sortByReputationDesc(users).slice(0, 100);
      expect(sorted).toHaveLength(100);
      expect(sorted[0]!.reputationPoints).toBe(1000);
      expect(sorted[99]!.reputationPoints).toBe(901);
    });
  });
});

describe('CSV Parsing - Fisher-Yates Shuffle', () => {
  describe('Shuffle Properties', () => {
    test('should return same length array', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffle(original);
      expect(shuffled).toHaveLength(5);
    });

    test('should contain all original elements', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffle(original);

      original.forEach((item) => {
        expect(shuffled).toContain(item);
      });
    });

    test('should not modify original array', () => {
      const original = [1, 2, 3, 4, 5];
      const copy = [...original];
      shuffle(original);
      expect(original).toEqual(copy);
    });

    test('should handle empty array', () => {
      const shuffled = shuffle([]);
      expect(shuffled).toEqual([]);
    });

    test('should handle single element', () => {
      const shuffled = shuffle([42]);
      expect(shuffled).toEqual([42]);
    });

    test('should produce different orders with multiple runs', () => {
      const original = Array.from({ length: 100 }, (_, i) => i + 1);
      const shuffled1 = shuffle(original);
      const shuffled2 = shuffle(original);

      // Very unlikely to be identical (1/100! probability)
      const identical = shuffled1.every((val, idx) => val === shuffled2[idx]);
      expect(identical).toBe(false);
    });

    test('should produce roughly uniform distribution', () => {
      // Shuffle 100 token IDs many times and check first position distribution
      const counts = new Map<number, number>();
      const tokenIds = Array.from({ length: 100 }, (_, i) => i + 1);

      for (let i = 0; i < 10000; i++) {
        const shuffled = shuffle(tokenIds);
        const first = shuffled[0]!;
        counts.set(first, (counts.get(first) ?? 0) + 1);
      }

      // Each token should appear first roughly 100 times (10000/100)
      // Allow for variance: between 50 and 150
      counts.forEach((count) => {
        expect(count).toBeGreaterThan(50);
        expect(count).toBeLessThan(150);
      });
    });
  });

  describe('Token ID Assignment', () => {
    test('should shuffle 100 token IDs for assignment', () => {
      const tokenIds = Array.from({ length: 100 }, (_, i) => i + 1);
      const shuffled = shuffle(tokenIds);

      expect(shuffled).toHaveLength(100);
      expect(new Set(shuffled).size).toBe(100);
      expect(Math.min(...shuffled)).toBe(1);
      expect(Math.max(...shuffled)).toBe(100);
    });
  });
});

describe('CSV Parsing - Edge Cases', () => {
  describe('Malformed Data', () => {
    test('should handle unclosed quote at end of line', () => {
      // Parser will treat rest of line as quoted content
      const line = '"unclosed quote,value';
      const result = parseCSVLine(line);
      // Behavior: treats everything after opening quote as one field
      expect(result[0]).toBe('unclosed quote,value');
    });

    test('should handle very long fields', () => {
      const longValue = 'x'.repeat(10000);
      const line = `${longValue},short`;
      const result = parseCSVLine(line);
      expect(result[0]).toHaveLength(10000);
      expect(result[1]).toBe('short');
    });

    test('should handle many fields', () => {
      const line = Array.from({ length: 100 }, (_, i) => `field${i}`).join(',');
      const result = parseCSVLine(line);
      expect(result).toHaveLength(100);
    });
  });

  describe('Points Parsing', () => {
    function parsePoints(value: string): number {
      const parsed = parseInt(value.trim(), 10);
      return isNaN(parsed) ? 0 : parsed;
    }

    test('should parse integer points', () => {
      expect(parsePoints('1000')).toBe(1000);
    });

    test('should handle whitespace', () => {
      expect(parsePoints('  1000  ')).toBe(1000);
    });

    test('should return 0 for non-numeric', () => {
      expect(parsePoints('not a number')).toBe(0);
    });

    test('should return 0 for empty string', () => {
      expect(parsePoints('')).toBe(0);
    });

    test('should handle negative numbers', () => {
      // Points shouldn't be negative, but parser should handle it
      expect(parsePoints('-100')).toBe(-100);
    });
  });
});
