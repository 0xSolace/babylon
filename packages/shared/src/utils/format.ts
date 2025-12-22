/**
 * Formatting Utility Functions
 *
 * Pure utility functions for formatting dates, times, and numbers.
 */

/**
 * Clamp number between min and max values
 *
 * Ensures value stays within the specified range.
 *
 * @param value - Number to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value (guaranteed to be in [min, max] range)
 *
 * @example
 * ```typescript
 * clamp(150, 0, 100); // Returns: 100
 * clamp(-10, 0, 100); // Returns: 0
 * clamp(50, 0, 100);  // Returns: 50
 * ```
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Format date/timestamp to readable date string
 *
 * Supports both Date objects and ISO timestamp strings.
 *
 * @param date - Date object or ISO timestamp string
 * @returns Formatted date string (e.g., "Jan 1, 2025")
 *
 * @example
 * ```typescript
 * formatDate(new Date()); // "Jan 16, 2025"
 * formatDate("2025-01-16T10:00:00Z"); // "Jan 16, 2025"
 * ```
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date/timestamp to readable time string
 *
 * Supports both Date objects and ISO timestamp strings.
 *
 * @param date - Date object or ISO timestamp string
 * @returns Formatted time string (e.g., "3:45 PM")
 *
 * @example
 * ```typescript
 * formatTime(new Date()); // "3:45 PM"
 * formatTime("2025-01-16T15:45:00Z"); // "3:45 PM"
 * ```
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format relative time (e.g., "5m", "2h", "3d")
 *
 * @description Converts a date to a human-readable relative time string.
 * Shows seconds, minutes, hours, or days relative to now. Falls back to
 * formatted date for dates older than 7 days.
 *
 * @param {Date | string} date - Date to format
 * @returns {string} Relative time string (e.g., "5m", "2h", "3d") or formatted date
 *
 * @example
 * ```typescript
 * formatRelativeTime(new Date(Date.now() - 300000)) // Returns "5m"
 * formatRelativeTime(new Date(Date.now() - 86400000)) // Returns "1d"
 * ```
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return formatDate(d);
}

/**
 * Format number with K/M suffixes
 *
 * @description Formats large numbers with K (thousands) or M (millions) suffixes.
 * Rounds to one decimal place for readability.
 *
 * @param {number} num - Number to format
 * @returns {string} Formatted number string (e.g., "1.5K", "2.3M")
 *
 * @example
 * ```typescript
 * formatCompactNumber(1500) // Returns "1.5K"
 * formatCompactNumber(2300000) // Returns "2.3M"
 * formatCompactNumber(500) // Returns "500"
 * ```
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

/**
 * Format number as currency
 *
 * @description Formats a number as US dollar currency with specified decimal places.
 *
 * @param {number} amount - Amount to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted currency string (e.g., "$123.45")
 *
 * @example
 * ```typescript
 * formatCurrency(123.456) // Returns "$123.46"
 * formatCurrency(1000, 0) // Returns "$1000"
 * ```
 */
export function formatCurrency(amount: number, decimals = 2): string {
  return `$${amount.toFixed(decimals)}`;
}

/**
 * Format number as percentage
 *
 * @description Converts a number to a percentage string, rounded to nearest integer.
 *
 * @param {number} value - Percentage value (0-100)
 * @returns {string} Formatted percentage string (e.g., "50%")
 *
 * @example
 * ```typescript
 * formatPercentage(50) // Returns "50%"
 * formatPercentage(12.3) // Returns "12%"
 * ```
 */
export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Sanitize ID for use in file paths
 *
 * @description Converts an ID string to a safe format for use in file paths and URLs.
 * Converts to lowercase, replaces spaces with hyphens, and removes special characters.
 * Returns "unknown" if ID is null or undefined.
 *
 * @param {string | undefined | null} id - ID to sanitize
 * @returns {string} Sanitized ID string safe for file paths
 *
 * @example
 * ```typescript
 * sanitizeId("My User ID!") // Returns "my-user-id"
 * sanitizeId(null) // Returns "unknown"
 * sanitizeId("user_123") // Returns "user_123"
 * ```
 */
export function sanitizeId(id: string | undefined | null): string {
  if (!id) {
    return 'unknown';
  }
  return id
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .trim();
}

/**
 * Format number with K/M suffixes (alias for formatCompactNumber)
 *
 * @description Formats large numbers with K (thousands) or M (millions) suffixes.
 * Rounds to one decimal place for readability.
 *
 * @param {number} num - Number to format
 * @returns {string} Formatted number string (e.g., "1.5K", "2.3M")
 *
 * @example
 * ```typescript
 * formatNumber(1500) // Returns "1.5K"
 * formatNumber(2300000) // Returns "2.3M"
 * formatNumber(500) // Returns "500"
 * ```
 */
export function formatNumber(num: number): string {
  return formatCompactNumber(num);
}

/**
 * Decimal-like value type that supports toString conversion
 */
type DecimalLike =
  | string
  | number
  | bigint
  | null
  | undefined
  | { toString: () => string };

/**
 * Safely convert a value to a string representation
 *
 * @description Handles various input types including numbers, strings, bigints,
 * null, undefined, and objects with toString methods (like Decimal.js).
 *
 * @param value - Value to convert
 * @param defaultValue - Default value if input is null/undefined (default: '0')
 * @returns String representation of the value
 *
 * @example
 * ```typescript
 * toSafeString(123.45);      // Returns: "123.45"
 * toSafeString(null);        // Returns: "0"
 * toSafeString(undefined, '100'); // Returns: "100"
 * toSafeString({ toString: () => '999.99' }); // Returns: "999.99"
 * ```
 */
export function toSafeString(
  value: DecimalLike,
  defaultValue: string = '0'
): string {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'object' && typeof value.toString === 'function') {
    return value.toString();
  }
  return defaultValue;
}

/**
 * Safely convert a value to a number
 *
 * @description Handles various input types including numbers, strings, bigints,
 * null, undefined, and objects with toString methods (like Decimal.js).
 * Returns the default value for invalid/unparseable inputs.
 *
 * @param value - Value to convert
 * @param defaultValue - Default value if input is null/undefined/invalid (default: 0)
 * @returns Number representation of the value
 *
 * @example
 * ```typescript
 * toSafeNumber(123.45);      // Returns: 123.45
 * toSafeNumber('123.45');    // Returns: 123.45
 * toSafeNumber(null);        // Returns: 0
 * toSafeNumber('invalid', 100); // Returns: 100
 * toSafeNumber({ toString: () => '999.99' }); // Returns: 999.99
 * ```
 */
export function toSafeNumber(
  value: DecimalLike,
  defaultValue: number = 0
): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? defaultValue : value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }

  // Convert to string first (handles objects with toString)
  const str =
    typeof value === 'string'
      ? value.trim()
      : typeof value === 'object' && typeof value.toString === 'function'
        ? value.toString()
        : String(value);

  const parsed = Number(str);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Balance data structure with optional fields
 */
interface BalanceData {
  virtualBalance?: DecimalLike;
  totalDeposited?: DecimalLike;
  totalWithdrawn?: DecimalLike;
  lifetimePnL?: DecimalLike;
}

/**
 * Convert balance numeric values to strings for API responses
 *
 * @description Converts all numeric balance fields to string representations
 * for consistent API response formatting. Handles numbers, strings, BigInts,
 * Decimal objects, and undefined values (defaulting to '0').
 *
 * @param balance - Balance data with numeric values (all fields optional)
 * @returns Balance data with all values as strings
 *
 * @example
 * ```typescript
 * convertBalanceToStrings({
 *   virtualBalance: 1000,
 *   totalDeposited: BigInt(5000),
 *   totalWithdrawn: "100",
 *   lifetimePnL: -50,
 * })
 * // Returns: { virtualBalance: "1000", totalDeposited: "5000", ... }
 *
 * convertBalanceToStrings({})
 * // Returns: { virtualBalance: "0", totalDeposited: "0", ... }
 * ```
 */
export function convertBalanceToStrings(balance: BalanceData): {
  virtualBalance: string;
  totalDeposited: string;
  totalWithdrawn: string;
  lifetimePnL: string;
} {
  return {
    virtualBalance: toSafeString(balance.virtualBalance),
    totalDeposited: toSafeString(balance.totalDeposited),
    totalWithdrawn: toSafeString(balance.totalWithdrawn),
    lifetimePnL: toSafeString(balance.lifetimePnL),
  };
}
