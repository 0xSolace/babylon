/**
 * Unit Tests: resolveUserIdentifierKind Classifier
 *
 * Tests the resolveUserIdentifierKind classifier function.
 * Note: These tests verify classifier output only, not actual query predicate construction.
 */

import { describe, expect, it } from 'bun:test';
import { resolveUserIdentifierKind } from '@babylon/shared';

describe('resolveUserIdentifierKind Classifier', () => {
  it('should classify UUID as id', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const kind = resolveUserIdentifierKind(uuid);
    expect(kind).toBe('id');
  });

  it('should classify privyId as privyId', () => {
    const privyId = 'did:privy:abc123';
    const kind = resolveUserIdentifierKind(privyId);
    expect(kind).toBe('privyId');
  });

  it('should classify snowflake ID as id', () => {
    const snowflakeId = '123456789012345';
    const kind = resolveUserIdentifierKind(snowflakeId);
    expect(kind).toBe('id');
  });

  it('should classify username as username', () => {
    const username = 'alice';
    const kind = resolveUserIdentifierKind(username);
    expect(kind).toBe('username');
  });
});
