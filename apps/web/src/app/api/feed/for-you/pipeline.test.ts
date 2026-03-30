import { describe, expect, it } from 'bun:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { buildBackfillEngagementOrder } from './pipeline';

describe('buildBackfillEngagementOrder', () => {
  it('computes engagement inline without depending on mv_post_interaction_counts', () => {
    const query = new PgDialect().sqlToQuery(buildBackfillEngagementOrder());

    expect(query.sql).toContain('"Reaction"');
    expect(query.sql).toContain('"Comment"');
    expect(query.sql).toContain('"Share"');
    expect(query.sql).not.toContain('mv_post_interaction_counts');
  });
});
