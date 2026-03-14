/**
 * @fileoverview Frame registry and utilities
 */

import { Defaults } from '../constants.ts';
import type { FrameType, SignalState } from '../types.ts';
import { maslowFrame } from './maslow.ts';
import { notorietyFrame } from './notoriety.ts';
import { powerFrame } from './power.ts';
import { survivalFrame } from './survival.ts';
import type { Frame } from './types.ts';

export type { Frame } from './types.ts';

/**
 * Frame registry.
 */
const frames: Record<FrameType, Frame> = {
  maslow: maslowFrame,
  power: powerFrame,
  notoriety: notorietyFrame,
  survival: survivalFrame,
};

/**
 * Get a frame by name.
 */
export function getFrame(name: FrameType): Frame {
  const frame = frames[name];
  if (!frame) {
    throw new Error(`Unknown frame: ${name}`);
  }
  return frame;
}

/**
 * Get all available frames.
 */
export function getAllFrames(): Frame[] {
  return Object.values(frames);
}

/**
 * Select the appropriate frame based on current state.
 *
 * Frame selection logic:
 * 1. If any frame's shouldActivate returns true, use that frame
 * 2. Otherwise, use the default frame
 *
 * The survival frame auto-activates on critical physiological stress.
 */
export function selectFrame(
  signals: SignalState,
  defaultFrame: FrameType = Defaults.DEFAULT_FRAME,
  override?: FrameType
): Frame {
  // If override is specified, use it
  if (override) {
    return getFrame(override);
  }

  // Check if survival frame should auto-activate
  if (survivalFrame.shouldActivate?.(signals)) {
    return survivalFrame;
  }

  // Check other frames for auto-activation
  for (const frame of getAllFrames()) {
    if (frame.name !== 'survival' && frame.shouldActivate?.(signals)) {
      return frame;
    }
  }

  // Use default frame
  return getFrame(defaultFrame);
}

// Export individual frames
export { maslowFrame } from './maslow.ts';
export { notorietyFrame } from './notoriety.ts';
// Export personality mapping utilities
export {
  getCharacterDefaultFrame,
  inferDefaultFrame,
} from './personality-mapping.ts';
export { powerFrame } from './power.ts';
export { survivalFrame } from './survival.ts';
