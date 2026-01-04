/**
 * Validation exports
 * 
 * NOTE: elysia and elysia-plugin are NOT exported by default to prevent
 * browser bundles from pulling in server-side elysia dependencies.
 * 
 * To use elysia validation:
 *   import { createValidation } from '@babylon/shared/src/validation/elysia'
 *   import { validationPlugin } from '@babylon/shared/src/validation/elysia-plugin'
 */

export * from './content-validator'
export * from './schemas'

// Server-only exports - import directly from file path when needed:
// export * from './elysia'
// export * from './elysia-plugin'
