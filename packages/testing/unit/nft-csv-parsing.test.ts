/**
 * Unit Tests: NFT CSV Parsing Logic
 *
 * Tests the REAL CSV parsing functions from @babylon/shared:
 * - parseCSVLine: robust line parsing with quoted fields
 * - parseCsvContent: full CSV parsing with validation
 * - shuffle: Fisher-Yates shuffle for random assignment
 * - selectTop100: top 100 selection by points
 *
 * Run with: bun test unit/nft-csv-parsing.test.ts
 */

import { describe, expect, test } from 'bun:test';
import {
  type CsvUser,
  parseCSVLine,
  parseCsvContent,
  selectTop100,
  shuffle,
} from '@babylon/shared';

describe('NFT CSV Parsing - parseCSVLine (Real Implementation)', () => {
  test('should parse a basic CSV line', () => {
    const line = 'id,walletAddress,username,displayName,reputationPoints';
    expect(parseCSVLine(line)).toEqual([
      'id',
      'walletAddress',
      'username',
      'displayName',
      'reputationPoints',
    ]);
  });

  test('should handle quoted fields with commas', () => {
    const line = '1,"0xabc","user1","Display, Name",1000';
    expect(parseCSVLine(line)).toEqual([
      '1',
      '0xabc',
      'user1',
      'Display, Name',
      '1000',
    ]);
  });

  test('should handle quoted fields with escaped quotes', () => {
    const line = '1,"0xabc","user1","Display ""Name""",1000';
    expect(parseCSVLine(line)).toEqual([
      '1',
      '0xabc',
      'user1',
      'Display "Name"',
      '1000',
    ]);
  });

  test('should handle empty fields', () => {
    const line = '1,,user1,,1000';
    expect(parseCSVLine(line)).toEqual(['1', '', 'user1', '', '1000']);
  });

  test('should handle fields with leading/trailing whitespace', () => {
    const line = ' 1 , 0xabc , user1 , 1000 ';
    expect(parseCSVLine(line)).toEqual([' 1 ', ' 0xabc ', ' user1 ', ' 1000 ']);
  });

  test('should handle complex quoted fields', () => {
    const line =
      'did:privy:abc,"0x123","user_name","A display name with, commas and ""quotes"".",12345';
    expect(parseCSVLine(line)).toEqual([
      'did:privy:abc',
      '0x123',
      'user_name',
      'A display name with, commas and "quotes".',
      '12345',
    ]);
  });

  test('should handle unicode characters', () => {
    const line = '1,"0xabc","user_name","你好, 世界",1000';
    expect(parseCSVLine(line)).toEqual([
      '1',
      '0xabc',
      'user_name',
      '你好, 世界',
      '1000',
    ]);
  });

  test('should handle emoji in fields', () => {
    const line = '1,"0xabc","user","🚀 Rocket Man",1000';
    expect(parseCSVLine(line)).toEqual([
      '1',
      '0xabc',
      'user',
      '🚀 Rocket Man',
      '1000',
    ]);
  });

  test('should handle completely empty line', () => {
    expect(parseCSVLine('')).toEqual(['']);
  });

  test('should handle single field', () => {
    expect(parseCSVLine('singlevalue')).toEqual(['singlevalue']);
  });

  test('should handle trailing comma', () => {
    expect(parseCSVLine('a,b,c,')).toEqual(['a', 'b', 'c', '']);
  });
});

describe('NFT CSV Parsing - parseCsvContent (Real Implementation)', () => {
  test('should parse valid CSV content', () => {
    const content = `id,walletAddress,username,displayName,reputationPoints
did:privy:user1,0x1111111111111111111111111111111111111111,user1,User One,1000
did:privy:user2,0x2222222222222222222222222222222222222222,user2,User Two,2000`;

    const users = parseCsvContent(content);
    expect(users).toHaveLength(2);
    expect(users[0]?.id).toBe('did:privy:user1');
    expect(users[0]?.reputationPoints).toBe(1000);
    expect(users[1]?.walletAddress).toBe(
      '0x2222222222222222222222222222222222222222'
    );
  });

  test('should throw error for header-only CSV', () => {
    const content = `id,walletAddress,username,displayName,reputationPoints`;
    // Only has 1 line (header), not 2+ lines - should throw
    expect(() => parseCsvContent(content)).toThrow('no data rows');
  });

  test('should throw error for completely empty CSV', () => {
    expect(() => parseCsvContent('')).toThrow('CSV file is empty');
  });

  test('should throw error for missing required columns', () => {
    const content = `id,username,reputationPoints
did:privy:user1,user1,1000`;
    expect(() => parseCsvContent(content)).toThrow(
      'CSV missing required columns'
    );
  });

  test('should skip rows with invalid Privy ID', () => {
    const content = `id,walletAddress,username,displayName,reputationPoints
invalid-id,0x1111111111111111111111111111111111111111,user1,User One,1000
did:privy:user2,0x2222222222222222222222222222222222222222,user2,User Two,2000`;

    const users = parseCsvContent(content);
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe('did:privy:user2');
  });

  test('should skip rows with invalid wallet address', () => {
    const content = `id,walletAddress,username,displayName,reputationPoints
did:privy:user1,invalid-wallet,user1,User One,1000
did:privy:user2,0x2222222222222222222222222222222222222222,user2,User Two,2000`;

    const users = parseCsvContent(content);
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe('did:privy:user2');
  });

  test('should handle empty lines gracefully', () => {
    const content = `id,walletAddress,username,displayName,reputationPoints
did:privy:user1,0x1111111111111111111111111111111111111111,user1,User One,1000

did:privy:user2,0x2222222222222222222222222222222222222222,user2,User Two,2000`;

    const users = parseCsvContent(content);
    expect(users).toHaveLength(2);
  });

  test('should normalize wallet addresses to lowercase', () => {
    const content = `id,walletAddress,username,displayName,reputationPoints
did:privy:user1,0xAABBCCDDEEFF11223344556677889900AABBCCDD,user1,User One,1000`;

    const users = parseCsvContent(content);
    expect(users[0]?.walletAddress).toBe(
      '0xaabbccddeeff11223344556677889900aabbccdd'
    );
  });

  test('should parse points as integers', () => {
    const content = `id,walletAddress,username,displayName,reputationPoints
did:privy:user1,0x1111111111111111111111111111111111111111,user1,User One,1500`;

    const users = parseCsvContent(content);
    expect(users[0]?.reputationPoints).toBe(1500);
    expect(typeof users[0]?.reputationPoints).toBe('number');
  });

  test('should default points to 0 for invalid values', () => {
    const content = `id,walletAddress,username,displayName,reputationPoints
did:privy:user1,0x1111111111111111111111111111111111111111,user1,User One,invalid`;

    const users = parseCsvContent(content);
    expect(users[0]?.reputationPoints).toBe(0);
  });

  test('should handle large CSV', () => {
    let content = `id,walletAddress,username,displayName,reputationPoints\n`;
    for (let i = 0; i < 500; i++) {
      const paddedHex = i.toString(16).padStart(40, '0');
      content += `did:privy:user${i},0x${paddedHex},user${i},User ${i},${1000 + i}\n`;
    }

    const users = parseCsvContent(content);
    expect(users).toHaveLength(500);
    expect(users[0]?.id).toBe('did:privy:user0');
    expect(users[499]?.reputationPoints).toBe(1499);
  });
});

describe('NFT CSV Parsing - shuffle (Real Implementation)', () => {
  test('should return array of same length', () => {
    const array = [1, 2, 3, 4, 5];
    const shuffled = shuffle(array);
    expect(shuffled).toHaveLength(array.length);
  });

  test('should contain all original elements', () => {
    const array = [10, 20, 30, 40, 50];
    const shuffled = shuffle(array);
    array.forEach((item) => {
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
    expect(shuffle([])).toEqual([]);
  });

  test('should handle single element array', () => {
    expect(shuffle([1])).toEqual([1]);
  });

  test('should produce different results on multiple runs (probabilistic)', () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(JSON.stringify(shuffle(array)));
    }
    // With 10 elements, probability of getting same shuffle twice is tiny
    expect(results.size).toBeGreaterThan(1);
  });

  test('should work with string arrays', () => {
    const array = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = shuffle(array);
    expect(shuffled).toHaveLength(5);
    array.forEach((item) => {
      expect(shuffled).toContain(item);
    });
  });

  test('should work with object arrays', () => {
    const array = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const shuffled = shuffle(array);
    expect(shuffled).toHaveLength(3);
    expect(shuffled.map((o) => o.id).sort()).toEqual([1, 2, 3]);
  });
});

describe('NFT CSV Parsing - selectTop100 (Real Implementation)', () => {
  test('should select top users by reputation points', () => {
    const users: CsvUser[] = [
      {
        id: 'did:privy:user1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        username: 'user1',
        displayName: 'User 1',
        reputationPoints: 100,
      },
      {
        id: 'did:privy:user2',
        walletAddress: '0x2222222222222222222222222222222222222222',
        username: 'user2',
        displayName: 'User 2',
        reputationPoints: 300,
      },
      {
        id: 'did:privy:user3',
        walletAddress: '0x3333333333333333333333333333333333333333',
        username: 'user3',
        displayName: 'User 3',
        reputationPoints: 200,
      },
    ];

    const top = selectTop100(users, 2);
    expect(top).toHaveLength(2);
    expect(top[0]?.id).toBe('did:privy:user2'); // 300 points
    expect(top[1]?.id).toBe('did:privy:user3'); // 200 points
  });

  test('should return all users if fewer than limit', () => {
    const users: CsvUser[] = [
      {
        id: 'did:privy:user1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        username: 'user1',
        displayName: 'User 1',
        reputationPoints: 100,
      },
    ];

    const top = selectTop100(users, 100);
    expect(top).toHaveLength(1);
  });

  test('should handle empty array', () => {
    expect(selectTop100([], 100)).toEqual([]);
  });

  test('should sort by descending points', () => {
    const users: CsvUser[] = [
      {
        id: 'did:privy:low',
        walletAddress: '0x1111111111111111111111111111111111111111',
        username: 'low',
        displayName: 'Low',
        reputationPoints: 10,
      },
      {
        id: 'did:privy:high',
        walletAddress: '0x2222222222222222222222222222222222222222',
        username: 'high',
        displayName: 'High',
        reputationPoints: 1000,
      },
      {
        id: 'did:privy:mid',
        walletAddress: '0x3333333333333333333333333333333333333333',
        username: 'mid',
        displayName: 'Mid',
        reputationPoints: 500,
      },
    ];

    const top = selectTop100(users);
    expect(top[0]?.reputationPoints).toBe(1000);
    expect(top[1]?.reputationPoints).toBe(500);
    expect(top[2]?.reputationPoints).toBe(10);
  });

  test('should default to 100 limit', () => {
    const users: CsvUser[] = Array.from({ length: 150 }, (_, i) => ({
      id: `did:privy:user${i}`,
      walletAddress: `0x${i.toString(16).padStart(40, '0')}`,
      username: `user${i}`,
      displayName: `User ${i}`,
      reputationPoints: 150 - i,
    }));

    const top = selectTop100(users);
    expect(top).toHaveLength(100);
    expect(top[0]?.reputationPoints).toBe(150);
    expect(top[99]?.reputationPoints).toBe(51);
  });
});
