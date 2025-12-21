/**
 * Unit Tests for Agent0Client
 *
 * Tests the singleton getAgent0Client() function since Agent0Client
 * requires configuration and should be accessed via singleton.
 */

import { describe, expect, test } from 'bun:test';
import { getAgent0Client } from '../Agent0Client';

describe('Agent0Client', () => {
  test('getAgent0Client returns a client instance', () => {
    const client = getAgent0Client();
    expect(client).toBeDefined();
    expect(client.isAvailable).toBeDefined();
  });

  test('searchAgents returns paginated response', async () => {
    const client = getAgent0Client();
    const results = await client.searchAgents({
      skills: ['trading'],
    });
    expect(results).toBeDefined();
    expect(Array.isArray(results.items)).toBe(true);
  });

  test('getAgentProfile returns a profile or null', async () => {
    const client = getAgent0Client();
    const profile = await client.getAgentProfile(1);
    expect(profile === null || typeof profile === 'object').toBe(true);
  });
});
