/**
 * Metacognition Schema - Self-evaluation of agent quality
 *
 * WHY THIS EXISTS:
 * ===============
 * "Know thyself" - Agents need to understand their own performance.
 * Without metacognition:
 * - Agent doesn't know when it's performing poorly
 * - No feedback loop for improvement
 * - Same mistakes repeat
 *
 * With metacognition:
 * - Agent tracks its grade history (from reviewEvaluator)
 * - Calculates GPA, trends, patterns
 * - Identifies common failure modes
 * - Can adjust behavior based on self-assessment
 *
 * HOW IT WORKS:
 * ============
 * 1. reviewEvaluator grades responses → saves to 'reviews' table
 * 2. metacognition reads reviews → calculates aggregate metrics
 * 3. Stores self-assessment → provides context for future responses
 *
 * This creates a FEEDBACK LOOP:
 * responses → reviews → metacognition → improved responses
 */

import {
  createNeuroEvent,
  type EvaluatorQualityPayload,
  NEURO_EVENTS,
} from '../events.ts';
import { defineSchema } from '../schema.ts';
import { scoreToGrade } from './review.ts';

export const metacognitionSchema = defineSchema({
  name: 'metacognition',
  table: 'metacognition',
  scope: 'global',

  fields: {
    /**
     * WHY PERIOD:
     * Metacognition should be periodic ("how did I do this week?")
     * not continuous ("how did I do on this message?").
     */
    period: {
      type: 'string',
      description: 'Assessment period (e.g., "daily", "weekly", or date range)',
    },

    /**
     * WHY GPA:
     * - Single number summary of performance
     * - Familiar scale (0.0-4.0)
     * - Easy to track trends
     */
    gpa: {
      type: 'number',
      min: 0,
      max: 4,
      description: 'Grade point average (0-4 scale)',
    },

    /**
     * WHY TREND:
     * Direction matters more than absolute value.
     * "Getting better" vs "Getting worse" guides intervention.
     */
    trend: {
      type: 'enum',
      options: ['improving', 'stable', 'declining'],
      description: 'Performance trend',
    },

    /**
     * WHY SAMPLE SIZE:
     * Confidence in metrics depends on sample size.
     * GPA from 3 reviews ≠ GPA from 100 reviews.
     */
    sampleSize: { type: 'number', description: 'Number of reviews analyzed' },

    /**
     * WHY GRADE DISTRIBUTION:
     * GPA of 2.0 could mean "all Cs" or "half As, half Fs".
     * Distribution shows the full picture.
     */
    gradeDistribution: {
      type: 'array',
      description: 'Count by grade (A:5,B:3,C:2...)',
    },

    /**
     * WHY COMPLETION RATE:
     * Tracks "userRequestFullyAddressed" percentage.
     * High grades but low completion = style over substance.
     */
    completionRate: {
      type: 'number',
      min: 0,
      max: 100,
      description: 'Percentage of requests fully addressed',
    },

    /**
     * WHY EQUIPMENT RATE:
     * Tracks "properlyEquipped" percentage.
     * Low rate = capability gaps that need addressing.
     */
    equipmentRate: {
      type: 'number',
      min: 0,
      max: 100,
      description: 'Percentage with proper tools',
    },

    /**
     * WHY COMMON ISSUES:
     * Aggregate failure patterns from reviews.
     * "Often fails at math" enables targeted improvement.
     */
    commonIssues: {
      type: 'array',
      description: 'Frequently identified issues',
    },

    /**
     * WHY STRENGTHS:
     * Not just weaknesses - know what works.
     * "Good at explanations" should be leveraged.
     */
    strengths: { type: 'array', description: 'Identified strengths' },

    /**
     * WHY IMPROVEMENT SUGGESTIONS:
     * Aggregate task breakdown suggestions from reviews.
     * "Try breaking complex requests into steps."
     */
    improvements: {
      type: 'array',
      description: 'Aggregated improvement suggestions',
    },
  },

  prompts: {
    task: 'Analyze recent review grades to assess overall agent quality. Calculate GPA, identify trends, common issues, and strengths. Be honest and constructive.',
    routingDirective: 'NONE', // Always create new assessments
  },

  provider: {
    name: 'METACOGNITION',
    description: 'Self-assessment of agent quality',
    dynamic: false, // Only on request
    headerText: '# Self-assessment',
    emptyText: '',
    salience: { enabled: false },
  },

  hooks: {
    /**
     * Custom provider formatting with priming.
     * WHY: Raw metrics are less useful than interpreted insights.
     */
    formatProvider: (memories, _message, _runtime) => {
      if (memories.length === 0) return '';

      // Get most recent assessment
      const recent = memories.sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
      )[0];

      const gpa = (recent.metadata.gpa as number) || 0;
      const trend = recent.metadata.trend as string;
      const completionRate = (recent.metadata.completionRate as number) || 0;
      const sampleSize = (recent.metadata.sampleSize as number) || 0;

      // Calculate letter grade equivalent
      const letterGrade = scoreToGrade(gpa);

      // Generate priming based on performance
      let priming: string;
      if (gpa >= 3.5) {
        priming = 'HIGH performance - maintain quality';
      } else if (gpa >= 2.5) {
        priming = 'GOOD performance - room for improvement';
      } else if (gpa >= 1.5) {
        priming = 'MODERATE performance - focus on completing requests fully';
      } else {
        priming = 'NEEDS IMPROVEMENT - be careful, ask clarifying questions';
      }

      const issues = (recent.metadata.commonIssues as string[]) || [];
      const issueText =
        issues.length > 0
          ? `\nWatch out for: ${issues.slice(0, 3).join(', ')}`
          : '';

      return `# Self-assessment
- Recent GPA: ${gpa.toFixed(2)} (${letterGrade}) based on ${sampleSize} reviews
- Trend: ${trend}
- Completion rate: ${completionRate}%
- Status: ${priming}${issueText}
`;
    },

    afterSave: async (runtime, memory, _isNew) => {
      const logger = runtime.logger.child({ namespace: 'neuro:metacognition' });

      const gpa = (memory.metadata.gpa as number) || 0;
      const trend = memory.metadata.trend as string;
      const sampleSize = (memory.metadata.sampleSize as number) || 0;

      // Log assessment
      logger.info(
        {
          gpa: gpa.toFixed(2),
          trend,
          sampleSize,
          completionRate: memory.metadata.completionRate,
        },
        'Self-assessment completed'
      );

      // Emit event for potential consumers (homeostasis)
      const event = createNeuroEvent<EvaluatorQualityPayload>(
        NEURO_EVENTS.EVALUATOR_QUALITY,
        {
          evaluatorName: 'AGENT_OVERALL',
          accuracy: gpa * 25, // Convert 0-4 to 0-100
          signalToNoise: (memory.metadata.completionRate as number) || 0,
          sampleSize,
        }
      );

      logger.debug({ event }, 'Metacognition event created');
    },
  },
});
