/**
 * Beautiful plugin settings banner with custom ASCII art
 * Homeostasis Plugin - Internal state manager for drives and resources
 */

import type { IAgentRuntime } from '@elizaos/core';

// Homeostasis: Aqua/Calm Balance theme - unique palette
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  // Deep Aqua (calm/balance)
  aqua: '\x1b[38;5;51m',
  // Sea Green
  seaGreen: '\x1b[38;5;79m',
  // Lavender accent (rest)
  lavender: '\x1b[38;5;183m',
  brightYellow: '\x1b[93m',
  brightWhite: '\x1b[97m',
};

function line(content: string): string {
  const stripped = content.replace(/\x1b\[[0-9;]*m/g, '');
  const len = stripped.length;
  if (len > 78) return content.slice(0, 78);
  return content + ' '.repeat(78 - len);
}

export interface BannerOptions {
  runtime: IAgentRuntime;
}

export function printBanner(options: BannerOptions): void {
  const { runtime } = options;
  const R = ANSI.reset,
    D = ANSI.dim,
    B = ANSI.bold;
  const c1 = ANSI.seaGreen,
    c2 = ANSI.aqua,
    c3 = ANSI.lavender;
  const W = ANSI.brightWhite,
    G = ANSI.seaGreen,
    Y = ANSI.brightYellow;

  const top = `${c1}╔${'═'.repeat(78)}╗${R}`;
  const mid = `${c1}╠${'═'.repeat(78)}╣${R}`;
  const bot = `${c1}╚${'═'.repeat(78)}╝${R}`;
  const row = (s: string) => `${c1}║${R}${line(s)}${c1}║${R}`;

  const lines: string[] = [''];
  lines.push(top);
  lines.push(row(` ${B}Character: ${runtime.character.name}${R}`));
  lines.push(mid);

  // Homeostasis - Digital LCD / Segmented Display Font
  lines.push(
    row(
      `${c2}  ┏┓┏┓┳┳┓┏┓┏┓┏┓┏┳┓┏┓┏┓┳┏┓${R}     ${c3}╭───────────────────────────╮${R}`
    )
  );
  lines.push(
    row(
      `${c2}  ┣┫┃┃┃┃┃┣ ┃┃┗┓ ┃ ┣┫┗┓┃┗┓${R}     ${c3}│     ◉ ══════════ ◉       │${R}`
    )
  );
  lines.push(
    row(
      `${c2}  ┛┗┗┛┛ ┗┗┛┗┛┗┛ ┻ ┛┗┗┛┻┗┛${R}     ${c3}│   PHYSIOLOGICAL STATE     │${R}`
    )
  );
  lines.push(
    row(
      `${c2}                            ${R}     ${c3}│     ◉ ══════════ ◉       │${R}`
    )
  );
  lines.push(
    row(
      `${c3}                                  ╰───────────────────────────╯${R}`
    )
  );
  lines.push(row(``));
  lines.push(
    row(
      `${D}         Internal State Manager  •  Maintains Drives and Resources${R}`
    )
  );
  lines.push(mid);

  // State gauges visualization
  lines.push(row(` ${B}${W}Internal State Gauges${R}`));
  lines.push(row(` ${D}${'─'.repeat(76)}${R}`));
  lines.push(
    row(
      ` ${Y}Energy${R}    ${c3}[████████████░░░░░░░░]${R} 60%  ${D}Drive to act${R}`
    )
  );
  lines.push(
    row(
      ` ${Y}Focus${R}     ${c3}[██████████████████░░]${R} 90%  ${D}Attention capacity${R}`
    )
  );
  lines.push(
    row(
      ` ${Y}Social${R}    ${c3}[██████░░░░░░░░░░░░░░]${R} 30%  ${D}Need for interaction${R}`
    )
  );
  lines.push(
    row(
      ` ${Y}Rest${R}      ${c3}[████████████████░░░░]${R} 80%  ${D}Recovery state${R}`
    )
  );
  lines.push(mid);

  // Features
  lines.push(row(` ${B}${W}Features${R}`));
  lines.push(
    row(
      ` ${ANSI.seaGreen}▸${R} Tracks internal drives (energy, focus, social, rest)`
    )
  );
  lines.push(
    row(` ${ANSI.seaGreen}▸${R} Resource management and decay over time`)
  );
  lines.push(row(` ${ANSI.seaGreen}▸${R} Equilibrium seeking behavior`));
  lines.push(row(` ${ANSI.seaGreen}▸${R} Integration with motivation plugin`));
  lines.push(bot);
  lines.push('');

  runtime.logger.info(lines.join('\n'));
}
