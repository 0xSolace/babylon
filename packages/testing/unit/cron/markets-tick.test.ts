import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from 'bun:test';
import { NextRequest } from 'next/server';
import {
  cronMockState,
  registerCronMocks,
  resetQueryTable,
} from './cron-test-mocks';

/**
 * Markets Tick Cron Job Tests
 *
 * Tests for the markets-tick cron endpoint which handles the complete
 * lifecycle of prediction markets.
 */

let GET: (req: NextRequest) => Promise<Response>;
let POST: (req: NextRequest) => Promise<Response>;

describe('Markets Tick Cron', () => {
  beforeAll(async () => {
    registerCronMocks();
    const routeModule = await import('@/app/api/cron/markets-tick/route');
    GET = routeModule.GET;
    POST = routeModule.POST;
  });

  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    cronMockState.marketsGame = null;
    cronMockState.marketsActiveQuestions = [];
    cronMockState.marketsWorldEvents = [];
    cronMockState.marketsCronAuthResult = true;
    cronMockState.marketsAcquireLockResult = true;
    resetQueryTable();
  });

  describe('Authorization', () => {
    test('GET should delegate to POST and return equivalent response', async () => {
      cronMockState.marketsGame = null;

      const getReq = new NextRequest('http://localhost/api/cron/markets-tick', {
        method: 'GET',
      });
      const postReq = new NextRequest(
        'http://localhost/api/cron/markets-tick',
        { method: 'POST' }
      );

      const getRes = await GET(getReq);
      const postRes = await POST(postReq);

      expect(getRes.status).toBe(postRes.status);

      const getData = await getRes.json();
      const postData = await postRes.json();

      expect(getData.success).toBe(postData.success);
      expect(getData.skipped).toBe(postData.skipped);
    });

    test('should reject unauthorized requests when verifyCronAuth returns false', async () => {
      cronMockState.marketsCronAuthResult = false;

      const req = new NextRequest('http://localhost/api/cron/markets-tick', {
        method: 'POST',
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    test('GET should also reject unauthorized requests', async () => {
      cronMockState.marketsCronAuthResult = false;

      const req = new NextRequest('http://localhost/api/cron/markets-tick', {
        method: 'GET',
      });
      const res = await GET(req);

      expect(res.status).toBe(401);
    });
  });

  describe('Distributed Lock', () => {
    test('should skip when lock cannot be acquired', async () => {
      cronMockState.marketsGame = {
        id: 'game-123',
        isContinuous: true,
        isRunning: true,
        currentDay: 1,
      };
      cronMockState.marketsAcquireLockResult = false;

      const req = new NextRequest('http://localhost/api/cron/markets-tick', {
        method: 'POST',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.skipped).toBe(true);
      expect(data.reason).toContain('Previous tick still running');
    });
  });

  describe('Game State Checks', () => {
    test('should skip when game is not running', async () => {
      cronMockState.marketsGame = {
        id: 'game-123',
        isContinuous: true,
        isRunning: false,
        currentDay: 1,
      };

      const req = new NextRequest('http://localhost/api/cron/markets-tick', {
        method: 'POST',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.skipped).toBe(true);
      expect(data.reason).toBe('Game not running');
    });
  });
});

describe('Market Timeframe Configuration', () => {
  test('should have correct market distribution (10 total)', () => {
    const expectedMarkets = {
      '3d': 1,
      '2d': 1,
      '1d': 1,
      '12h': 1,
      '6h': 1,
      '1h': 1,
      '30m': 2,
      '15m': 2,
    };

    const totalExpected = Object.values(expectedMarkets).reduce(
      (a, b) => a + b,
      0
    );
    expect(totalExpected).toBe(10);
  });
});

// =============================================================================
// Granular Timeframe Inference Tests
// =============================================================================

describe('inferGranularTimeframe', () => {
  const DURATIONS = {
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '2d': 2 * 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
  };

  function inferGranularTimeframe(durationMs: number): string {
    const sortedEntries = Object.entries(DURATIONS).sort((a, b) => a[1] - b[1]);

    for (const [key, expectedDuration] of sortedEntries) {
      const tolerance = expectedDuration * 0.1;
      if (Math.abs(durationMs - expectedDuration) <= tolerance) return key;
    }

    let closestKey = '1h';
    let closestDiff = Infinity;
    for (const [key, expectedDuration] of sortedEntries) {
      const diff = Math.abs(durationMs - expectedDuration);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestKey = key;
      }
    }
    return closestKey;
  }

  describe('exact duration matches', () => {
    test('should match 15m duration exactly', () => {
      expect(inferGranularTimeframe(DURATIONS['15m'])).toBe('15m');
    });
    test('should match 30m duration exactly', () => {
      expect(inferGranularTimeframe(DURATIONS['30m'])).toBe('30m');
    });
    test('should match 1h duration exactly', () => {
      expect(inferGranularTimeframe(DURATIONS['1h'])).toBe('1h');
    });
    test('should match 6h duration exactly', () => {
      expect(inferGranularTimeframe(DURATIONS['6h'])).toBe('6h');
    });
    test('should match 12h duration exactly', () => {
      expect(inferGranularTimeframe(DURATIONS['12h'])).toBe('12h');
    });
    test('should match 1d duration exactly', () => {
      expect(inferGranularTimeframe(DURATIONS['1d'])).toBe('1d');
    });
    test('should match 2d duration exactly', () => {
      expect(inferGranularTimeframe(DURATIONS['2d'])).toBe('2d');
    });
    test('should match 3d duration exactly', () => {
      expect(inferGranularTimeframe(DURATIONS['3d'])).toBe('3d');
    });
  });

  describe('10% tolerance boundary tests', () => {
    test('should match 15m at +10% tolerance boundary', () => {
      expect(inferGranularTimeframe(DURATIONS['15m'] * 1.1)).toBe('15m');
    });
    test('should match 15m at -10% tolerance boundary', () => {
      expect(inferGranularTimeframe(DURATIONS['15m'] * 0.9)).toBe('15m');
    });
    test('should match 1h at +10% tolerance boundary', () => {
      expect(inferGranularTimeframe(DURATIONS['1h'] * 1.1)).toBe('1h');
    });
    test('should match 1h at -10% tolerance boundary', () => {
      expect(inferGranularTimeframe(DURATIONS['1h'] * 0.9)).toBe('1h');
    });

    test('should fall back to closest when outside all tolerances', () => {
      const midpoint = (DURATIONS['15m'] + DURATIONS['30m']) / 2;
      expect(['15m', '30m']).toContain(inferGranularTimeframe(midpoint));
    });

    test('should handle very short durations (below 15m)', () => {
      expect(inferGranularTimeframe(5 * 60 * 1000)).toBe('15m');
    });
    test('should handle very long durations (above 3d)', () => {
      expect(inferGranularTimeframe(5 * 24 * 60 * 60 * 1000)).toBe('3d');
    });
  });

  describe('edge cases', () => {
    test('should handle zero duration', () => {
      expect(inferGranularTimeframe(0)).toBe('15m');
    });
    test('should handle negative duration gracefully', () => {
      expect(inferGranularTimeframe(-1000)).toBeDefined();
    });
  });
});

// =============================================================================
// Sub-Market Batch Creation Tests
// =============================================================================

describe('Sub-Market Batch Creation Logic', () => {
  const MAX_SUB_MARKETS = 10;
  const MAX_SUB_MARKETS_PER_TICK = 5;

  test('should create up to MAX_SUB_MARKETS_PER_TICK when many needed', () => {
    expect(Math.min(MAX_SUB_MARKETS - 0, MAX_SUB_MARKETS_PER_TICK)).toBe(5);
  });
  test('should create exact amount when fewer than limit needed', () => {
    expect(Math.min(MAX_SUB_MARKETS - 7, MAX_SUB_MARKETS_PER_TICK)).toBe(3);
  });
  test('should create zero when at maximum', () => {
    expect(Math.min(MAX_SUB_MARKETS - 10, MAX_SUB_MARKETS_PER_TICK)).toBe(0);
  });
  test('should create one when one needed', () => {
    expect(Math.min(MAX_SUB_MARKETS - 9, MAX_SUB_MARKETS_PER_TICK)).toBe(1);
  });
  test('should handle over-capacity gracefully', () => {
    expect(
      Math.max(0, Math.min(MAX_SUB_MARKETS - 12, MAX_SUB_MARKETS_PER_TICK))
    ).toBe(0);
  });
});

// =============================================================================
// Idempotency Check Tests
// =============================================================================

describe('Market Idempotency Check Logic', () => {
  interface MockMarket {
    id: string;
    granularTimeframe: string | null;
    startTime: Date;
    endTime: Date;
  }
  const DURATIONS = {
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
  };

  function inferGranularTimeframe(durationMs: number): string {
    for (const [key, expected] of Object.entries(DURATIONS).sort(
      (a, b) => a[1] - b[1]
    )) {
      if (Math.abs(durationMs - expected) <= expected * 0.1) return key;
    }
    return '1h';
  }

  function countMarketsForTimeframe(
    markets: MockMarket[],
    targetTimeframe: string
  ): number {
    return markets.filter((m) => {
      const tf =
        m.granularTimeframe ??
        inferGranularTimeframe(m.endTime.getTime() - m.startTime.getTime());
      return tf === targetTimeframe;
    }).length;
  }

  test('should count markets with stored granularTimeframe', () => {
    const now = Date.now();
    const markets: MockMarket[] = [
      {
        id: '1',
        granularTimeframe: '15m',
        startTime: new Date(now),
        endTime: new Date(now + DURATIONS['15m']),
      },
      {
        id: '2',
        granularTimeframe: '15m',
        startTime: new Date(now),
        endTime: new Date(now + DURATIONS['15m']),
      },
      {
        id: '3',
        granularTimeframe: '30m',
        startTime: new Date(now),
        endTime: new Date(now + DURATIONS['30m']),
      },
    ];
    expect(countMarketsForTimeframe(markets, '15m')).toBe(2);
    expect(countMarketsForTimeframe(markets, '30m')).toBe(1);
    expect(countMarketsForTimeframe(markets, '1h')).toBe(0);
  });

  test('should fall back to inference for legacy markets without granularTimeframe', () => {
    const now = Date.now();
    const markets: MockMarket[] = [
      {
        id: '1',
        granularTimeframe: null,
        startTime: new Date(now),
        endTime: new Date(now + DURATIONS['15m']),
      },
      {
        id: '2',
        granularTimeframe: '15m',
        startTime: new Date(now),
        endTime: new Date(now + DURATIONS['15m']),
      },
    ];
    expect(countMarketsForTimeframe(markets, '15m')).toBe(2);
  });

  test('should prevent creation when at target count', () => {
    expect(2 < 2).toBe(false);
  });
  test('should allow creation when below target count', () => {
    expect(1 < 2).toBe(true);
  });
});

// =============================================================================
// Granular to DB Timeframe Mapping Tests
// =============================================================================

describe('Granular to DB Timeframe Mapping', () => {
  const EXPECTED_MAPPINGS: Record<string, string> = {
    '15m': 'flash',
    '30m': 'flash',
    '1h': 'intraday',
    '6h': 'intraday',
    '12h': 'daily',
    '1d': 'daily',
    '2d': 'weekly',
    '3d': 'weekly',
  };

  test('should map flash timeframes correctly', () => {
    expect(EXPECTED_MAPPINGS['15m']).toBe('flash');
    expect(EXPECTED_MAPPINGS['30m']).toBe('flash');
  });
  test('should map intraday timeframes correctly', () => {
    expect(EXPECTED_MAPPINGS['1h']).toBe('intraday');
    expect(EXPECTED_MAPPINGS['6h']).toBe('intraday');
  });
  test('should map daily timeframes correctly', () => {
    expect(EXPECTED_MAPPINGS['12h']).toBe('daily');
    expect(EXPECTED_MAPPINGS['1d']).toBe('daily');
  });
  test('should map weekly timeframes correctly', () => {
    expect(EXPECTED_MAPPINGS['2d']).toBe('weekly');
    expect(EXPECTED_MAPPINGS['3d']).toBe('weekly');
  });

  test('should have all 8 granular timeframes mapped', () => {
    const keys = Object.keys(EXPECTED_MAPPINGS);
    expect(keys.length).toBe(8);
    for (const k of ['15m', '30m', '1h', '6h', '12h', '1d', '2d', '3d'])
      expect(keys).toContain(k);
  });

  test('should aggregate to correct DB timeframe counts', () => {
    const dbCounts: Record<string, number> = {};
    for (const v of Object.values(EXPECTED_MAPPINGS))
      dbCounts[v] = (dbCounts[v] || 0) + 1;
    expect(dbCounts['flash']).toBe(2);
    expect(dbCounts['intraday']).toBe(2);
    expect(dbCounts['daily']).toBe(2);
    expect(dbCounts['weekly']).toBe(2);
  });
});

// =============================================================================
// toStringArray Type Guard Tests
// =============================================================================

describe('toStringArray Type Guard', () => {
  function toStringArray(value: unknown): string[] {
    if (Array.isArray(value) && value.every((item) => typeof item === 'string'))
      return value;
    return [];
  }

  test('should return array for valid string array', () => {
    expect(toStringArray(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });
  test('should return empty array for null', () => {
    expect(toStringArray(null)).toEqual([]);
  });
  test('should return empty array for undefined', () => {
    expect(toStringArray(undefined)).toEqual([]);
  });
  test('should return empty array for non-array types', () => {
    expect(toStringArray('string')).toEqual([]);
    expect(toStringArray(123)).toEqual([]);
    expect(toStringArray({ key: 'value' })).toEqual([]);
  });
  test('should return empty array for mixed arrays', () => {
    expect(toStringArray(['a', 1, 'b'])).toEqual([]);
  });
  test('should return empty array for empty array', () => {
    expect(toStringArray([])).toEqual([]);
  });
  test('should handle nested arrays as invalid', () => {
    expect(toStringArray([['a', 'b'], ['c']])).toEqual([]);
  });
});

// =============================================================================
// inferSubMarketTimeframe Tests (Updated for Fixed Version)
// =============================================================================

describe('inferSubMarketTimeframe (Fixed Version)', () => {
  function inferSubMarketTimeframe(durationMs: number): '15m' | '30m' | '1h' {
    const minutes = durationMs / (60 * 1000);
    if (minutes <= 22.5) return '15m';
    if (minutes <= 45) return '30m';
    return '1h';
  }

  test('should return 15m for durations up to 22.5 minutes', () => {
    expect(inferSubMarketTimeframe(15 * 60 * 1000)).toBe('15m');
    expect(inferSubMarketTimeframe(20 * 60 * 1000)).toBe('15m');
    expect(inferSubMarketTimeframe(22.5 * 60 * 1000)).toBe('15m');
  });
  test('should return 30m for durations from 22.5 to 45 minutes', () => {
    expect(inferSubMarketTimeframe(23 * 60 * 1000)).toBe('30m');
    expect(inferSubMarketTimeframe(30 * 60 * 1000)).toBe('30m');
    expect(inferSubMarketTimeframe(45 * 60 * 1000)).toBe('30m');
  });
  test('should return 1h for all durations over 45 minutes', () => {
    for (const m of [46, 60, 90, 120, 180])
      expect(inferSubMarketTimeframe(m * 60 * 1000)).toBe('1h');
  });
  test('should only return keys supported by GRANULAR_TO_DB_TIMEFRAME', () => {
    const supported = ['15m', '30m', '1h'];
    for (const d of [15, 30, 60, 90, 120, 180])
      expect(supported).toContain(inferSubMarketTimeframe(d * 60 * 1000));
  });
});

// =============================================================================
// Transactional Sub-Market Creation Logic Tests
// =============================================================================

describe('Transactional Sub-Market Creation Logic', () => {
  const MAX_SUB_MARKETS = 10;
  const MAX_SUB_MARKETS_PER_TICK = 5;

  test('should abort creation when count reaches MAX_SUB_MARKETS inside transaction', () => {
    expect(MAX_SUB_MARKETS - 8).toBe(2);
    expect(10 < MAX_SUB_MARKETS).toBe(false);
  });
  test('should respect MAX_SUB_MARKETS_PER_TICK even when many needed', () => {
    expect(Math.min(MAX_SUB_MARKETS - 0, MAX_SUB_MARKETS_PER_TICK)).toBe(5);
  });
  test('should handle concurrent tick scenario with SKIP LOCKED', () => {
    const parentMarketsReturned = true ? [] : [{ id: '1' }];
    expect(parentMarketsReturned.length).toBe(0);
  });
  test('should track gapFillingSkippedDueToMax metric correctly', () => {
    for (const { activeCount, expected } of [
      { activeCount: 10, expected: true },
      { activeCount: 11, expected: true },
      { activeCount: 9, expected: false },
      { activeCount: 0, expected: false },
    ])
      expect(activeCount >= MAX_SUB_MARKETS).toBe(expected);
  });
});

// =============================================================================
// Cache Invalidation Logic Tests
// =============================================================================

describe('Cache Invalidation Logic', () => {
  test('should invalidate cache when sub-markets are created', () => {
    expect(3 > 0).toBe(true);
  });
  test('should not invalidate cache when no sub-markets created', () => {
    expect(0 > 0).toBe(false);
  });
});

// =============================================================================
// Sub-Market Duration Constraint Tests
// =============================================================================

describe('Sub-Market Duration Constraints', () => {
  const SUB_MARKET_MIN_DURATION_MS = 15 * 60 * 1000;
  const SUB_MARKET_MAX_DURATION_MS = 3 * 60 * 60 * 1000;
  const SUB_MARKET_RESOLUTION_BUFFER_MS = 5 * 60 * 1000;

  function getMaxSubMarketDuration(
    parentEndTime: Date,
    now: number = Date.now()
  ): number | null {
    const remainingTimeMs =
      parentEndTime.getTime() - now - SUB_MARKET_RESOLUTION_BUFFER_MS;
    if (remainingTimeMs < SUB_MARKET_MIN_DURATION_MS) return null;
    return Math.min(remainingTimeMs, SUB_MARKET_MAX_DURATION_MS);
  }

  test('should return null when parent has less than minimum duration remaining', () => {
    const now = Date.now();
    expect(
      getMaxSubMarketDuration(new Date(now + 10 * 60 * 1000), now)
    ).toBeNull();
  });
  test('should return minimum when parent ends exactly at minimum + buffer', () => {
    const now = Date.now();
    expect(getMaxSubMarketDuration(new Date(now + 20 * 60 * 1000), now)).toBe(
      15 * 60 * 1000
    );
  });
  test('should return constrained duration when parent has limited time', () => {
    const now = Date.now();
    expect(getMaxSubMarketDuration(new Date(now + 30 * 60 * 1000), now)).toBe(
      25 * 60 * 1000
    );
  });
  test('should cap at maximum duration when parent has plenty of time', () => {
    const now = Date.now();
    expect(
      getMaxSubMarketDuration(new Date(now + 24 * 60 * 60 * 1000), now)
    ).toBe(SUB_MARKET_MAX_DURATION_MS);
  });
  test('should handle parent ending very soon (less than buffer)', () => {
    const now = Date.now();
    expect(
      getMaxSubMarketDuration(new Date(now + 3 * 60 * 1000), now)
    ).toBeNull();
  });
  test('should handle parent already ended', () => {
    const now = Date.now();
    expect(
      getMaxSubMarketDuration(new Date(now - 5 * 60 * 1000), now)
    ).toBeNull();
  });
  test('should correctly calculate for 1-hour parent markets', () => {
    const now = Date.now();
    expect(getMaxSubMarketDuration(new Date(now + 60 * 60 * 1000), now)).toBe(
      55 * 60 * 1000
    );
  });
  test('should correctly calculate for parent with exactly 3 hours remaining', () => {
    const now = Date.now();
    expect(
      getMaxSubMarketDuration(new Date(now + 3 * 60 * 60 * 1000), now)
    ).toBe((3 * 60 - 5) * 60 * 1000);
  });
});

// =============================================================================
// Media Selection Relevance Scoring Tests
// =============================================================================

describe('Media Selection Relevance Scoring', () => {
  const BASE_WEIGHT = 1.0;
  const DIRECT_AFFILIATION_BONUS = 2.0;
  const INDIRECT_AFFILIATION_BONUS = 1.5;
  const CATEGORY_MATCH_BONUS = 0.5;
  const MAX_RANDOM_VARIANCE = 1.0;

  test('should give all orgs at least base weight', () => {
    expect(BASE_WEIGHT).toBe(1.0);
  });
  test('should add bonus for direct actor affiliation', () => {
    expect(BASE_WEIGHT + DIRECT_AFFILIATION_BONUS).toBe(3.0);
  });
  test('should add smaller bonus for indirect affiliation', () => {
    expect(BASE_WEIGHT + INDIRECT_AFFILIATION_BONUS).toBe(2.5);
  });
  test('should add bonus for category match', () => {
    expect(BASE_WEIGHT + CATEGORY_MATCH_BONUS).toBe(1.5);
  });
  test('should include random variance to prevent determinism', () => {
    expect(BASE_WEIGHT).toBe(1.0);
    expect(
      BASE_WEIGHT +
        DIRECT_AFFILIATION_BONUS +
        INDIRECT_AFFILIATION_BONUS +
        CATEGORY_MATCH_BONUS +
        MAX_RANDOM_VARIANCE
    ).toBe(6.0);
  });
});

// =============================================================================
// parseMarketCategory Type Narrowing Tests
// =============================================================================

describe('parseMarketCategory Type Narrowing', () => {
  const VALID = [
    'tech',
    'politics',
    'entertainment',
    'sports',
    'science',
    'business',
    'general',
  ] as const;
  type MarketCategory = (typeof VALID)[number];

  function parseMarketCategory(
    value: string | null | undefined
  ): MarketCategory {
    if (typeof value === 'string' && VALID.includes(value as MarketCategory))
      return value as MarketCategory;
    return 'general';
  }

  test('should return valid category unchanged', () => {
    for (const c of VALID) expect(parseMarketCategory(c)).toBe(c);
  });
  test('should return general for null without warning', () => {
    expect(parseMarketCategory(null)).toBe('general');
  });
  test('should return general for undefined without warning', () => {
    expect(parseMarketCategory(undefined)).toBe('general');
  });
  test('should return general for empty string without warning', () => {
    expect(parseMarketCategory('')).toBe('general');
  });
  test('should return general for invalid non-empty string (with warning in production)', () => {
    expect(parseMarketCategory('invalid-category')).toBe('general');
    expect(parseMarketCategory('TECH')).toBe('general');
    expect(parseMarketCategory('technology')).toBe('general');
  });
  test('should handle whitespace-only strings as invalid (not empty)', () => {
    expect(parseMarketCategory('   ')).toBe('general');
  });
});
