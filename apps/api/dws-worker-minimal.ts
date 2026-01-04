/**
 * Minimal Babylon API Worker for DWS Testing
 * This is a simple test worker to verify DWS deployment works
 */

// Simple fetch handler
export const fetch = async (request: Request): Promise<Response> => {
  const url = new URL(request.url)
  
  // Strip /http prefix if present (from DWS worker routing)
  let pathname = url.pathname
  if (pathname.startsWith('/http/')) {
    pathname = pathname.substring(5)
  } else if (pathname === '/http') {
    pathname = '/'
  }
  
  // Health endpoint
  if (pathname === '/health' || pathname === '/api/health') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        service: 'babylon-api',
        version: '2.0.0',
        mode: 'dws-worker',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  // Root endpoint
  if (pathname === '/' || pathname === '/api') {
    return new Response(
      JSON.stringify({
        name: 'Babylon API',
        version: '2.0.0',
        status: 'deployed',
        endpoints: ['/health', '/api/health'],
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  // 404 for everything else
  return new Response(
    JSON.stringify({ error: 'Not found', path: pathname, originalPath: url.pathname }),
    {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

// Default export for module workers
export default {
  fetch,
}

// Auto-start if running directly
if (import.meta.main) {
  const PORT = Number(process.env.PORT) || 5009

  const server = Bun.serve({
    port: PORT,
    fetch,
  })

  console.log(`Babylon API minimal worker listening on port ${PORT}`)
}
