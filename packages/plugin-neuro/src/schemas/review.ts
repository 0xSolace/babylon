/**
 * Review Schema - Stores reviewEvaluator grades for metacognition
 *
 * WHY THIS SCHEMA EXISTS:
 * ======================
 * reviewEvaluator grades agent responses (A-F) but doesn't persist the results.
 * metacognition needs historical grades to assess evaluator quality.
 *
 * This schema bridges the gap:
 * 1. reviewEvaluator generates grades → stored here
 * 2. metacognition reads reviews → calculates accuracy, signal-to-noise
 *
 * WHY GLOBAL SCOPE:
 * ================
 * Reviews are agent-wide self-assessments. They're not tied to a specific
 * room or entity—they're about the agent's overall performance.
 */
import { defineSchema } from '../schema.ts';

export const reviewSchema = defineSchema({
  name: 'review',
  table: 'reviews',
  scope: 'global',

  fields: {
    /**
     * WHY STORE REQUEST/REPLY/RESPONSE:
     * These are the context that was evaluated. Useful for:
     * - Debugging why a grade was given
     * - Training/fine-tuning on good/bad examples
     * - Correlation analysis (what types of requests get bad grades?)
     */
    requestText: { type: 'string', description: 'Original user request' },
    replyText: {
      type: 'string',
      description: 'Agent reply that was evaluated',
    },
    responseText: { type: 'string', description: 'User response to our reply' },

    /**
     * WHY GRADE AS ENUM:
     * - Standardized values (A, B, C, D, F)
     * - Easy to aggregate (count by grade)
     * - Maps to numeric scores when needed
     */
    grade: {
      type: 'enum',
      options: ['A', 'B', 'C', 'D', 'F'],
      description: 'Letter grade for the reply',
    },

    /**
     * WHY THESE BOOLEAN FLAGS:
     * - userRequestFullyAddressed: Did we complete the task?
     * - properlyEquipped: Did we have the right tools?
     *
     * These help diagnose failures:
     * - Bad grade + not addressed + equipped = execution problem
     * - Bad grade + not addressed + not equipped = capability gap
     */
    userRequestFullyAddressed: {
      type: 'boolean',
      description: 'Was the request fully addressed',
    },
    properlyEquipped: {
      type: 'boolean',
      description: 'Did we have the tools to complete the task',
    },

    /**
     * WHY STORE REASONING:
     * The LLM's explanation of the grade. Critical for:
     * - Understanding failures
     * - Improving prompts
     * - Identifying patterns
     */
    reasoning: { type: 'string', description: 'LLM reasoning for the grade' },

    /**
     * WHY STORE TASK BREAKDOWN:
     * When we fail, the LLM suggests improvements.
     * This is valuable training data for future attempts.
     */
    taskBreakdown: { type: 'array', description: 'Suggested steps to improve' },

    /**
     * WHY TRACK RELATED IDs:
     * - Links back to the messages that were evaluated
     * - Enables correlation with conversation/task memories
     */
    requestMessageId: { type: 'string', description: 'ID of request message' },
    replyMessageId: { type: 'string', description: 'ID of our reply message' },
    responseMessageId: {
      type: 'string',
      description: 'ID of user response message',
    },
  },

  prompts: {
    // NOTE: This schema is NOT used by the cognitive engine to generate prompts.
    // reviewEvaluator has its own prompts. This schema just stores results.
    task: 'Store review evaluation results for metacognition analysis.',
    routingDirective: 'NONE', // Always create new reviews, never update
  },

  provider: {
    name: 'REVIEWS',
    description: 'Recent performance reviews',
    dynamic: false, // Only show on request
    headerText: '# Recent reviews',
    emptyText: '',
    salience: {
      enabled: false, // Reviews are ordered by time, not salience
    },
  },
});

// =============================================================================
// Grade Utilities
// =============================================================================

/**
 * Convert letter grade to numeric score.
 * WHY: Enables averaging, trending, threshold comparisons.
 */
export function gradeToScore(grade: string): number {
  switch (grade.toUpperCase()) {
    case 'A':
      return 4.0;
    case 'B':
      return 3.0;
    case 'C':
      return 2.0;
    case 'D':
      return 1.0;
    case 'F':
      return 0.0;
    default:
      return 2.0; // Unknown = C average
  }
}

/**
 * Convert numeric score to letter grade.
 */
export function scoreToGrade(score: number): string {
  if (score >= 3.5) return 'A';
  if (score >= 2.5) return 'B';
  if (score >= 1.5) return 'C';
  if (score >= 0.5) return 'D';
  return 'F';
}

/**
 * Calculate GPA from grades.
 */
export function calculateGPA(grades: string[]): number {
  if (grades.length === 0) return 0;
  const total = grades.reduce((sum, g) => sum + gradeToScore(g), 0);
  return total / grades.length;
}

/**
 * Get grade distribution from reviews.
 */
export function getGradeDistribution(grades: string[]): Record<string, number> {
  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const grade of grades) {
    const upper = grade.toUpperCase();
    if (upper in dist) {
      dist[upper]++;
    }
  }
  return dist;
}
