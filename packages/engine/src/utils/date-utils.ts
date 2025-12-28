/**
 * Date Utilities
 * Shared date parsing and extraction utilities for the game engine.
 */

/**
 * Extract day number from timestamp string.
 * Assumes game runs in October 2025 format: "2025-10-DDTHH:MM:SSZ"
 */
export function extractDayFromTimestamp(timestamp: string): number {
  // Try ISO format: "2025-10-15T12:00:00Z"
  const isoMatch = timestamp.match(/2025-10-(\d{2})/)
  if (isoMatch?.[1]) {
    return Number.parseInt(isoMatch[1], 10)
  }

  // Fallback: try to extract from any date format
  const dateMatch = timestamp.match(/-(\d{2})T/)
  if (dateMatch?.[1]) {
    return Number.parseInt(dateMatch[1], 10)
  }

  return 0
}

/**
 * Extract day number from an event object (handles different formats)
 */
export function extractDayFromEvent(event: {
  day?: number
  timestamp?: Date | string
}): number {
  if (event.day) return event.day
  if (event.timestamp) {
    return extractDayFromTimestamp(
      typeof event.timestamp === 'string'
        ? event.timestamp
        : event.timestamp.toISOString(),
    )
  }
  return 0
}

/**
 * Extract day number from a post object
 */
export function extractDayFromPost(post: {
  day?: number
  createdAt?: Date | string
}): number {
  if (post.day) return post.day
  if (post.createdAt) {
    return extractDayFromTimestamp(
      typeof post.createdAt === 'string'
        ? post.createdAt
        : post.createdAt.toISOString(),
    )
  }
  return 0
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Compute a game-relative day number (0-indexed) from a game start time.
 *
 * @param startedAt - The continuous game's start timestamp (Date or ISO string)
 * @param timestamp - The content/event timestamp (Date or ISO string)
 * @returns 0-indexed day number since startedAt (can be negative if timestamp < startedAt)
 */
export function getGameDayNumber(
  startedAt: Date | string,
  timestamp: Date | string,
): number {
  // Handle ISO string dates from EQLite
  const start = typeof startedAt === 'string' ? new Date(startedAt) : startedAt
  const ts = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  return Math.floor((ts.getTime() - start.getTime()) / MS_PER_DAY)
}

/**
 * Validate a dayNumber for storage in Post/WorldEvent int columns.
 */
export function toSafeDayNumber(dayNumber: number): number | undefined {
  return Number.isFinite(dayNumber) && dayNumber >= 0 && dayNumber <= 2147483647
    ? dayNumber
    : undefined
}
