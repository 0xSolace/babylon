/**
 * CSV parsing for NFT snapshot data
 */

import { readFileSync } from 'node:fs';

export interface CsvUser {
  id: string;
  walletAddress: string;
  username: string;
  displayName: string;
  reputationPoints: number;
}

/** Parse CSV line handling quoted fields with commas and escaped quotes */
export function parseCSVLine(line: string): string[] {
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

export function parseCsvContent(content: string): CsvUser[] {
  const lines = content.split('\n');

  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  const headers = parseCSVLine(lines[0]!).map((h) => h.trim());
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
    const reputationPoints = parseInt(fields[pointsIndex]?.trim() ?? '0', 10) || 0;

    if (!id.startsWith('did:privy:')) continue;
    if (!walletAddress.match(/^0x[a-f0-9]{40}$/i)) continue;

    csvUsers.push({ id, walletAddress, username, displayName, reputationPoints });
  }

  return csvUsers;
}

export function parseCsvFile(filePath: string): CsvUser[] {
  return parseCsvContent(readFileSync(filePath, 'utf-8'));
}

/** Fisher-Yates shuffle */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

export function selectTop100(users: CsvUser[], limit = 100): CsvUser[] {
  return users
    .sort((a, b) => b.reputationPoints - a.reputationPoints)
    .slice(0, limit);
}
