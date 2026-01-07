/**
 * Unit tests for NFT CSV parsing
 */

import { describe, expect, test } from 'bun:test';
import {
  type CsvUser,
  parseCSVLine,
  parseCsvContent,
  selectTop100,
  shuffle,
} from '@babylon/shared';

describe('parseCSVLine', () => {
  test('parses basic line', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  test('handles quoted fields with commas', () => {
    expect(parseCSVLine('1,"hello, world",2')).toEqual(['1', 'hello, world', '2']);
  });

  test('handles escaped quotes', () => {
    expect(parseCSVLine('1,"say ""hi""",2')).toEqual(['1', 'say "hi"', '2']);
  });

  test('handles empty fields', () => {
    expect(parseCSVLine('1,,3')).toEqual(['1', '', '3']);
  });

  test('handles unicode', () => {
    expect(parseCSVLine('1,"你好",🚀')).toEqual(['1', '你好', '🚀']);
  });

  test('handles edge cases', () => {
    expect(parseCSVLine('')).toEqual(['']);
    expect(parseCSVLine('single')).toEqual(['single']);
    expect(parseCSVLine('a,b,')).toEqual(['a', 'b', '']);
  });
});

describe('parseCsvContent', () => {
  const validCsv = `id,walletAddress,username,displayName,reputationPoints
did:privy:user1,0x1111111111111111111111111111111111111111,user1,User One,1000
did:privy:user2,0x2222222222222222222222222222222222222222,user2,User Two,2000`;

  test('parses valid CSV', () => {
    const users = parseCsvContent(validCsv);
    expect(users).toHaveLength(2);
    expect(users[0]?.id).toBe('did:privy:user1');
    expect(users[1]?.reputationPoints).toBe(2000);
  });

  test('throws for empty/header-only CSV', () => {
    expect(() => parseCsvContent('')).toThrow('empty');
    expect(() => parseCsvContent('id,walletAddress,reputationPoints')).toThrow('no data rows');
  });

  test('throws for missing columns', () => {
    expect(() => parseCsvContent('id,username\nuser1,user1')).toThrow('missing required');
  });

  test('skips invalid rows', () => {
    const csv = `id,walletAddress,username,displayName,reputationPoints
invalid-id,0x1111111111111111111111111111111111111111,u1,U1,100
did:privy:user2,bad-wallet,u2,U2,200
did:privy:user3,0x3333333333333333333333333333333333333333,u3,U3,300`;
    const users = parseCsvContent(csv);
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe('did:privy:user3');
  });

  test('normalizes wallets to lowercase', () => {
    const csv = `id,walletAddress,username,displayName,reputationPoints
did:privy:u,0xAABBCCDDEE1122334455667788990011AABBCCDD,u,U,100`;
    expect(parseCsvContent(csv)[0]?.walletAddress).toBe('0xaabbccddee1122334455667788990011aabbccdd');
  });

  test('defaults invalid points to 0', () => {
    const csv = `id,walletAddress,username,displayName,reputationPoints
did:privy:u,0x1111111111111111111111111111111111111111,u,U,invalid`;
    expect(parseCsvContent(csv)[0]?.reputationPoints).toBe(0);
  });
});

describe('shuffle', () => {
  test('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  test('does not modify original', () => {
    const arr = [1, 2, 3];
    shuffle(arr);
    expect(arr).toEqual([1, 2, 3]);
  });

  test('handles edge cases', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([1])).toEqual([1]);
  });

  test('produces varied results', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) results.add(JSON.stringify(shuffle(arr)));
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('selectTop100', () => {
  const makeUser = (id: string, pts: number): CsvUser => ({
    id: `did:privy:${id}`,
    walletAddress: '0x' + '1'.repeat(40),
    username: id,
    displayName: id,
    reputationPoints: pts,
  });

  test('selects top by points', () => {
    const users = [makeUser('low', 10), makeUser('high', 100), makeUser('mid', 50)];
    const top = selectTop100(users, 2);
    expect(top.map(u => u.reputationPoints)).toEqual([100, 50]);
  });

  test('handles edge cases', () => {
    expect(selectTop100([], 10)).toEqual([]);
    expect(selectTop100([makeUser('only', 100)], 10)).toHaveLength(1);
  });

  test('defaults to 100 limit', () => {
    const users = Array.from({ length: 150 }, (_, i) => makeUser(`u${i}`, 150 - i));
    expect(selectTop100(users)).toHaveLength(100);
  });
});
