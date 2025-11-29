/**
 * Eden Treaty API Client
 *
 * Type-safe API client for Elysia endpoints.
 */
import { treaty } from '@elysiajs/eden';
import type { App } from '@/app/api/elysia/[[...slug]]/route';

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

/**
 * Type-safe API client for Elysia endpoints
 */
export const api = treaty<App>(getBaseUrl(), {
  fetch: {
    credentials: 'include',
  },
});

/**
 * Create a server-side API client with a specific base URL
 */
export function createServerApi(baseUrl: string) {
  return treaty<App>(baseUrl);
}

/**
 * Type helpers for API responses
 */
export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: { status: number; value: unknown } };

export type ExtractData<T> = T extends { data: infer D } ? D : never;

export function isSuccess<T>(
  response: { data: T | null; error: unknown }
): response is { data: T; error: null } {
  return response.error === null && response.data !== null;
}

export function isError<E>(
  response: { data: unknown; error: E | null }
): response is { data: null; error: E } {
  return response.error !== null;
}
