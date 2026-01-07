/**
 * NFT CSV Parser Utilities
 *
 * Robust CSV parsing for NFT snapshot data.
 * Handles quoted fields, commas within fields, escaped quotes, and special characters.
 */

import { readFileSync } from 'node:fs';

/**
 * Parsed user data from CSV
 */
export interface CsvUser {
  id: string; // Privy ID (did:privy:...)
  walletAddress: string;
  username: string;
  displayName: string;
  reputationPoints: number;
}

/**
 * Parse a single CSV line, handling quoted fields with commas and escaped quotes
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i]!;

    if (char === '"') {
      // Handle escaped quotes (double-double quote)
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
 * Parse CSV content string into CsvUser array
 * Validates Privy IDs and wallet addresses
 */
export function parseCsvContent(content: string): CsvUser[] {
  const lines = content.split('\n');

  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  const headerLine = lines[0]!;
  const headers = parseCSVLine(headerLine).map((h) => h.trim());

  const idIndex = headers.indexOf('id');
  const walletIndex = headers.indexOf('walletAddress');
  const usernameIndex = headers.indexOf('username');
  const displayNameIndex = headers.indexOf('displayName');
  const pointsIndex = headers.indexOf('reputationPoints');

  if (idIndex === -1 || walletIndex === -1 || pointsIndex === -1) {
    throw new Error(
      `CSV missing required columns. Found: ${headers.slice(0, 10).join(', ')}... Required: id, walletAddress, reputationPoints`
    );
  }

  const csvUsers: CsvUser[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const fields = parseCSVLine(line);

    const id = fields[idIndex]?.trim() ?? '';
    const walletAddress = fields[walletIndex]?.trim().toLowerCase() ?? '';
    const username = fields[usernameIndex]?.trim() ?? '';
    const displayName = fields[displayNameIndex]?.trim() ?? '';
    const pointsStr = fields[pointsIndex]?.trim() ?? '0';
    const reputationPoints = parseInt(pointsStr, 10) || 0;

    // Validate Privy ID format
    if (!id.startsWith('did:privy:')) {
      continue;
    }

    // Validate wallet address format
    if (!walletAddress.match(/^0x[a-f0-9]{40}$/i)) {
      continue;
    }

    csvUsers.push({
      id,
      walletAddress,
      username,
      displayName,
      reputationPoints,
    });
  }

  return csvUsers;
}

/**
 * Parse CSV file from path
 */
export function parseCsvFile(filePath: string): CsvUser[] {
  const content = readFileSync(filePath, 'utf-8');
  return parseCsvContent(content);
}

/**
 * Fisher-Yates shuffle for random NFT assignment
 * Produces an unbiased permutation of the input array
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

/**
 * Select top N users by reputation points
 */
export function selectTop100(users: CsvUser[], limit = 100): CsvUser[] {
  return users
    .sort((a, b) => b.reputationPoints - a.reputationPoints)
    .slice(0, limit);
}
