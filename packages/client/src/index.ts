/**
 * @babylon/client - Typed Eden Treaty client factory for Babylon servers
 *
 * @example
 * ```typescript
 * import { createClient, type BabylonServerApp } from '@babylon/client';
 *
 * const client = createClient<BabylonServerApp>('http://localhost:5008');
 *
 * // Fully typed API calls
 * const health = await client.health.get();
 * const users = await client.api.users.me.get();
 * ```
 */

// Main client factory
export { createClient, type Treaty, treaty } from './treaty'
// Server App types for typed clients
export type { BabylonServerApp } from './types'
// Utilities for response handling
export { extractData, extractDataOrNull, handleEdenError } from './utils'
