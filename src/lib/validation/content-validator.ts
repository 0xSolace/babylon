/**
 * Content Validator
 *
 * @description
 * Canonical validation service for all generated content.
 * Consolidates scattered validation logic into fail-fast assertions.
 *
 * **Purpose**:
 * - Prevent invalid data from propagating through system
 * - Fail immediately with clear errors
 * - Consistent validation across all generators
 * - Replace copy-pasted null checks everywhere
 *
 * **Usage**:
 * ```typescript
 * // Before:
 * if (!post.content || post.content.trim().length === 0) {
 *   return; // Skip
 * }
 * if (post.content.length > 5000) {
 *   post.content = post.content.substring(0, 5000);
 * }
 *
 * // After:
 * ContentValidator.validatePostContent(post.content);
 * ```
 */

import { logger } from '@/lib/logger';

export class ContentValidator {
  /**
   * Validate post content
   *
   * @param content - Post content to validate
   * @param context - Context for error messages (optional)
   * @throws Error if content is invalid
   *
   * @example
   * ```typescript
   * ContentValidator.validatePostContent(post.content, 'media post');
   * // Throws if empty or too long
   * ```
   */
  static validatePostContent(content: unknown, context?: string): asserts content is string {
    const ctx = context || 'post';

    if (content === null || content === undefined) {
      throw new Error(`${ctx}: content is null or undefined`);
    }

    if (typeof content !== 'string') {
      throw new Error(`${ctx}: content must be string, got ${typeof content}`);
    }

    if (content.trim().length === 0) {
      throw new Error(`${ctx}: content cannot be empty`);
    }

    if (content.length > ContentValidator.MAX_POST_LENGTH) {
      logger.warn(
        `${ctx}: content exceeds max length`,
        {
          length: content.length,
          max: ContentValidator.MAX_POST_LENGTH,
        },
        'ContentValidator'
      );
      throw new Error(
        `${ctx}: content exceeds maximum length (${ContentValidator.MAX_POST_LENGTH} chars)`
      );
    }
  }

  /**
   * Validate event description
   *
   * @param description - Event description to validate
   * @param context - Context for error messages (optional)
   * @throws Error if description is invalid
   */
  static validateEventDescription(
    description: unknown,
    context?: string
  ): asserts description is string {
    const ctx = context || 'event';

    if (description === null || description === undefined) {
      throw new Error(`${ctx}: description is null or undefined`);
    }

    if (typeof description !== 'string') {
      throw new Error(`${ctx}: description must be string, got ${typeof description}`);
    }

    if (description.trim().length === 0) {
      throw new Error(`${ctx}: description cannot be empty`);
    }

    if (description.length > ContentValidator.MAX_EVENT_DESCRIPTION) {
      logger.warn(
        `${ctx}: description too long, will truncate`,
        {
          length: description.length,
          max: ContentValidator.MAX_EVENT_DESCRIPTION,
        },
        'ContentValidator'
      );
      // Don't throw - just warn (truncation happens later)
    }
  }

  /**
   * Validate question text
   *
   * @param text - Question text to validate
   * @param context - Context for error messages (optional)
   * @throws Error if text is invalid
   */
  static validateQuestionText(text: unknown, context?: string): asserts text is string {
    const ctx = context || 'question';

    if (text === null || text === undefined) {
      throw new Error(`${ctx}: text is null or undefined`);
    }

    if (typeof text !== 'string') {
      throw new Error(`${ctx}: text must be string, got ${typeof text}`);
    }

    if (text.trim().length === 0) {
      throw new Error(`${ctx}: text cannot be empty`);
    }

    if (text.length > ContentValidator.MAX_QUESTION_TEXT) {
      throw new Error(
        `${ctx}: text exceeds maximum length (${ContentValidator.MAX_QUESTION_TEXT} chars)`
      );
    }
  }

  /**
   * Validate entity name (actor, organization)
   *
   * @param name - Entity name to validate
   * @param context - Context for error messages (optional)
   * @throws Error if name is invalid
   */
  static validateEntityName(name: unknown, context?: string): asserts name is string {
    const ctx = context || 'entity';

    if (name === null || name === undefined) {
      throw new Error(`${ctx}: name is null or undefined`);
    }

    if (typeof name !== 'string') {
      throw new Error(`${ctx}: name must be string, got ${typeof name}`);
    }

    if (name.trim().length === 0) {
      throw new Error(`${ctx}: name cannot be empty`);
    }
  }

  /**
   * Validate day number (1-30)
   *
   * @param day - Day number to validate
   * @param context - Context for error messages (optional)
   * @throws Error if day is invalid
   */
  static validateDayNumber(day: unknown, context?: string): asserts day is number {
    const ctx = context || 'day';

    if (typeof day !== 'number') {
      throw new Error(`${ctx}: day must be number, got ${typeof day}`);
    }

    if (!Number.isFinite(day)) {
      throw new Error(`${ctx}: day must be finite number`);
    }

    if (day < 1 || day > 30) {
      throw new Error(`${ctx}: day must be between 1 and 30, got ${day}`);
    }
  }

  /**
   * Validate timestamp
   *
   * @param timestamp - Timestamp to validate
   * @param context - Context for error messages (optional)
   * @throws Error if timestamp is invalid
   */
  static validateTimestamp(timestamp: unknown, context?: string): void {
    const ctx = context || 'timestamp';

    if (!timestamp) {
      throw new Error(`${ctx}: timestamp is required`);
    }

    let date: Date;

    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      throw new Error(`${ctx}: timestamp must be Date or ISO string, got ${typeof timestamp}`);
    }

    if (Number.isNaN(date.getTime())) {
      throw new Error(`${ctx}: timestamp is invalid date`);
    }
  }

  /**
   * Validate array is not empty
   *
   * @param arr - Array to validate
   * @param context - Context for error messages
   * @throws Error if array is empty
   */
  static validateNotEmpty<T>(arr: T[], context: string): void {
    if (!Array.isArray(arr)) {
      throw new Error(`${context}: must be an array`);
    }

    if (arr.length === 0) {
      throw new Error(`${context}: cannot be empty`);
    }
  }

  /**
   * Truncate content to maximum length
   *
   * @param content - Content to truncate
   * @param maxLength - Maximum length
   * @returns Truncated content
   */
  static truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    logger.warn(
      'Truncating content',
      {
        originalLength: content.length,
        maxLength,
      },
      'ContentValidator'
    );

    return `${content.substring(0, maxLength - 3)}...`;
  }

  /**
   * Sanitize content (remove invalid characters, trim)
   *
   * @param content - Content to sanitize
   * @returns Sanitized content
   */
  static sanitizeContent(content: string): string {
    const trimmed = content.trim();
    return trimmed
      .split('')
      .filter((char) => {
        const code = char.charCodeAt(0);
        return code === 0x09 || code === 0x0a || code === 0x0d || code >= 0x20;
      })
      .join('');
  }
}
