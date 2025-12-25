/**
 * Eden Treaty client factory for typed API clients
 */
import { treaty as edenTreaty, type Treaty } from '@elysiajs/eden'
import type { Elysia } from 'elysia'

export type { Treaty }
export { edenTreaty as treaty }

/**
 * Creates a typed Eden Treaty client for any Elysia app.
 *
 * Usage:
 * ```typescript
 * import type { BabylonServerApp } from '@babylon/client/types';
 * import { createClient } from '@babylon/client';
 *
 * const client = createClient<BabylonServerApp>('http://localhost:5008');
 * // client is now fully typed with all routes from the server
 * ```
 *
 * @param baseUrl - The API base URL (e.g., 'http://localhost:5008')
 * @returns Typed client with full inference from the App type
 */
export function createClient<App extends Elysia>(
  baseUrl: string,
): Treaty.Create<App> {
  return edenTreaty<App>(baseUrl)
}
