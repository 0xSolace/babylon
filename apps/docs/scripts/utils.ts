/**
 * Shared utilities for documentation generation scripts
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

// ============================================================================
// File System Utilities
// ============================================================================

/**
 * Filter function type for walkDirectory
 * Returns true if the file should be included in results
 */
export type FileFilter = (entry: { name: string; path: string }) => boolean

/**
 * Recursively walk a directory and yield file paths that match the filter
 *
 * @param dir - Directory to walk
 * @param filter - Filter function to determine which files to yield
 * @yields File paths that pass the filter
 *
 * @example
 * // Find all route.ts files
 * for await (const file of walkDirectory(apiDir, ({ name }) => name === 'route.ts')) {
 *   console.log(file);
 * }
 *
 * @example
 * // Find all .json files
 * for await (const file of walkDirectory(outDir, ({ name }) => name.endsWith('.json'))) {
 *   console.log(file);
 * }
 */
export async function* walkDirectory(
  dir: string,
  filter: FileFilter,
): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      yield* walkDirectory(fullPath, filter)
    } else if (entry.isFile() && filter({ name: entry.name, path: fullPath })) {
      yield fullPath
    }
  }
}

/**
 * Create a filter that matches files by name
 */
export const byFileName =
  (name: string): FileFilter =>
  (entry) =>
    entry.name === name

/**
 * Create a filter that matches files by extension
 */
export const byExtension =
  (ext: string): FileFilter =>
  (entry) =>
    entry.name.endsWith(ext)

/**
 * Create a filter that matches files by any of the given extensions
 */
export const byExtensions =
  (extensions: string[]): FileFilter =>
  (entry) =>
    extensions.some((ext) => entry.name.endsWith(ext))

/**
 * Collect all files from walkDirectory into an array
 * Useful when you need all files at once rather than streaming
 */
export async function collectFiles(
  dir: string,
  filter: FileFilter,
): Promise<string[]> {
  const files: string[] = []
  for await (const file of walkDirectory(dir, filter)) {
    files.push(file)
  }
  return files
}
