/**
 * Beautiful plugin settings banner with custom ASCII art
 * Motivation Plugin - Interprets drives into priorities and orientation
 */

import type { IAgentRuntime } from '@elizaos/core';

// Motivation: Fire/Flame Energy theme - unique palette
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  // Flame Orange
  flame: '\x1b[38;5;202m',
  // Fire Red
  fire: '\x1b[38;5;196m',
  // Solar Yellow
  solar: '\x1b[38;5;220m',
  // Ember
  ember: '\x1b[38;5;208m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightWhite: '\x1b[97m',
  brightRed: '\x1b[91m',
  brightBlue: '\x1b[94m',
};

export interface PluginSetting {
  name: string;
  value: unknown;
  defaultValue?: unknown;
  sensitive?: boolean;
  required?: boolean;
}

export interface BannerOptions {
  runtime: IAgentRuntime;
  settings: PluginSetting[];
}

function mask(v: string): string {
  if (!v || v.length < 8) return '••••••••';
  return `${v.slice(0, 4)}${'•'.repeat(Math.min(12, v.length - 8))}${v.slice(-4)}`;
}

function fmtVal(value: unknown, sensitive: boolean, maxLen: number): string {
  let s: string;
  if (value === undefined || value === null || value === '') {
    s = '(not set)';
  } else if (sensitive) {
    s = mask(String(value));
  } else {
    s = String(value);
  }
  if (s.length > maxLen) s = s.slice(0, maxLen - 3) + '...';
  return s;
}

function isDef(v: unknown, d: unknown): boolean {
  if (v === undefined || v === null || v === '') return true;
  return d !== undefined && v === d;
}

function pad(s: string, n: number): string {
  const len = s.replace(/\x1b\[[0-9;]*m/g, '').length;
  if (len >= n) return s;
  return s + ' '.repeat(n - len);
}

function line(content: string): string {
  const stripped = content.replace(/\x1b\[[0-9;]*m/g, '');
  const len = stripped.length;
  if (len > 78) return content.slice(0, 78);
  return content + ' '.repeat(78 - len);
}

export function printBanner(options: BannerOptions): void {
  const { settings, runtime } = options;
  const R = ANSI.reset,
    D = ANSI.dim,
    B = ANSI.bold;
  const c1 = ANSI.fire,
    c2 = ANSI.flame,
    c3 = ANSI.solar,
    c4 = ANSI.ember;

  const top = `${c1}╔${'═'.repeat(78)}╗${R}`;
  const mid = `${c1}╠${'═'.repeat(78)}╣${R}`;
  const bot = `${c1}╚${'═'.repeat(78)}╝${R}`;
  const row = (s: string) => `${c1}║${R}${line(s)}${c1}║${R}`;

  const lines: string[] = [''];
  lines.push(top);
  lines.push(row(` ${B}Character: ${runtime.character.name}${R}`));
  lines.push(mid);

  // Motivation - Flame/Fire Graffiti Font with rising flames
  lines.push(
    row(
      `${c3}        )  (      ${c4}   (    )  (${R}        ${c1}   )\\   )  (${R}`
    )
  );
  lines.push(
    row(
      `${c2}   (   /( )\\))(   ${c3}'\\  )\\))(  )\\))(  '( ${c1}  (()/( )\\))( )\\${R}`
    )
  );
  lines.push(
    row(
      `${c2}   )\\ (_)|(_)()\\ ${c3}   )\\((_)()\\((_)()\\  )\\${c1}  /(_)|(_))()((_)${R}`
    )
  );
  lines.push(
    row(
      `${c2}  ((_) _)(_()((_)${c4}  ((_|_()((_|_()((_)((_)${c1}(_))  _(()((_|_|${R}`
    )
  );
  lines.push(
    row(
      `${c3}  |  \\/  |  \\/  |${c4} / _ \\_ _| \\ \\ / / /_\\ ${c1}|_ _|/ _ \\ | \\| |${R}`
    )
  );
  lines.push(
    row(
      `${c3}  | |\\/| | |\\/| |${c4}| (_) || ||  \\ V / / _ \\ ${c1}| || (_) || .  |${R}`
    )
  );
  lines.push(
    row(
      `${c3}  |_|  |_|_|  |_|${c4} \\___/___|_|  \\_/ /_/ \\_\\${c1}___\\___/ |_|\\_|${R}`
    )
  );
  lines.push(row(``));
  lines.push(
    row(
      `${c3}     *${R}  ${D}Interprets Drives into Priorities & Orientation${R}  ${c3}*${R}      ${c2}~ FIRE ~${R}`
    )
  );
  lines.push(mid);

  const NW = 32,
    VW = 28,
    SW = 8;
  lines.push(
    row(
      ` ${B}${pad('ENV VARIABLE', NW)} ${pad('VALUE', VW)} ${pad('STATUS', SW)}${R}`
    )
  );
  lines.push(
    row(` ${D}${'-'.repeat(NW)} ${'-'.repeat(VW)} ${'-'.repeat(SW)}${R}`)
  );

  for (const s of settings) {
    const def = isDef(s.value, s.defaultValue);
    const set = s.value !== undefined && s.value !== null && s.value !== '';

    let ico: string, st: string;
    if (!set && s.required) {
      ico = `${ANSI.brightRed}◆${R}`;
      st = `${ANSI.brightRed}REQUIRED${R}`;
    } else if (!set) {
      ico = `${D}○${R}`;
      st = `${D}default${R}`;
    } else if (def) {
      ico = `${ANSI.brightBlue}●${R}`;
      st = `${ANSI.brightBlue}default${R}`;
    } else {
      ico = `${ANSI.brightGreen}✓${R}`;
      st = `${ANSI.brightGreen}custom${R}`;
    }

    const name = pad(s.name, NW - 2);
    const val = pad(
      fmtVal(s.value ?? s.defaultValue, s.sensitive ?? false, VW),
      VW
    );
    const status = pad(st, SW);
    lines.push(row(` ${ico} ${c2}${name}${R} ${val} ${status}`));
  }

  lines.push(mid);
  lines.push(
    row(
      ` ${D}${ANSI.brightGreen}✓${D} custom  ${ANSI.brightBlue}●${D} default  ○ unset  ${ANSI.brightRed}◆${D} required      → Set in .env${R}`
    )
  );
  lines.push(bot);
  lines.push('');

  runtime.logger.info(lines.join('\n'));
}
