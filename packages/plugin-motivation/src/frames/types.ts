/**
 * @fileoverview Frame type definitions
 */

import type {
  ActivePattern,
  FrameType,
  MotivationConstraint,
  MotivationOpportunity,
  MotivationPriority,
  SignalState,
} from '../types.ts';

/**
 * Frame interface - defines how a frame filters and interprets patterns.
 */
export interface Frame {
  /** Frame identifier */
  name: FrameType;

  /** Human-readable description */
  description: string;

  /**
   * The frame's perspective on the world.
   * Used in narrative generation.
   */
  perspective: string;

  /**
   * Filter and reorder patterns based on this frame's worldview.
   * May suppress patterns that don't fit the frame's focus.
   */
  filterPatterns(
    patterns: ActivePattern[],
    signals: SignalState
  ): ActivePattern[];

  /**
   * Generate a frame-colored narrative from the motivation state.
   */
  generateNarrative(
    priorities: MotivationPriority[],
    constraints: MotivationConstraint[],
    opportunities: MotivationOpportunity[]
  ): string;

  /**
   * Check if this frame should auto-activate given the current state.
   * Returns true if this frame should take over.
   */
  shouldActivate?(signals: SignalState): boolean;
}
