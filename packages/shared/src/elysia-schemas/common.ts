/**
 * Common Elysia Type Schemas
 *
 * Shared schemas for common API patterns
 */

import { t } from 'elysia';

/**
 * Pagination query parameters
 */
export const PaginationQuery = t.Object({
  limit: t.Optional(t.Number({ default: 50, minimum: 1, maximum: 100 })),
  offset: t.Optional(t.Number({ default: 0, minimum: 0 })),
  cursor: t.Optional(t.String()),
});

/**
 * Standard success response wrapper
 */
export const SuccessResponse = t.Object({
  success: t.Literal(true),
});

/**
 * Standard error response
 */
export const ErrorResponse = t.Object({
  error: t.String(),
  code: t.Optional(t.String()),
  details: t.Optional(t.Any()),
});

/**
 * Snowflake ID schema
 */
export const SnowflakeId = t.String({ minLength: 15, maxLength: 20 });

/**
 * UUID schema
 */
export const UUID = t.String({
  pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
});

/**
 * Ethereum wallet address
 */
export const WalletAddress = t.String({
  pattern: '^0x[a-fA-F0-9]{40}$',
});

/**
 * ISO date string
 */
export const ISODateString = t.String();

/**
 * URL string
 */
export const URLString = t.String();

/**
 * Generic paginated response
 */
export function paginatedResponse<T extends ReturnType<typeof t.Object>>(itemSchema: T) {
  return t.Object({
    success: t.Boolean(),
    items: t.Array(itemSchema),
    total: t.Optional(t.Number()),
    limit: t.Number(),
    offset: t.Optional(t.Number()),
    cursor: t.Optional(t.Nullable(t.String())),
    hasMore: t.Boolean(),
  });
}

