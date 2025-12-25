/**
 * Testing Type Guards and Response Validation Utilities
 *
 * Testing-specific utilities for type-safe response parsing and environment variable handling.
 * For base type guards, import from @babylon/shared.
 */

import { hasBooleanProperty, hasStringProperty } from '@jejunetwork/shared'
import type { Address } from 'viem'
import { isAddress } from 'viem'
import { z } from 'zod'

// ============================================================================
// Environment Variable Helpers
// ============================================================================

/**
 * Gets an environment variable as an Address, or undefined if not set or invalid
 */
export function getEnvAddress(key: string): Address | undefined {
  const value = process.env[key]
  if (!value || !isAddress(value)) {
    return undefined
  }
  return value
}

/**
 * Type guard for hex string format
 */
function isHexString(value: string): value is `0x${string}` {
  return value.startsWith('0x')
}

/**
 * Gets an environment variable as a hex string, or undefined if not set or invalid
 */
export function getEnvHex(key: string): `0x${string}` | undefined {
  const value = process.env[key]
  if (!value || !isHexString(value)) {
    return undefined
  }
  return value
}

/**
 * Gets an environment variable as a string, or undefined if not set
 */
export function getEnvString(key: string): string | undefined {
  return process.env[key]
}

/**
 * Gets an environment variable as a number, or undefined if not set or invalid
 */
export function getEnvNumber(key: string): number | undefined {
  const value = process.env[key]
  if (!value) return undefined
  const num = Number(value)
  return Number.isNaN(num) ? undefined : num
}

// ============================================================================
// Test/Network Mode Type Guards
// ============================================================================

const TEST_MODES = [
  'unit',
  'integration',
  'e2e',
  'decentralized',
  'all',
] as const
export type TestMode = (typeof TEST_MODES)[number]

export function isTestMode(value: string): value is TestMode {
  return (TEST_MODES as readonly string[]).includes(value)
}

export function parseTestMode(value: string | undefined): TestMode {
  if (value && isTestMode(value)) {
    return value
  }
  return 'integration'
}

const NETWORK_MODES = ['localnet', 'testnet', 'mainnet'] as const
export type NetworkMode = (typeof NETWORK_MODES)[number]

export function isNetworkMode(value: string): value is NetworkMode {
  return (NETWORK_MODES as readonly string[]).includes(value)
}

export function parseNetworkMode(value: string | undefined): NetworkMode {
  if (value && isNetworkMode(value)) {
    return value
  }
  return 'localnet'
}

// ============================================================================
// Response Parsing Schemas
// ============================================================================

// Health check response
export const HealthResponseSchema = z.object({
  status: z.string(),
})
export type HealthResponse = z.infer<typeof HealthResponseSchema>

// Chain ID response (JSON-RPC)
export const ChainIdResponseSchema = z.object({
  result: z.string().optional(),
})
export type ChainIdResponse = z.infer<typeof ChainIdResponseSchema>

// Key generation response
export const KeyGenerationResponseSchema = z.object({
  publicKey: z.string(),
  metadata: z.object({
    id: z.string(),
  }),
})
export type KeyGenerationResponse = z.infer<typeof KeyGenerationResponseSchema>

// Message send response
export const MessageSendResponseSchema = z.object({
  success: z.boolean(),
  messageId: z.string(),
})
export type MessageSendResponse = z.infer<typeof MessageSendResponseSchema>

// Messages list response
export const MessagesListResponseSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      sender: z.string(),
    }),
  ),
})
export type MessagesListResponse = z.infer<typeof MessagesListResponseSchema>

// Message ack response
export const MessageAckResponseSchema = z.object({
  success: z.boolean(),
})
export type MessageAckResponse = z.infer<typeof MessageAckResponseSchema>

// Generic success response
export const SuccessResponseSchema = z.object({
  success: z.boolean(),
})
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>

// Balance response
export const BalanceResponseSchema = z.object({
  balance: z.string(),
})
export type BalanceResponse = z.infer<typeof BalanceResponseSchema>

// CQL query response
export const CQLQueryResponseSchema = z.object({
  rows: z.array(z.unknown()).optional(),
})
export type CQLQueryResponse = z.infer<typeof CQLQueryResponseSchema>

// KMS sign response
export const SignResponseSchema = z.object({
  signature: z.string().optional(),
})
export type SignResponse = z.infer<typeof SignResponseSchema>

// Services list response
export const ServicesResponseSchema = z.object({
  services: z.array(z.string()),
})
export type ServicesResponse = z.infer<typeof ServicesResponseSchema>

// Upload response
export const UploadResponseSchema = z.object({
  cid: z.string(),
})
export type UploadResponse = z.infer<typeof UploadResponseSchema>

// Models list response
export const ModelsResponseSchema = z.object({
  models: z.array(
    z.object({
      id: z.string(),
    }),
  ),
})
export type ModelsResponse = z.infer<typeof ModelsResponseSchema>

// Session response
export const SessionResponseSchema = z.object({
  token: z.string(),
})
export type SessionResponse = z.infer<typeof SessionResponseSchema>

// ID response
export const IdResponseSchema = z.object({
  id: z.string(),
})
export type IdResponse = z.infer<typeof IdResponseSchema>

// Training health response
export const TrainingHealthResponseSchema = z.object({
  status: z.string(),
  endpoints: z.record(z.string(), z.string()).optional(),
})
export type TrainingHealthResponse = z.infer<
  typeof TrainingHealthResponseSchema
>

// Training result response
export const TrainingResultResponseSchema = z.object({
  success: z.boolean().optional(),
  modelId: z.string().optional(),
  error: z.string().optional(),
})
export type TrainingResultResponse = z.infer<
  typeof TrainingResultResponseSchema
>

// OpenAPI spec response
export const OpenAPISpecResponseSchema = z.object({
  paths: z.record(z.string(), z.unknown()).optional(),
  info: z
    .object({
      title: z.string().optional(),
      version: z.string().optional(),
    })
    .optional(),
})
export type OpenAPISpecResponse = z.infer<typeof OpenAPISpecResponseSchema>

// ============================================================================
// Response Parsing Helpers
// ============================================================================

/**
 * Safely parses a JSON response with a Zod schema
 * Returns the parsed data or null if parsing fails
 */
export async function parseResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T | null> {
  try {
    const data: unknown = await response.json()
    const result = schema.safeParse(data)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/**
 * Safely parses a JSON response with a Zod schema
 * Returns the parsed data or throws if parsing fails
 */
export async function parseResponseOrThrow<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  const data: unknown = await response.json()
  return schema.parse(data)
}

/**
 * Safely parses a JSON response and returns the raw data
 * This is a transitional helper for cases where we need to accept arbitrary JSON
 */
export async function parseJsonResponse(response: Response): Promise<unknown> {
  return response.json()
}

// ============================================================================
// Specialized Type Guards for Common Patterns
// ============================================================================

/**
 * Type guard for health check response
 */
export function isHealthResponse(value: unknown): value is HealthResponse {
  return hasStringProperty(value, 'status')
}

/**
 * Type guard for success response
 */
export function isSuccessResponse(value: unknown): value is SuccessResponse {
  return hasBooleanProperty(value, 'success')
}
