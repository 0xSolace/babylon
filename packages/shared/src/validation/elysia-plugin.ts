/**
 * Elysia Plugin for Zod Validation
 *
 * Provides a plugin that adds Zod validation helpers to Elysia context.
 * Use this to validate request body and query params with existing Zod schemas.
 */

import { Elysia } from 'elysia'
import type { z } from 'zod'

/**
 * Safe parse result type compatible with Zod v4
 */
type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError }

/**
 * Zod validation context type for type inference
 * Includes index signature to be compatible with Elysia's derive() return type
 */
interface ZodValidationContext {
  [key: string]: unknown
  /**
   * Validate request body with a Zod schema
   * @throws Error if validation fails
   */
  validateBody<T extends z.ZodType>(schema: T): z.infer<T>
  /**
   * Validate query parameters with a Zod schema
   * @throws Error if validation fails
   */
  validateQuery<T extends z.ZodType>(schema: T): z.infer<T>
  /**
   * Validate request params with a Zod schema
   * @throws Error if validation fails
   */
  validateParams<T extends z.ZodType>(schema: T): z.infer<T>
  /**
   * Safe validation that returns result instead of throwing
   */
  safeValidateBody<T extends z.ZodType>(schema: T): SafeParseResult<z.infer<T>>
  /**
   * Safe validation that returns result instead of throwing
   */
  safeValidateQuery<T extends z.ZodType>(schema: T): SafeParseResult<z.infer<T>>
}

/**
 * Formats Zod validation errors into a readable message
 */
function formatZodError(error: z.ZodError, context?: string): string {
  const message = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
      return `${path}${issue.message}`
    })
    .join('; ')
  return context ? `${context}: ${message}` : message
}

/**
 * Elysia plugin that adds Zod validation helpers to context.
 *
 * @example
 * ```typescript
 * import { zodPlugin } from '@babylon/shared';
 *
 * const app = new Elysia()
 *   .use(zodPlugin)
 *   .post('/user', ({ body, validateBody }) => {
 *     const user = validateBody(UserSchema);
 *     // user is now typed as z.infer<typeof UserSchema>
 *     return { success: true, user };
 *   });
 * ```
 */
export const zodPlugin = new Elysia({ name: 'zod-plugin' }).derive(
  ({ body, query, params }) => {
    const context: ZodValidationContext = {
      validateBody<T extends z.ZodType>(schema: T): z.infer<T> {
        const result = schema.safeParse(body)
        if (!result.success) {
          throw new Error(formatZodError(result.error, 'body'))
        }
        return result.data
      },

      validateQuery<T extends z.ZodType>(schema: T): z.infer<T> {
        const result = schema.safeParse(query)
        if (!result.success) {
          throw new Error(formatZodError(result.error, 'query'))
        }
        return result.data
      },

      validateParams<T extends z.ZodType>(schema: T): z.infer<T> {
        const result = schema.safeParse(params)
        if (!result.success) {
          throw new Error(formatZodError(result.error, 'params'))
        }
        return result.data
      },

      safeValidateBody<T extends z.ZodType>(
        schema: T,
      ): SafeParseResult<z.infer<T>> {
        const result = schema.safeParse(body)
        // Zod's safeParse result is compatible with SafeParseResult
        // TypeScript needs help with the generic inference
        if (result.success) {
          return { success: true, data: result.data }
        }
        return { success: false, error: result.error }
      },

      safeValidateQuery<T extends z.ZodType>(
        schema: T,
      ): SafeParseResult<z.infer<T>> {
        const result = schema.safeParse(query)
        if (result.success) {
          return { success: true, data: result.data }
        }
        return { success: false, error: result.error }
      },
    }
    return context
  },
)

/**
 * Creates a scoped Zod plugin with custom error handling
 *
 * @param options - Configuration options
 * @returns An Elysia plugin instance
 *
 * @example
 * ```typescript
 * const customZodPlugin = createZodPlugin({
 *   onError: (error) => {
 *     logger.error('Validation failed', { error });
 *     throw new ValidationError(error.message);
 *   },
 * });
 * ```
 */
export function createZodPlugin(options?: {
  onError?: (error: Error) => never
}) {
  return new Elysia({ name: 'zod-plugin-custom' }).derive(
    ({ body, query, params }) => ({
      validateBody<T extends z.ZodType>(schema: T): z.infer<T> {
        const result = schema.safeParse(body)
        if (!result.success) {
          const error = new Error(formatZodError(result.error, 'body'))
          if (options?.onError) {
            options.onError(error)
          }
          throw error
        }
        return result.data
      },

      validateQuery<T extends z.ZodType>(schema: T): z.infer<T> {
        const result = schema.safeParse(query)
        if (!result.success) {
          const error = new Error(formatZodError(result.error, 'query'))
          if (options?.onError) {
            options.onError(error)
          }
          throw error
        }
        return result.data
      },

      validateParams<T extends z.ZodType>(schema: T): z.infer<T> {
        const result = schema.safeParse(params)
        if (!result.success) {
          const error = new Error(formatZodError(result.error, 'params'))
          if (options?.onError) {
            options.onError(error)
          }
          throw error
        }
        return result.data
      },
    }),
  )
}

export type { ZodValidationContext }
