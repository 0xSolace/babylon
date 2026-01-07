import { cors } from '@elysiajs/cors'

// Port configuration from centralized env vars
const BABYLON_WEB_PORT = process.env.BABYLON_WEB_PORT ?? '5008'
const BABYLON_API_PORT = process.env.BABYLON_API_PORT ?? '5009'

// Local development origins for JNS gateway
const LOCAL_ORIGINS = [
  `http://localhost:${BABYLON_WEB_PORT}`,
  `http://localhost:${BABYLON_API_PORT}`,
  'http://babylon.local.jejunetwork.org:8080',
  'http://babylon.local.jejunetwork.org',
  'http://localhost:8080',
]

/**
 * CORS middleware configuration for Babylon API server
 */
export const corsMiddleware = cors({
  origin: process.env.CORS_ORIGINS?.split(',') || LOCAL_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposeHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining'],
  maxAge: 86400,
})
