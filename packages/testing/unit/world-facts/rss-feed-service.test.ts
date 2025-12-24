/**
 * RSS Feed Service Unit Tests
 *
 * These are true unit tests that test RSS parsing logic without database access.
 * For database integration tests, see tests/integration/
 */

import { describe, expect, test } from 'bun:test'
import { rssFeedService } from '@babylon/engine'

// Helper to create mock fetch with proper typing
function createMockFetch(
  mockResponse: Partial<Response>,
): typeof fetch & { preconnect: typeof fetch.preconnect } {
  const mockFn = async () => mockResponse as Response
  return Object.assign(mockFn, {
    preconnect: fetch.preconnect,
  }) as typeof fetch & { preconnect: typeof fetch.preconnect }
}

describe('RSSFeedService', () => {
  test('should parse RSS 2.0 format', async () => {
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Test Item 1</title>
      <link>https://example.com/item1</link>
      <pubDate>Wed, 13 Nov 2024 12:00:00 GMT</pubDate>
      <description>Test description</description>
    </item>
    <item>
      <title>Test Item 2</title>
      <link>https://example.com/item2</link>
    </item>
  </channel>
</rss>`

    // Mock fetch for this test
    const originalFetch = global.fetch
    global.fetch = createMockFetch({
      ok: true,
      text: async () => rssXml,
    })

    try {
      const feed = await rssFeedService.fetchFeed(
        'https://example.com/test.xml',
      )

      expect(feed).toBeDefined()
      expect(feed.title).toBe('Test Feed')
      expect(feed.items).toHaveLength(2)
      expect(feed.items[0]?.title).toBe('Test Item 1')
      expect(feed.items[0]?.link).toBe('https://example.com/item1')
    } finally {
      global.fetch = originalFetch
    }
  })

  test('should handle fetch errors gracefully', async () => {
    // Mock fetch to fail
    const originalFetch = global.fetch
    global.fetch = createMockFetch({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    try {
      await expect(
        rssFeedService.fetchFeed('https://example.com/nonexistent.xml'),
      ).rejects.toThrow()
    } finally {
      global.fetch = originalFetch
    }
  })

  test('service should be defined with expected methods', () => {
    expect(rssFeedService).toBeDefined()
    expect(typeof rssFeedService.fetchFeed).toBe('function')
  })
})
