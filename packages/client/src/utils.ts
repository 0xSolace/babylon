/**
 * Eden client utilities for error handling and data extraction
 */

import { hasStringProperty, isObject } from '@jejunetwork/shared'

/**
 * Error response structure from Eden clients
 */
interface EdenErrorResponse {
  error: EdenError
}

/**
 * Eden error object with required message
 */
interface EdenError {
  message: string
}

/**
 * Type guard to check if a value is an Eden error response
 */
function isEdenErrorResponse(value: unknown): value is EdenErrorResponse {
  if (!isObject(value) || !('error' in value)) {
    return false
  }
  const { error } = value
  return isObject(error) && hasStringProperty(error, 'message')
}

/**
 * Standard error handler for Eden clients
 * Extracts error message and throws a proper Error
 */
export function handleEdenError(error: unknown): never {
  if (isEdenErrorResponse(error)) {
    throw new Error(error.error.message)
  }
  if (error instanceof Error) {
    throw error
  }
  throw new Error(String(error))
}

/**
 * Eden response structure with data and error
 */
interface EdenResponse<T> {
  data: T | null
  error: unknown
}

/**
 * Extract data from Eden response with error handling
 * Throws if there's an error or if data is null
 */
export function extractData<T>(response: EdenResponse<T>): T {
  if (response.error) {
    handleEdenError(response.error)
  }
  if (response.data === null) {
    throw new Error('No data returned from server')
  }
  return response.data
}

/**
 * Safely extract data from Eden response, returning null on error
 */
export function extractDataOrNull<T>(response: EdenResponse<T>): T | null {
  if (response.error || response.data === null) {
    return null
  }
  return response.data
}
