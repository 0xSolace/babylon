import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const plugins = [
  'plugin-appraisal',
  'plugin-homeostasis',
  'plugin-motivation',
  'plugin-neuro',
] as const;

async function main() {
  if (process.env.SKIP_HALLIDAY_PLUGIN_BUILD === '1') {
    console.log('Skipping Halliday workspace plugin build');
    return;
  }

  for (const plugin of plugins) {
    const packageDir = resolve(process.cwd(), 'packages', plugin);
    if (!existsSync(resolve(packageDir, 'package.json'))) {
      continue;
    }

    console.log(`Building Halliday workspace plugin: ${plugin}`);
    await $`bun run --cwd ${packageDir} build`;
  }
}

await main();
