/**
 * Zod-to-Elysia Validation Utilities
 *
 * Allows reusing existing Zod schemas with Elysia's validation system.
 * Elysia uses TypeBox by default, but these utilities enable Zod integration.
 */

import type { TSchema } from '@sinclair/typebox'
import { z } from 'zod'

/**
 * Marker interface for Zod-wrapped TypeBox schemas
 */
interface ZodWrappedSchema extends TSchema {
  $zodSchema: z.ZodType
}

/**
 * Zod wrapper structure for TypeBox compatibility.
 * Runtime-only type that bridges Zod schemas to Elysia's TypeBox system.
 */
interface ZodTypeBoxBridge {
  type: 'object'
  additionalProperties: true
  $zodSchema: z.ZodType
}

/**
 * Converts a Zod schema to a format Elysia can use for validation.
 * This creates a TypeBox-compatible schema wrapper that carries the Zod schema.
 *
 * ## Type Safety Note
 *
 * TypeBox's TSchema uses nominal typing via Symbol properties that cannot be
 * satisfied structurally. This is a deliberate limitation - TypeBox schemas
 * are not meant to be created without using TypeBox's Type.* constructors.
 *
 * However, Elysia's validation system accepts any object with the right runtime
 * shape. This function creates a bridge object that:
 * 1. Has TypeBox's expected runtime properties (type, additionalProperties)
 * 2. Carries our Zod schema for actual validation via $zodSchema
 * 3. Is recognized by isZodWrappedSchema() for runtime extraction
 *
 * The type assertion is documented and intentional - it's the standard pattern
 * for bridging between nominal (TypeBox) and structural (Zod) type systems.
 *
 * @param zodSchema - The Zod schema to convert
 * @returns A TypeBox-compatible schema that can be used with Elysia
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({ name: z.string(), age: z.number() });
 * app.post('/user', handler, { body: zodToTypeBox(UserSchema) });
 * ```
 */
export function zodToTypeBox<T extends z.ZodType>(zodSchema: T): TSchema {
  // Create a runtime bridge object that Elysia accepts as a TypeBox schema.
  // The $zodSchema property allows us to extract and use the real validator.
  const wrapper: ZodTypeBoxBridge = {
    type: 'object',
    additionalProperties: true,
    $zodSchema: zodSchema,
  }
  // Nominal type bridge: TypeBox's TSchema requires Symbol properties ([Kind],
  // params, static) that we cannot create structurally. The cast through
  // 'unknown' is required because TypeScript correctly identifies that our
  // bridge type doesn't satisfy TypeBox's nominal type constraints.
  // This is safe because Elysia's runtime only checks the runtime shape.
  return wrapper as unknown as TSchema
}

/**
 * Validator result from createZodValidator
 */
interface ZodValidator<T extends z.ZodType> {
  schema: T
  validate: (value: z.input<T>) => z.infer<T>
}

/**
 * Creates an Elysia-compatible validator from a Zod schema.
 * Use this with Elysia's .derive() or .guard() for validation.
 *
 * @param schema - The Zod schema to create a validator for
 * @returns An object with the schema and a validate function
 *
 * @example
 * ```typescript
 * const userValidator = createZodValidator(UserSchema);
 * const validated = userValidator.validate(requestBody);
 * ```
 */
export function createZodValidator<T extends z.ZodType>(
  schema: T,
): ZodValidator<T> {
  return {
    schema,
    validate: (value: z.input<T>): z.infer<T> => {
      const result = schema.safeParse(value)
      if (!result.success) {
        throw new Error(result.error.issues[0]?.message ?? 'Validation failed')
      }
      return result.data
    },
  }
}

/**
 * Parser interface returned by withZod
 */
interface ZodParser<T extends z.ZodType> {
  parse: (value: z.input<T>) => z.infer<T>
  safeParse: (value: z.input<T>) => ReturnType<T['safeParse']>
}

/**
 * Higher-order function to wrap a Zod schema for use with Elysia body/query.
 * Returns a transform function that validates and types the input.
 *
 * @param schema - The Zod schema to wrap
 * @returns An object with parse and safeParse methods
 *
 * @example
 * ```typescript
 * const parser = withZod(UserSchema);
 * const user = parser.parse(body); // Throws on invalid
 * const result = parser.safeParse(body); // Returns { success, data/error }
 * ```
 */
export function withZod<T extends z.ZodType>(schema: T): ZodParser<T> {
  return {
    parse: (value: z.input<T>): z.infer<T> => {
      return schema.parse(value)
    },
    safeParse: (value: z.input<T>): ReturnType<T['safeParse']> => {
      // Zod's safeParse returns the correct type, but TypeScript needs help
      // inferring the generic relationship between T and its safeParse result
      const result = schema.safeParse(value)
      return result as ReturnType<T['safeParse']>
    },
  }
}

/**
 * Validates request body with a Zod schema.
 * Throws on invalid input with descriptive error messages.
 *
 * @param schema - The Zod schema to validate against
 * @param body - The request body to validate
 * @param context - Optional context string for error messages
 * @returns The validated and typed body
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * const validated = validateBody(UserSchema, request.body, 'CreateUser');
 * // validated is now typed as z.infer<typeof UserSchema>
 * ```
 */
export function validateBody<T extends z.ZodType>(
  schema: T,
  body: z.input<T>,
  context?: string,
): z.infer<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(context ? `${context}: ${message}` : message)
  }
  return result.data
}

/**
 * Validates query parameters with a Zod schema.
 * Handles string coercion for query params.
 *
 * @param schema - The Zod schema to validate against
 * @param query - The query parameters object
 * @param context - Optional context string for error messages
 * @returns The validated and typed query params
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * const params = validateQuery(PaginationSchema, request.query, 'ListUsers');
 * ```
 */
export function validateQuery<T extends z.ZodType>(
  schema: T,
  query: Record<string, string | undefined>,
  context?: string,
): z.infer<T> {
  // Query params are always strings, but Zod schemas often expect coerced types.
  // Zod's parse() accepts unknown and will coerce/validate to the expected type.
  const result = schema.safeParse(query)
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(context ? `${context}: ${message}` : message)
  }
  return result.data
}

/**
 * Type guard to check if a TypeBox schema is a Zod-wrapped schema
 */
export function isZodWrappedSchema(
  schema: TSchema,
): schema is ZodWrappedSchema {
  return '$zodSchema' in schema && schema.$zodSchema instanceof z.ZodType
}

/**
 * Extracts the Zod schema from a wrapped TypeBox schema
 */
export function getZodSchema<T extends z.ZodType>(
  schema: TSchema,
): T | undefined {
  if (isZodWrappedSchema(schema)) {
    // The caller specifies the expected Zod schema type T.
    // Runtime validation happens through Zod, not this type assertion.
    const zodSchema = schema.$zodSchema
    return zodSchema as T
  }
  return undefined
}
