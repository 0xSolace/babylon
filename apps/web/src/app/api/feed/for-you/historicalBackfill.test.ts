import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockDbSelect = mock();
const mockLoggerWarn = mock();

const postsMock = {
  id: 'posts.id',
  content: 'posts.content',
  authorId: 'posts.authorId',
  timestamp: 'posts.timestamp',
  type: 'posts.type',
  articleTitle: 'posts.articleTitle',
  fullContent: 'posts.fullContent',
  category: 'posts.category',
  imageUrl: 'posts.imageUrl',
  relatedQuestion: 'posts.relatedQuestion',
  originalPostId: 'posts.originalPostId',
  deletedAt: 'posts.deletedAt',
  commentOnPostId: 'posts.commentOnPostId',
  parentCommentId: 'posts.parentCommentId',
};

type QueryResult = {
  type: 'resolve';
  value: unknown[];
} | {
  type: 'reject';
  error: unknown;
};

function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {};
  const noop = () => chain;
  chain.from = noop;
  chain.where = noop;
  chain.orderBy = noop;
  chain.limit = noop;
  chain.then = (
    resolve: (value: unknown[]) => unknown,
    reject?: (error: unknown) => unknown
  ) =>
    (result.type === 'resolve'
      ? Promise.resolve(result.value)
      : Promise.reject(result.error)
    ).then(resolve, reject);
  chain.catch = (reject: (error: unknown) => unknown) =>
    (result.type === 'resolve'
      ? Promise.resolve(result.value)
      : Promise.reject(result.error)
    ).catch(reject);
  chain.finally = (cb: () => void) =>
    (result.type === 'resolve'
      ? Promise.resolve(result.value)
      : Promise.reject(result.error)
    ).finally(cb);
  return chain;
}

mock.module('@babylon/db', () => ({
  and: (...args: unknown[]) => args,
  db: { select: mockDbSelect },
  gte: (a: unknown, b: unknown) => [a, b],
  isNull: (value: unknown) => value,
  lt: (a: unknown, b: unknown) => [a, b],
  posts: postsMock,
  sql: (_strings: TemplateStringsArray, ..._values: unknown[]) => ({
    sql: true,
  }),
}));

mock.module('@babylon/shared', () => ({
  logger: {
    warn: mockLoggerWarn,
  },
}));

const { loadHistoricalForYouBackfillPosts } = await import('./historicalBackfill');

describe('loadHistoricalForYouBackfillPosts', () => {
  beforeEach(() => {
    mockDbSelect.mockReset();
    mockLoggerWarn.mockReset();
  });

  it('returns no rows without querying when backfill capacity is zero', async () => {
    const result = await loadHistoricalForYouBackfillPosts(
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-15T00:00:00.000Z'),
      0
    );

    expect(result).toEqual([]);
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('uses the materialized-view query when it succeeds', async () => {
    const rows = [
      {
        id: 'post-1',
        content: 'hello',
        authorId: 'author-1',
        timestamp: new Date('2026-03-14T00:00:00.000Z'),
        type: 'post',
        articleTitle: null,
        fullContent: null,
        category: null,
        imageUrl: null,
        relatedQuestion: null,
        originalPostId: null,
      },
    ];

    mockDbSelect.mockImplementation(() =>
      makeChain({
        type: 'resolve',
        value: rows,
      })
    );

    const result = await loadHistoricalForYouBackfillPosts(
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-15T00:00:00.000Z'),
      10
    );

    expect(result).toEqual(rows);
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('retries with live engagement ordering when mv_post_interaction_counts is missing', async () => {
    const rows = [
      {
        id: 'post-2',
        content: 'fallback',
        authorId: 'author-2',
        timestamp: new Date('2026-03-10T00:00:00.000Z'),
        type: 'post',
        articleTitle: null,
        fullContent: null,
        category: null,
        imageUrl: null,
        relatedQuestion: null,
        originalPostId: null,
      },
    ];
    const missingViewError = Object.assign(
      new Error('relation "mv_post_interaction_counts" does not exist'),
      {
        code: '42P01',
      }
    );

    mockDbSelect
      .mockImplementationOnce(() =>
        makeChain({
          type: 'reject',
          error: missingViewError,
        })
      )
      .mockImplementationOnce(() =>
        makeChain({
          type: 'resolve',
          value: rows,
        })
      );

    const result = await loadHistoricalForYouBackfillPosts(
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-15T00:00:00.000Z'),
      10
    );

    expect(result).toEqual(rows);
    expect(mockDbSelect).toHaveBeenCalledTimes(2);
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });

  it('does not swallow unrelated database errors', async () => {
    const otherMissingRelationError = Object.assign(
      new Error('relation "mv_other_counts" does not exist'),
      {
        code: '42P01',
      }
    );

    mockDbSelect.mockImplementation(() =>
      makeChain({
        type: 'reject',
        error: otherMissingRelationError,
      })
    );

    await expect(
      loadHistoricalForYouBackfillPosts(
        new Date('2026-03-01T00:00:00.000Z'),
        new Date('2026-03-15T00:00:00.000Z'),
        10
      )
    ).rejects.toBe(otherMissingRelationError);
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});
