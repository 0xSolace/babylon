/**
 * @fileoverview Plugin startup banner with ASCII art
 *
 * =============================================================================
 * WHY A BANNER?
 * =============================================================================
 *
 * Visual confirmation that the plugin loaded successfully.
 *
 * BENEFITS:
 * 1. VISIBILITY
 *    In a sea of log messages, a distinct banner catches attention.
 *    "Did the appraisal plugin start?" → Look for the banner.
 *
 * 2. IDENTIFICATION
 *    When running multiple agents, the character name shows which
 *    agent this banner belongs to.
 *
 * 3. ARCHITECTURE REMINDER
 *    The banner displays the architecture:
 *    homeostasis (internal) + appraisal (external) → motivation
 *    This helps developers understand the plugin's role.
 *
 * 4. AESTHETICS
 *    A well-designed banner makes the logs more pleasant to read.
 *    Each plugin has its own color scheme for differentiation.
 *
 * =============================================================================
 * COLOR THEME
 * =============================================================================
 *
 * Appraisal uses a teal/cyan/blue theme representing:
 * - Perception (seeing the external world)
 * - Evaluation (assessing situations)
 * - Clarity (clean, objective assessments)
 *
 * This differs from:
 * - Homeostasis: Greens (organic, internal)
 * - Motivation: Oranges/Reds (fire, drive, energy)
 *
 * =============================================================================
 * ANSI ESCAPE CODES
 * =============================================================================
 *
 * Format: \x1b[<code>m
 *
 * Basic:
 * - 0: Reset
 * - 1: Bold
 * - 2: Dim
 *
 * 256-color (38;5;N):
 * - 37: Teal
 * - 27: Deep Blue
 * - 117: Sky Blue
 * - 49: Seafoam
 *
 * Bright colors (9X):
 * - 92: Bright Green
 * - 94: Bright Blue
 * - 97: Bright White
 */

import type { IAgentRuntime } from '@elizaos/core';

// =============================================================================
// COLOR PALETTE
// =============================================================================

/**
 * ANSI escape codes for terminal colors.
 *
 * WHY AN OBJECT?
 * Named colors are more readable than raw escape sequences.
 * `ANSI.teal` is clearer than `'\x1b[38;5;37m'`.
 *
 * WHY THESE SPECIFIC COLORS?
 * - Teal/Cyan: Perception, clarity, external awareness
 * - Blue: Evaluation, analysis, objectivity
 * - Seafoam: Freshness, accuracy
 *
 * These evoke the idea of "seeing clearly" - which is what appraisal does.
 */
const ANSI = {
  /** Reset all formatting */
  reset: '\x1b[0m',
  /** Bold text */
  bold: '\x1b[1m',
  /** Dim/faded text */
  dim: '\x1b[2m',
  /** Teal - primary color for perception theme */
  teal: '\x1b[38;5;37m',
  /** Deep Blue - evaluation, analysis */
  blue: '\x1b[38;5;27m',
  /** Sky Blue - clarity, openness */
  sky: '\x1b[38;5;117m',
  /** Seafoam - freshness, accuracy */
  seafoam: '\x1b[38;5;49m',
  /** Bright Green - status indicators */
  brightGreen: '\x1b[92m',
  /** Bright White - emphasis */
  brightWhite: '\x1b[97m',
  /** Bright Blue - accent */
  brightBlue: '\x1b[94m',
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for printing the banner.
 *
 * WHY A TYPE?
 * Explicit interface for the function. Currently just runtime,
 * but could be extended (e.g., verbosity, custom colors).
 */
export interface BannerOptions {
  /** The agent runtime (for character name and logging) */
  runtime: IAgentRuntime;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Pad a line to exactly 78 characters (for consistent box width).
 *
 * WHY 78?
 * Standard terminal width is 80 columns. With 2 border characters
 * (║ on each side), we have 78 for content.
 *
 * WHY STRIP ANSI?
 * ANSI codes don't take visual space but count in string length.
 * We need to calculate visual length, not byte length.
 *
 * @param content - Line content (may include ANSI codes)
 * @returns Content padded to 78 visual characters
 */
function line(content: string): string {
  // Strip ANSI codes to get visual length
  const stripped = content.replace(/\x1b\[[0-9;]*m/g, '');
  const len = stripped.length;

  // Truncate if too long (shouldn't happen with our content)
  if (len > 78) return content.slice(0, 78);

  // Pad with spaces to fill the line
  return content + ' '.repeat(78 - len);
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Print the startup banner for the appraisal plugin.
 *
 * WHY NOT console.log?
 * We use runtime.logger.info for:
 * - Consistent log formatting
 * - Log level filtering
 * - Integration with logging infrastructure
 *
 * WHY ALL ONE logger.info CALL?
 * Keeps the banner together. Multiple calls might interleave
 * with other log messages in async contexts.
 *
 * @param options - Banner options containing runtime
 */
export function printBanner(options: BannerOptions): void {
  const { runtime } = options;

  // Shorthand for commonly used codes
  const R = ANSI.reset;
  const D = ANSI.dim;
  const B = ANSI.bold;
  const c1 = ANSI.teal; // Border color
  const c2 = ANSI.blue; // Secondary color
  const c3 = ANSI.sky; // Accent color
  const c4 = ANSI.seafoam; // Highlight color

  // Build box borders
  // WHY UNICODE BOX DRAWING?
  // Creates a clean, professional appearance. The ╔╗╚╝║═ characters
  // form a proper box that looks better than +---+ ASCII.
  const top = `${c1}╔${'═'.repeat(78)}╗${R}`;
  const mid = `${c1}╠${'═'.repeat(78)}╣${R}`;
  const bot = `${c1}╚${'═'.repeat(78)}╝${R}`;
  const row = (s: string) => `${c1}║${R}${line(s)}${c1}║${R}`;

  // Build the banner content
  const lines: string[] = [''];

  // Top border
  lines.push(top);

  // Character name - shows which agent this is for
  // WHY BOLD? Makes the character name stand out
  lines.push(row(` ${B}Character: ${runtime.character.name}${R}`));

  lines.push(mid);

  // ASCII art: APPRAISAL
  // WHY ASCII ART?
  // - Visual impact: Makes the banner memorable
  // - Plugin identification: Easy to spot in logs
  // - Professional appearance: Shows attention to detail
  //
  // WHY GRADIENT COLORS?
  // Creates depth and visual interest. Top to bottom: sky → blue → seafoam
  lines.push(
    row(
      `${c3}     ___    ____  ____  ____      _    ___ ____    _    _     ${R}`
    )
  );
  lines.push(
    row(
      `${c2}    / _ \\  |  _ \\|  _ \\|  _ \\    / \\  |_ _/ ___|  / \\  | |    ${R}`
    )
  );
  lines.push(
    row(
      `${c2}   | |_| | | |_) | |_) | |_) |  / _ \\  | |\\___ \\ / _ \\ | |    ${R}`
    )
  );
  lines.push(
    row(
      `${c4}   |  _  | |  __/|  __/|  _ <  / ___ \\ | | ___) / ___ \\| |___ ${R}`
    )
  );
  lines.push(
    row(
      `${c4}   |_| |_| |_|   |_|   |_| \\_\\/_/   \\_\\___|____/_/   \\_\\_____|${R}`
    )
  );
  lines.push(row(``));

  // Tagline
  // WHY TAGLINE?
  // One-line description reinforces what the plugin does
  lines.push(
    row(
      `${c3}    *${R}  ${D}Situational Evaluation Registry${R}  ${c3}*${R}      ${c2}~ PERCEPTION ~${R}`
    )
  );

  lines.push(mid);

  // Architecture reminder
  // WHY ARCHITECTURE?
  // Reminds developers how this plugin fits into the system.
  // Easy reference without checking documentation.
  lines.push(
    row(
      ` ${D}Architecture: homeostasis (internal) + appraisal (external) → motivation${R}`
    )
  );
  lines.push(
    row(
      ` ${D}Purpose: Hold domain evaluator outputs for motivation to consume${R}`
    )
  );

  lines.push(bot);
  lines.push('');

  // Output the banner
  // WHY logger.info (not debug)?
  // Banners are startup events worth seeing even in normal operation.
  // Debug level would hide them by default.
  runtime.logger.info(lines.join('\n'));
}
