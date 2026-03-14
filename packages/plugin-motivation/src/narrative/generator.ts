/**
 * @fileoverview Narrative generation
 *
 * Generates human-readable narratives from motivation state.
 * The narrative is what the LLM sees in context.
 */

import type { Frame } from '../frames/types.ts';
import type {
  MotivationConstraint,
  MotivationOpportunity,
  MotivationPriority,
} from '../types.ts';

/**
 * Generate a motivation narrative using the active frame.
 */
export function generateNarrative(
  frame: Frame,
  priorities: MotivationPriority[],
  constraints: MotivationConstraint[],
  opportunities: MotivationOpportunity[]
): string {
  // Delegate to frame's narrative generator
  return frame.generateNarrative(priorities, constraints, opportunities);
}

/**
 * Generate a simple fallback narrative when no frame is available.
 */
export function generateFallbackNarrative(
  priorities: MotivationPriority[],
  constraints: MotivationConstraint[],
  opportunities: MotivationOpportunity[]
): string {
  const parts: string[] = [];

  if (priorities.length === 0) {
    parts.push('My needs are balanced.');
  } else {
    const top = priorities[0];
    parts.push(
      `I am focused on ${top.need.replace(/_/g, ' ')} (intensity: ${top.intensity.toFixed(1)}).`
    );

    if (priorities.length > 1) {
      const others = priorities
        .slice(1, 3)
        .map((p) => p.need.replace(/_/g, ' '))
        .join(', ');
      parts.push(`Also aware of: ${others}.`);
    }
  }

  if (constraints.length > 0) {
    const constraintList = constraints
      .map((c) => c.guidance.toLowerCase())
      .join('; ');
    parts.push(`Constraints: ${constraintList}.`);
  }

  if (opportunities.length > 0) {
    const oppList = opportunities
      .slice(0, 2)
      .map((o) => o.type.replace(/_/g, ' '))
      .join(', ');
    parts.push(`Opportunities: ${oppList}.`);
  }

  return parts.join(' ');
}

/**
 * Format the complete motivation context for LLM injection.
 *
 * WHY THIS FORMAT?
 * The LLM receives this as context for decision-making. We organize it as:
 * 1. Frame: The interpretive lens
 * 2. Priorities: What matters most (ordered)
 * 3. Constraints: What to avoid
 * 4. Opportunities: What's possible
 * 5. Narrative: Human-readable summary
 *
 * SITUATIONAL CONTEXT:
 * Constraints and opportunities now include situational factors from appraisals.
 * The LLM sees these alongside internal state, giving a complete picture.
 * For example:
 * - "budget_conscious: Avoid resource-intensive actions" (from financial_constraint)
 * - "leverage_influence: Position of strength" (from influence_position)
 */
export function formatMotivationContext(
  frame: Frame,
  priorities: MotivationPriority[],
  constraints: MotivationConstraint[],
  opportunities: MotivationOpportunity[],
  narrative: string
): string {
  const sections: string[] = [];

  // Header
  sections.push(`## Motivation\n`);

  // Frame
  sections.push(`**Frame**: ${frame.name} - ${frame.description}\n`);

  // Priorities
  // WHY SHOW PRIORITIES? The LLM needs to know what the agent cares about most.
  // This influences action selection and response tone.
  if (priorities.length > 0) {
    sections.push(`**Priorities**:`);
    for (const p of priorities.slice(0, 4)) {
      const intensity = (p.intensity * 100).toFixed(0);
      // Show drivers so LLM understands WHY this is a priority
      sections.push(
        `- ${p.need.replace(/_/g, ' ')} (${intensity}%) [${p.drivers.join(', ')}]`
      );
    }
    sections.push('');
  }

  // Constraints
  // WHY SHOW CONSTRAINTS? These are guardrails that should influence the LLM's
  // action selection. If "risk_averse" is active, the LLM should avoid risky actions.
  if (constraints.length > 0) {
    sections.push(`**Constraints**:`);
    for (const c of constraints) {
      sections.push(`- ${c.type}: ${c.guidance}`);
    }
    sections.push('');
  }

  // Opportunities
  // WHY SHOW OPPORTUNITIES? These represent what's possible right now.
  // The LLM can use these to identify beneficial actions.
  if (opportunities.length > 0) {
    sections.push(`**Opportunities**:`);
    for (const o of opportunities.slice(0, 3)) {
      const potential = (o.potential * 100).toFixed(0);
      sections.push(`- ${o.type.replace(/_/g, ' ')} (${potential}% potential)`);
    }
    sections.push('');
  }

  // Narrative
  // WHY NARRATIVE? The structured data above is precise but cold.
  // The narrative gives a human-readable, frame-colored summary that
  // helps the LLM understand the agent's "voice" and orientation.
  sections.push(`**Current Orientation**:`);
  sections.push(narrative);

  return sections.join('\n');
}
