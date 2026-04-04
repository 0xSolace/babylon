import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fal } from '@fal-ai/client';

// ── Subjects (animals, objects, characters, things) ──────────────────
const SUBJECTS = [
  // Animals
  'a cat',
  'a wolf',
  'a fox',
  'an owl',
  'a bear',
  'a raven',
  'a snake',
  'a jellyfish',
  'a koi fish',
  'a stag',
  'a tiger',
  'a hawk',
  'a panther',
  'a lion',
  'a bull',
  'a shark',
  // Mythical
  'a dragon',
  'a phoenix',
  'a kraken',
  'a minotaur',
  'a sphinx',
  'a golem',
  'a valkyrie',
  'a samurai ghost',
  // Objects & symbols
  'a skull',
  'a diamond',
  'a burning crown',
  'an hourglass',
  'a crystal ball',
  'a sword in stone',
  'a glowing orb',
  'a broken mirror',
  'a compass rose',
  'an eye of providence',
  'a crescent moon',
  'a lightning bolt',
  // Characters & archetypes
  'a masked hacker',
  'a hooded figure',
  'a robot head',
  'an astronaut helmet',
  'a cyberpunk samurai',
  'a plague doctor',
  'a chess king piece',
  'a wizard hat',
  'a space pirate',
  'a neon ghost',
  // Abstract things
  'a fractal flower',
  'a tesseract',
  'a black hole',
  'a DNA helix',
  'a circuit board brain',
  'a melting clock',
];

// ── Backgrounds ──────────────────────────────────────────────────────
const BACKGROUNDS = [
  // Patterns & abstract
  'a geometric grid pattern',
  'swirling vaporwave gradients',
  'glitch art static',
  'concentric circles',
  'a mandala pattern',
  'a noise texture',
  'scattered binary code',
  'liquid marble',
  'a kaleidoscope pattern',
  'a topographic map',
  // Colors & moods
  'a deep black void',
  'a neon pink and cyan gradient',
  'a golden sunset gradient',
  'a dark stormy sky',
  'an electric blue glow',
  'a blood red haze',
  'a pastel watercolor wash',
  'a muted earth tone palette',
  'an iridescent holographic shimmer',
  'a stark white minimalist backdrop',
  // Environments
  'a dense jungle canopy',
  'an underwater coral reef',
  'a futuristic cityscape at night',
  'a snowy mountain peak',
  'a burning forest',
  'a desert with dunes',
  'outer space with nebulae',
  'an ancient temple interior',
  'a rainy neon-lit alley',
  'a field of wildflowers',
];

// ── Themes / moods ───────────────────────────────────────────────────
const THEMES = [
  'dark and menacing',
  'ethereal and dreamlike',
  'chaotic and glitchy',
  'serene and zen',
  'cyberpunk dystopia',
  'ancient and mystical',
  'psychedelic and trippy',
  'minimalist and clean',
  'grunge and gritty',
  'cosmic and celestial',
  'steampunk mechanical',
  'tropical and vibrant',
  'frozen and crystalline',
  'fiery and volcanic',
  'underwater bioluminescent',
  'retro synthwave',
  'post-apocalyptic wasteland',
  'enchanted forest fairy tale',
  'brutalist architectural',
  'lo-fi chill aesthetic',
];

// ── Art styles ───────────────────────────────────────────────────────
const STYLES = [
  '3D Pixar render',
  'hand-drawn ink sketch',
  'photorealistic photograph',
  'anime illustration',
  'oil painting',
  'watercolor painting',
  'pixel art',
  'low poly 3D',
  'comic book pop art',
  'woodblock print',
  'stained glass',
  'neon sign art',
  'chalk on blackboard',
  'graffiti street art',
  'ukiyo-e Japanese art',
  'art nouveau poster',
  'vaporwave digital art',
  'claymation style',
  'pencil graphite drawing',
  'collage mixed media',
  'vector flat design',
  'impressionist painting',
  'cyberpunk concept art',
  'retro 8-bit',
  'linocut print',
];

// ── Prompt builder ───────────────────────────────────────────────────
interface PfpSpec {
  index: number;
  subject: string;
  background: string;
  theme: string;
  style: string;
  prompt: string;
}

function buildPrompt(
  subject: string,
  background: string,
  theme: string,
  style: string
): string {
  return `a profile picture icon of ${subject}, against ${background}, ${theme} mood, rendered in ${style} style, centered composition, close-up portrait framing`;
}

// ── Deterministic shuffle ────────────────────────────────────────────
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Generate 150 unique combos ──────────────────────────────────────
function generateSpecs(): PfpSpec[] {
  const rand = seededRandom(777);
  const specs: PfpSpec[] = [];
  const seen = new Set<string>();

  const subjects = shuffle(SUBJECTS, rand);
  const backgrounds = shuffle(BACKGROUNDS, rand);
  const themes = shuffle(THEMES, rand);
  const styles = shuffle(STYLES, rand);

  let si = 0,
    bi = 0,
    ti = 0,
    sti = 0;

  while (specs.length < 150) {
    const subject = subjects[si % subjects.length];
    const background = backgrounds[bi % backgrounds.length];
    const theme = themes[ti % themes.length];
    const style = styles[sti % styles.length];

    const key = `${subject}|${background}|${theme}|${style}`;
    if (!seen.has(key)) {
      seen.add(key);
      specs.push({
        index: specs.length,
        subject,
        background,
        theme,
        style,
        prompt: buildPrompt(subject, background, theme, style),
      });
    }

    si++;
    bi += 3;
    ti += 7;
    sti += 11;
  }

  return specs;
}

// ── Main ─────────────────────────────────────────────────────────────
const CONCURRENCY = 20;
const TIMEOUT_MS = 120_000;
const OUTPUT_DIR = join(import.meta.dir, '..', 'output', 'user-pfps');

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

function slugify(s: string): string {
  return s
    .replace(/^an?\s+/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

async function generateImage(spec: PfpSpec): Promise<void> {
  const filename = `${String(spec.index).padStart(3, '0')}_${slugify(spec.subject)}_${slugify(spec.style)}.png`;
  const outPath = join(OUTPUT_DIR, filename);

  if (existsSync(outPath)) {
    console.log(`[${spec.index + 1}/150] Skipping (exists): ${filename}`);
    return;
  }

  console.log(
    `[${spec.index + 1}/150] ${spec.subject} / ${spec.style} / ${spec.theme}`
  );

  try {
    const result = await withTimeout(
      fal.subscribe('fal-ai/nano-banana-2', {
        input: {
          prompt: spec.prompt,
          num_images: 1,
          resolution: '1K',
          aspect_ratio: '1:1',
          output_format: 'png',
          limit_generations: true,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            update.logs
              ?.map((log) => log.message)
              .forEach((m) => console.log(`  [queue] ${m}`));
          }
        },
      }),
      TIMEOUT_MS,
      filename
    );

    const images = (result.data as Record<string, unknown>)?.images as Array<{ url: string }> | undefined;
    const imageUrl = images?.[0]?.url;
    if (!imageUrl) {
      console.error(`  ✗ No image URL for ${spec.index}`);
      return;
    }

    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    await writeFile(outPath, Buffer.from(buffer));
    console.log(`  ✓ Saved ${filename}`);
  } catch (err: unknown) {
    console.error(`  ✗ Failed ${filename}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  const specs = generateSpecs();

  if (process.argv.includes('--dry-run')) {
    console.log('=== DRY RUN: 150 User PFP Specs ===\n');
    for (const spec of specs) {
      console.log(
        `${String(spec.index + 1).padStart(3, ' ')}. ${spec.subject} | ${spec.style} | ${spec.theme} | ${spec.background}`
      );
    }

    const dist = (key: keyof PfpSpec) => {
      const counts: Record<string, number> = {};
      for (const s of specs)
        counts[s[key] as string] = (counts[s[key] as string] || 0) + 1;
      return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    };

    for (const [label, key] of [
      ['Style', 'style'],
      ['Theme', 'theme'],
      ['Subject', 'subject'],
    ] as const) {
      console.log(`\n--- ${label} distribution ---`);
      for (const [val, count] of dist(key)) {
        console.log(`  ${val}: ${count}`);
      }
    }
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(
    `Generating 150 user profile pictures (concurrency: ${CONCURRENCY})...\n`
  );

  for (let i = 0; i < specs.length; i += CONCURRENCY) {
    const batch = specs.slice(i, i + CONCURRENCY);
    console.log(
      `\n── Batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(specs.length / CONCURRENCY)} ──`
    );
    await Promise.all(batch.map(generateImage));
  }

  const generated = specs.filter((s) => {
    const fn = `${String(s.index).padStart(3, '0')}_${slugify(s.subject)}_${slugify(s.style)}.png`;
    return existsSync(join(OUTPUT_DIR, fn));
  }).length;

  console.log(`\n✓ Done! ${generated}/150 user PFPs generated.`);
  if (generated < 150) {
    console.log(
      '  Re-run the script to retry failed ones (skip-existing is on).'
    );
  }
}

main().catch(console.error);
