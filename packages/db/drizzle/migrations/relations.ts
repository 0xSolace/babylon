/**
 * Drizzle Relations Configuration
 *
 * @deprecated LEGACY FILE - Used for PostgreSQL/Drizzle ORM relations.
 *
 * The project has migrated to CQL (CovenantSQL) as the PRIMARY database.
 * CQL uses a different approach for relations (typically at query time).
 *
 * This file is kept for:
 * - Reference during migration
 * - Potential future use if Drizzle is needed for specific operations
 *
 * For relation queries in CQL, use JOIN syntax in raw SQL or
 * multiple queries with application-level joining.
 *
 * @see cql-client.ts - The new PRIMARY database interface
 * @see src/schema/ - Shared schema definitions (still active)
 */

import { relations } from "drizzle-orm/relations";
import {  } from "./schema";

