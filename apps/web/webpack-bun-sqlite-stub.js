/**
 * Stub for bun:sqlite module
 *
 * This module provides a no-op implementation for webpack builds
 * that try to bundle bun:sqlite. The actual bun:sqlite is only
 * available in Bun runtime, not Node.js.
 *
 * At runtime in Bun, the actual module will be used.
 * During webpack bundling in Node.js, this stub prevents build errors.
 */

class Database {
  constructor() {
    throw new Error(
      'bun:sqlite is not available in this environment. Use Bun runtime.'
    );
  }
}

module.exports = {
  Database,
  default: Database,
};
