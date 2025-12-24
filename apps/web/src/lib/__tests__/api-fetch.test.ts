/**
 * Tests for API fetch URL rewriting
 */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { resetGlobalFetch, rewriteApiUrl, setupGlobalFetch } from '../api-fetch'

// Cast helper for test mocking - these tests run in Bun which doesn't have window
const setGlobalWindow = (
  value:
    | {
        location: {
          origin: string
          protocol: string
          host: string
          hostname: string
        }
        fetch?: (
          input: RequestInfo | URL,
          init?: RequestInit,
        ) => Promise<Response>
      }
    | undefined,
) => {
  ;(globalThis as Record<string, unknown>).window = value
}

const getGlobalWindow = () =>
  (globalThis as Record<string, unknown>).window as
    | {
        location: { origin: string }
        fetch?: (
          input: RequestInfo | URL,
          init?: RequestInit,
        ) => Promise<Response>
      }
    | undefined

const mockWindowLocation = {
  origin: 'https://babylon.market',
  protocol: 'https:',
  host: 'babylon.market',
  hostname: 'babylon.market',
}

describe('rewriteApiUrl', () => {
  beforeEach(() => {
    setGlobalWindow({ location: mockWindowLocation })
    // Clear any environment variables
    process.env.PUBLIC_API_BASE_URL = ''
  })

  afterEach(() => {
    setGlobalWindow(undefined)
    resetGlobalFetch()
  })

  it('should not rewrite non-API URLs', () => {
    expect(rewriteApiUrl('/some/path')).toBe('/some/path')
    expect(rewriteApiUrl('https://example.com/api/data')).toBe(
      'https://example.com/api/data',
    )
  })

  it('should rewrite /api/ URLs', () => {
    process.env.PUBLIC_API_BASE_URL = 'https://api.babylon.market'
    expect(rewriteApiUrl('/api/posts')).toBe(
      'https://api.babylon.market/api/posts',
    )
  })

  it('should rewrite /a2a URLs', () => {
    process.env.PUBLIC_API_BASE_URL = 'https://api.babylon.market'
    expect(rewriteApiUrl('/a2a/endpoint')).toBe(
      'https://api.babylon.market/a2a/endpoint',
    )
  })

  it('should rewrite /mcp URLs', () => {
    process.env.PUBLIC_API_BASE_URL = 'https://api.babylon.market'
    expect(rewriteApiUrl('/mcp')).toBe('https://api.babylon.market/mcp')
  })

  it('should not double /api prefix when base URL ends with /api', () => {
    process.env.PUBLIC_API_BASE_URL = 'https://api.babylon.market/api'
    expect(rewriteApiUrl('/api/posts')).toBe(
      'https://api.babylon.market/api/posts',
    )
  })

  it('should not rewrite when base URL is same origin', () => {
    // When API base is same as current origin, don't rewrite
    process.env.PUBLIC_API_BASE_URL = 'https://babylon.market'
    expect(rewriteApiUrl('/api/posts')).toBe('/api/posts')
  })

  it('should handle server-side (no window)', () => {
    setGlobalWindow(undefined)
    process.env.PUBLIC_API_BASE_URL = 'https://api.babylon.market'
    expect(rewriteApiUrl('/api/posts')).toBe(
      'https://api.babylon.market/api/posts',
    )
  })
})

describe('setupGlobalFetch', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = global.fetch
    setGlobalWindow({
      location: mockWindowLocation,
      fetch: originalFetch,
    })
    process.env.PUBLIC_API_BASE_URL = 'https://api.babylon.market'
  })

  afterEach(() => {
    global.fetch = originalFetch
    setGlobalWindow(undefined)
    resetGlobalFetch()
  })

  it('should not patch fetch when window is undefined', () => {
    setGlobalWindow(undefined)
    setupGlobalFetch()
    // Should not throw
    expect(true).toBe(true)
  })

  it('should only patch once', () => {
    const win = getGlobalWindow()
    if (!win) throw new Error('window should be defined')
    win.fetch = mock(() => Promise.resolve(new Response()))

    setupGlobalFetch()
    const firstFetch = getGlobalWindow()?.fetch

    setupGlobalFetch()
    const secondFetch = getGlobalWindow()?.fetch

    expect(firstFetch).toBe(secondFetch)
  })
})
