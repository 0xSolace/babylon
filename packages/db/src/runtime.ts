/**
 * Database runtime — connection, RLS helpers, Drizzle table symbols, JSON snapshot hooks.
 *
 * Outside `packages/db`, import `@babylon/db/engine-storage` (same exports). This entry stays
 * for internal re-exports and tooling that already resolves `@babylon/db/runtime`.
 * Prefer `@babylon/db` for operators, row types (`export type * from './tables'`), and query helpers
 * that do not require the process-wide service singleton.
 */

export * from './db';

import * as tables from './tables';
export { tables };

export { DatabaseService, getDbInstance } from './database-service';
export * from './tables';
