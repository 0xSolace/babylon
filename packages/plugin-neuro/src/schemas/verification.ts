/**
 * Verification Schema - Hallucination detection and response verification
 */
import { defineSchema } from '../schema.ts';

export const verificationSchema = defineSchema({
  name: 'verification',
  table: 'verifications',
  scope: 'global',
  fields: {
    responseId: {
      type: 'string',
      description: 'ID of response being verified',
    },
    verdict: {
      type: 'enum',
      options: ['verified', 'uncertain', 'hallucination', 'partial'],
      description: 'Verification result',
    },
    confidence: {
      type: 'number',
      min: 0,
      max: 100,
      description: 'Confidence in verdict',
    },
    discrepancies: {
      type: 'array',
      description: 'Identified issues or inconsistencies',
    },
    evidence: { type: 'array', description: 'Supporting evidence for verdict' },
    sourceCheck: {
      type: 'boolean',
      description: 'Whether sources were verified',
    },
  },
  prompts: {
    task: 'Verify the accuracy of agent responses. Check for hallucinations, unsupported claims, or inconsistencies with known facts.',
    routingDirective: 'NONE', // Always create new - no updates
  },
  provider: {
    name: 'VERIFICATIONS',
    description: 'Response verification results',
    dynamic: false, // Only show when explicitly requested
    headerText: '# Recent verifications',
    emptyText: '', // Don't show anything if empty
  },
  hooks: {
    afterSave: async (runtime, memory, _isNew) => {
      const verdict = memory.metadata.verdict;
      if (verdict === 'hallucination') {
        // Emit event for homeostasis integration
        const logger = runtime.logger.child({
          namespace: 'neuro:verification',
        });
        logger.warn(
          {
            responseId: memory.metadata.responseId,
            discrepancies: memory.metadata.discrepancies,
          },
          'Hallucination detected'
        );

        // Could emit to homeostasis here when integrated:
        // runtime.emit('NEURO_HALLUCINATION_DETECTED', { memory });
      }
    },
  },
});
