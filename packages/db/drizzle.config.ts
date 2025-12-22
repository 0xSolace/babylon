/**
 * Drizzle Kit Configuration
 *
 * @deprecated LEGACY FILE - Used for PostgreSQL migrations.
 *
 * The project has migrated to CQL (CovenantSQL) as the PRIMARY database.
 * This file is kept for:
 * - Reference during migration
 * - Potential future use for schema generation/introspection
 * - Backward compatibility with existing PostgreSQL tooling
 *
 * For new migrations, CQL handles schema through its own migration system.
 * Schema definitions in src/schema/ are still used by both systems.
 *
 * @see cql-client.ts - The new PRIMARY database interface
 * @see src/schema/ - Shared schema definitions
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Determine if we're in local development mode
const isLocalDev =
  process.env.DEPLOYMENT_ENV === 'localnet' ||
  process.env.NODE_ENV === 'development' ||
  !process.env.DIRECT_DATABASE_URL;

// Local development database URL (matches docker-compose setup)
const LOCAL_DATABASE_URL =
  'postgresql://babylon:babylon_dev_password@localhost:5433/babylon';

// Use local URL for development, production URL only when explicitly set
const databaseUrl = isLocalDev
  ? (process.env.DATABASE_URL ?? LOCAL_DATABASE_URL)
  : (process.env.DIRECT_DATABASE_URL ??
    process.env.DATABASE_URL ??
    LOCAL_DATABASE_URL);

export default defineConfig({
  // Use absolute paths resolved from config location for CI compatibility
  schema: resolve(__dirname, './src/schema/index.ts'),
  out: resolve(__dirname, './drizzle/migrations'),
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
