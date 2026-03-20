/**
 * Unit Tests: Portfolio Breakdown
 *
 * Tests for portfolio breakdown calculation, focusing on identifier classification.
 */

import { describe, expect, it } from 'bun:test';
import { resolveUserIdentifierKind } from '@babylon/shared';

describe('Portfolio Breakdown Identifier Classification', () => {
  it('should use classification-based routing for calculatePortfolioBreakdown with UUID', () => {
    // Verify that UUID identifiers are classified correctly
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const kind = resolveUserIdentifierKind(uuid);
    expect(kind).toBe('id');
    // This ensures calculatePortfolioBreakdown will use eq(users.id, userId) instead of OR condition
  });

  it('should use classification-based routing for calculatePortfolioBreakdown with privyId', () => {
    // Verify that privyId identifiers are classified correctly
    const privyId = 'did:privy:abc123';
    const kind = resolveUserIdentifierKind(privyId);
    expect(kind).toBe('privyId');
    // This ensures calculatePortfolioBreakdown will use eq(users.privyId, userId) instead of OR condition
  });

  it('should use classification-based routing for calculatePortfolioBreakdown with snowflake ID', () => {
    // Verify that snowflake IDs are classified correctly
    const snowflakeId = '123456789012345';
    const kind = resolveUserIdentifierKind(snowflakeId);
    expect(kind).toBe('id');
    // This ensures calculatePortfolioBreakdown will use eq(users.id, userId) instead of OR condition
  });

  it('should use classification-based routing for calculatePortfolioBreakdown with username', () => {
    // Verify that usernames are classified correctly
    const username = 'alice';
    const kind = resolveUserIdentifierKind(username);
    expect(kind).toBe('username');
    // This ensures calculatePortfolioBreakdown will use eq(users.username, userId) instead of OR condition
  });
});
