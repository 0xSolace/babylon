import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ActorsDatabase, ActorData, Organization } from '../src/shared/types';

type ReplacementPattern = {
  pattern: RegExp;
  replacement: string | ((match: string) => string);
  description: string;
};

export class NameReplacer {
  private patterns: ReplacementPattern[] = [];
  private actorsData: ActorsDatabase;

  constructor(actorsJsonPath?: string) {
    if (!actorsJsonPath) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadActorsData } = require('../src/lib/data/actors-loader');
      this.actorsData = loadActorsData();
    } else {
      this.actorsData = JSON.parse(fs.readFileSync(actorsJsonPath, 'utf-8'));
    }

    this.buildPatterns();
  }

  public replaceInText(text: string): string {
    let result = text;

    for (const { pattern, replacement } of this.patterns) {
      if (typeof replacement === 'string') {
        result = result.replace(pattern, replacement);
      } else {
        result = result.replace(pattern, replacement);
      }
    }

    return result;
  }

  public replaceInFile(filePath: string): {
    changed: boolean;
    original: string;
    modified: string;
  } {
    const original = fs.readFileSync(filePath, 'utf-8');
    const modified = this.replaceInText(original);
    const changed = original !== modified;

    if (changed) {
      fs.writeFileSync(filePath, modified, 'utf-8');
    }

    return { changed, original, modified };
  }

  public getPatterns(): ReplacementPattern[] {
    return this.patterns;
  }

  private static escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private matchCase(sample: string, replacement: string): string {
    const lettersOnly = sample.replace(/[^a-z]/gi, '');
    if (lettersOnly && lettersOnly === lettersOnly.toUpperCase()) {
      return replacement.toUpperCase();
    }
    if (lettersOnly && lettersOnly === lettersOnly.toLowerCase()) {
      return replacement.toLowerCase();
    }
    return replacement;
  }

  private addPattern(
    source: string,
    target: string,
    description: string,
    {
      wordBoundary = true,
      prefix = '',
      suffix = '',
      allowRunOn = false,
    }: { wordBoundary?: boolean; prefix?: string; suffix?: string; allowRunOn?: boolean } = {}
  ): void {
    if (!source || !target) return;
    const escapedSource = NameReplacer.escapeRegExp(source.trim());
    const startBoundary = wordBoundary ? '\\b' : '';
    const endBoundary = wordBoundary ? '\\b' : '';
    const pattern = new RegExp(`${prefix}${startBoundary}${escapedSource}${endBoundary}${suffix}`, 'gi');

    const replacement = (match: string) => this.matchCase(match, `${prefix}${target}`);
    this.patterns.push({
      pattern,
      replacement,
      description,
    });

    if (allowRunOn && source.includes(' ')) {
      const collapsedSource = source.replace(/\s+/g, '');
      const collapsedTarget = target.replace(/\s+/g, '');
      if (collapsedSource && collapsedTarget) {
        this.patterns.push({
          pattern: new RegExp(`${prefix}${NameReplacer.escapeRegExp(collapsedSource)}${suffix}`, 'gi'),
          replacement: (match: string) => this.matchCase(match, `${prefix}${collapsedTarget}`),
          description: `${description} (collapsed)`,
        });
      }
    }
  }

  private buildPatterns(): void {
    this.patterns = [];

    const manualOrgOverrides = new Map<string, string>([
      ['OpenAI', 'OpnAI'],
      ['Meta', 'Met'],
      ['Twitter', 'AIX'],
    ]);

    const actorData = this.actorsData.actors ?? [];
    const orgData = this.actorsData.organizations ?? [];

    const ensureName = (actor: ActorData): string | undefined => {
      if (actor.realName) return actor.realName;
      const first = actor.originalFirstName ?? '';
      const last = actor.originalLastName ?? '';
      const full = `${first} ${last}`.trim();
      return full || undefined;
    };

    const uniqueKeys = new Set<string>();
    const addUniquePattern = (
      source: string | undefined,
      target: string | undefined,
      description: string,
      options?: { wordBoundary?: boolean; prefix?: string; suffix?: string; allowRunOn?: boolean }
    ) => {
      if (!source || !target || source.toLowerCase() === target.toLowerCase()) {
        return;
      }
      const key = `${description}:${source}->${target}`;
      if (uniqueKeys.has(key)) return;
      uniqueKeys.add(key);
      this.addPattern(source, target, description, options);
    };

    for (const actor of actorData) {
      const originalFullName = ensureName(actor);
      const parodyFullName = actor.name;
      const [parodyFirstName, ...parodyRest] = parodyFullName.split(/\s+/).filter(Boolean);
      const parodyLastName = parodyRest.join(' ').trim();

      if (originalFullName && parodyFullName && originalFullName !== parodyFullName) {
        addUniquePattern(originalFullName, parodyFullName, `actor:${actor.id}:full`, {
          allowRunOn: true,
        });
      }

      if (actor.originalFirstName && parodyFirstName && actor.originalFirstName !== parodyFirstName) {
        addUniquePattern(actor.originalFirstName, parodyFirstName, `actor:${actor.id}:first`);
      }

      if (actor.originalLastName && parodyLastName && actor.originalLastName !== parodyLastName) {
        addUniquePattern(actor.originalLastName, parodyLastName, `actor:${actor.id}:last`);
      }

      if (
        actor.originalFirstName &&
        actor.originalLastName &&
        parodyFirstName &&
        parodyLastName &&
        (actor.originalFirstName !== parodyFirstName || actor.originalLastName !== parodyLastName)
      ) {
        const originalRunOn = `${actor.originalFirstName}${actor.originalLastName}`;
        const parodyRunOn = `${parodyFirstName}${parodyLastName}`;
        addUniquePattern(originalRunOn, parodyRunOn, `actor:${actor.id}:runon`, {
          wordBoundary: false,
        });
      }

      if (actor.originalHandle && actor.username && actor.originalHandle !== actor.username) {
        addUniquePattern(
          actor.originalHandle,
          actor.username,
          `actor:${actor.id}:handle`,
          { prefix: '@', suffix: '', wordBoundary: false }
        );
      }
    }

    const mapOrganization = (org: Organization, originalName: string, replacementName: string) => {
      addUniquePattern(originalName, replacementName, `org:${org.id}:name`);
      if (org.originalHandle) {
        addUniquePattern(
          org.originalHandle,
          org.id || replacementName.replace(/\s+/g, '').toLowerCase(),
          `org:${org.id}:handle`,
          { prefix: '@', wordBoundary: false }
        );
      }
    };

    for (const org of orgData) {
      if (!org.originalName || !org.name) continue;
      const manual = manualOrgOverrides.get(org.originalName);
      if (manual) {
        mapOrganization(org, org.originalName, manual);
      }

      if (org.name && org.originalName && org.name !== manualOrgOverrides.get(org.originalName)) {
        mapOrganization(org, org.originalName, org.name);
      }
    }

    for (const [original, replacement] of manualOrgOverrides) {
      addUniquePattern(original, replacement, 'manual:org');
    }
  }
}

// CLI functionality
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx name-replacer.ts <file-or-directory>');
    console.log('       npx tsx name-replacer.ts --test "text to test"');
    process.exit(1);
  }

  // Use new loader (no path needed)
  const replacer = new NameReplacer();

  if (args[0] === '--test') {
    const testText = args.slice(1).join(' ');
    console.log('Original:', testText);
    console.log('Replaced:', replacer.replaceInText(testText));
  } else if (args[0] === '--show-patterns') {
    const patterns = replacer.getPatterns();
    console.log(`Total patterns: ${patterns.length}`);
    patterns.slice(0, 20).forEach((p) => {
      const replacement =
        typeof p.replacement === 'string' ? p.replacement : '[dynamic replacement]';
      console.log(`  ${p.pattern.source} -> ${replacement}`);
    });
    console.log('  ...');
  } else {
    const targetPathArg = args[0];
    if (!targetPathArg) {
      console.error('Error: No target path provided');
      process.exit(1);
    }
    const targetPath = path.resolve(targetPathArg);

    if (fs.statSync(targetPath).isDirectory()) {
      const files = getAllFiles(targetPath);
      let changedCount = 0;

      for (const file of files) {
        const result = replacer.replaceInFile(file);
        if (result.changed) {
          changedCount++;
          console.log(`✓ ${path.relative(process.cwd(), file)}`);
        }
      }

      console.log(`\n${changedCount} of ${files.length} files modified`);
    } else {
      const result = replacer.replaceInFile(targetPath);
      if (result.changed) {
        console.log(`✓ File modified: ${path.relative(process.cwd(), targetPath)}`);
      } else {
        console.log('No changes needed');
      }
    }
  }
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (
      file.endsWith('.ts') ||
      file.endsWith('.tsx') ||
      file.endsWith('.js') ||
      file.endsWith('.jsx')
    ) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

export default NameReplacer;
