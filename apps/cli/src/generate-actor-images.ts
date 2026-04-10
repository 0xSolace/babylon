/**
 * @fileoverview Actor and Organization Image Generation CLI
 *
 * Generates profile pictures and banner images for all actors and organizations
 * using OpenAI's gpt-image-1.5 model for maximum realism.
 *
 * **Generated Images:**
 * - Actor profile pictures (square, portrait style)
 * - Actor banner images (landscape)
 * - Organization logos (square, satirical parodies)
 * - Organization banners (landscape)
 *
 * **Features:**
 * - Concurrent generation (max 3 at a time for rate limiting)
 * - Automatic skip for existing images (use --force to regenerate all)
 * - Satirical logo generation using company name mappings
 * - Template-based prompt rendering
 * - Progress tracking and error reporting
 * - Automatic directory creation
 *
 * **Requirements:**
 * - `OPENAI_API_KEY` environment variable must be set
 * - Actor data files must exist in `packages/engine/src/data/actors/` and `packages/engine/src/data/organizations/` (TypeScript files)
 * - Output directories must be writable:
 *   - `public/images/actors/`
 *   - `public/images/actor-banners/`
 *   - `public/images/organizations/`
 *   - `public/images/org-banners/`
 *
 * **Image Specifications:**
 * - Actor PFP: Square (1024x1024), high quality portrait
 * - Actor Banner: Landscape (1536x1024), thematic background
 * - Org Logo: Square (1024x1024), satirical parody
 * - Org Banner: Landscape (1536x1024), branded background
 *
 * @module cli/generate-actor-images
 * @category CLI - Content Generation
 *
 * @example
 * ```bash
 * # Set API key
 * export OPENAI_API_KEY=your_key_here
 *
 * # Generate all missing images
 * bun run src/generate-actor-images.ts
 *
 * # Force regenerate all images (overwrite existing)
 * bun run src/generate-actor-images.ts --force
 * ```
 *
 * @see {@link openai} for OpenAI SDK
 * @see {@link ../prompts} for image generation prompts
 * @since v0.2.0
 *
 * **Environment Variables:**
 * @env {string} OPENAI_API_KEY - Required OpenAI API key for image generation
 */

import {
  actorBanner,
  actorPortrait,
  loadActorsData,
  organizationBanner,
  organizationLogo,
  renderPrompt,
} from '@babylon/engine';
import { config } from 'dotenv';
import { access, mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { parseFlagValue } from './cli-utils.js';
import { logger } from './lib/logger.js';

// ─── CLI flags ────────────────────────────────────────────────────────────────
//
// --force           Delete existing images and regenerate everything
// --actor <id>      Only process images for a single actor (partial regeneration)
// --org <id>        Only process images for a single organization
//
// Examples:
//   bun run images -- --force
//   bun run images -- --actor ailon-musk
//   bun run images -- --org org-openagi

// Load environment variables
config();

const ActorSchema = z.object({
  id: z.string(),
  name: z.string(),
  realName: z.string().optional(),
  description: z.string(),
  domain: z.array(z.string()).optional(),
  personality: z.string().optional(),
  pfpDescription: z.string().optional(),
  profileBanner: z.string().optional(),
});
type Actor = z.infer<typeof ActorSchema>;

const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.string(),
  pfpDescription: z.string().optional(),
  bannerDescription: z.string().optional(),
});
type Organization = z.infer<typeof OrganizationSchema>;

const ActorsDatabaseSchema = z.object({
  version: z.string().optional(),
  description: z.string().optional(),
  actors: z.array(ActorSchema),
  organizations: z.array(OrganizationSchema),
});

/**
 * Checks if a file exists at the given path
 */
async function fileExists(path: string): Promise<boolean> {
  return access(path)
    .then(() => true)
    .catch(() => false);
}

/**
 * Maps satirical organization IDs to their real-world company names
 *
 * Used to generate logo parodies that reference the original company's branding
 * while maintaining the satirical nature of the game.
 */
function getOriginalCompanyName(satiricalName: string, orgId: string): string {
  const mappings: Record<string, string> = {
    openlie: 'OpenAGI',
    anthropimp: 'Anthropic',
    anthoprick: 'Anthropic',
    deepmined: 'DeepMind',
    facehook: 'Facebook/Meta',
    palantyrant: 'Palantir',
    anduritalin: 'Anduril',
    xitter: 'Twitter/X',
    huskla: 'Tesla',
    spacehusk: 'SpaceX',
    neuraljank: 'Neuralink',
    macrohard: 'Microsoft',
    goolag: 'Google',
    scamazon: 'Amazon',
    crapple: 'Apple',
    'faux-news': 'Fox News',
    msdnc: 'MSNBC',
    cnn: 'CNN',
    'washout-post': 'Washington Post',
    'the-new-york-crimes': 'New York Times',
    'the-daily-liar': 'The Daily Wire',
    microtreasury: 'MicroStrategy',
    conbase: 'Coinbase',
    ai16z: 'Andreessen Horowitz (a16z)',
    taxifornia: 'California',
    'loot-social': 'Truth Social',
    'grift-social': 'Truth Social',
    'dump-organization': 'Trump Organization',
    'sucker-carlton-tonight': 'Tucker Carlson Tonight',
    infobores: 'InfoWars',
    'aimerica-first': 'America First',
    cnbs: 'CNBC',
    'the-fud': 'Federal Reserve',
    nvidiot: 'NVIDIA',
    blackcrook: 'BlackRock',
    boomerberg: 'Bloomberg',
    'wall-street-urinal': 'Wall Street Journal',
    politicon: 'Politico',
    'financial-crimes': 'Financial Times',
    'ethereal-foundation': 'Ethereum Foundation',
    angelgrift: 'AngelList',
    angelfist: 'AngelList',
    'founders-fraud': 'Founders Fund',
    'ark-ingest': 'ARK Invest',
    'larp-invest': 'ARK Invest',
    'vulture-capital': 'Social Capital',
    'department-of-war': 'Department of Defense',
    'cia-inc': 'CIA',
    'effective-authoritarianism': 'Effective Altruism',
    goober: 'Uber',
    'uber-but-worse': 'Uber',
    'cloud-kitchens': 'CloudKitchens',
    'all-in-podcast': 'All-In Podcast',
    'craft-vultures': 'Craft Ventures',
    'pirate-liars': 'Pirate Wires',
    'network-grift-state': 'The Network State',
    entropic: 'Extropic',
    'dont-try-protocol': "Blueprint/Don't Die",
  };

  return mappings[orgId] || satiricalName;
}

/**
 * Generates a profile picture for an actor using OpenAI's gpt-image-1.5
 *
 * Creates a high-quality square portrait based on the actor's physical description
 * and personality traits. Uses template-based prompts for consistent results.
 */
async function generateActorImage(
  openai: OpenAI,
  actor: Actor
): Promise<string> {
  logger.info(`Generating profile picture for ${actor.name}...`);

  const descriptionParts = actor.description.split('.').slice(0, 3).join('. ');

  const prompt = renderPrompt(actorPortrait, {
    actorName: actor.name,
    realName: actor.realName || actor.name,
    pfpDescription: actor.pfpDescription!,
    descriptionParts,
    personality: actor.personality || 'satirical',
  });

  const result = await openai.images.generate({
    model: 'gpt-image-1.5',
    prompt,
    size: '1024x1024',
    quality: 'high',
    output_format: 'jpeg',
    n: 1,
  });

  const imageBase64 = result.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error(`No image data returned for actor ${actor.name}`);
  }

  logger.info(`Generated profile picture for ${actor.name}`);
  return imageBase64;
}

/**
 * Generates a banner for an actor using OpenAI's gpt-image-1.5
 */
async function generateActorBannerImage(
  openai: OpenAI,
  actor: Actor
): Promise<string> {
  logger.info(`Generating banner for ${actor.name}...`);

  if (!actor.profileBanner) {
    throw new Error(`Actor ${actor.name} is missing profileBanner field`);
  }

  const prompt = renderPrompt(actorBanner, {
    actorName: actor.name,
    realName: actor.realName || actor.name,
    profileBanner: actor.profileBanner,
  });

  const result = await openai.images.generate({
    model: 'gpt-image-1.5',
    prompt,
    size: '1536x1024',
    quality: 'high',
    output_format: 'jpeg',
    n: 1,
  });

  const imageBase64 = result.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error(`No image data returned for ${actor.name} banner`);
  }

  logger.info(`Generated banner for ${actor.name}`);
  return imageBase64;
}

/**
 * Generates a logo for an organization using OpenAI's gpt-image-1.5
 */
async function generateOrganizationImage(
  openai: OpenAI,
  org: Organization
): Promise<string> {
  logger.info(`Generating logo for ${org.name}...`);

  if (!org.pfpDescription) {
    throw new Error(`Organization ${org.name} is missing pfpDescription field`);
  }

  const originalCompany = getOriginalCompanyName(org.name, org.id);

  const prompt = renderPrompt(organizationLogo, {
    organizationName: org.name,
    originalCompany,
    pfpDescription: org.pfpDescription,
    organizationType: org.type,
    organizationDescription: org.description,
  });

  const result = await openai.images.generate({
    model: 'gpt-image-1.5',
    prompt,
    size: '1024x1024',
    quality: 'high',
    output_format: 'jpeg',
    n: 1,
  });

  const imageBase64 = result.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error(`No image data returned for ${org.name}`);
  }

  logger.info(`Generated logo for ${org.name}`);
  return imageBase64;
}

/**
 * Generates a banner for an organization using OpenAI's gpt-image-1.5
 */
async function generateOrganizationBannerImage(
  openai: OpenAI,
  org: Organization
): Promise<string> {
  logger.info(`Generating banner for ${org.name}...`);

  if (!org.bannerDescription) {
    throw new Error(
      `Organization ${org.name} is missing bannerDescription field`
    );
  }

  const originalCompany = getOriginalCompanyName(org.name, org.id);

  const prompt = renderPrompt(organizationBanner, {
    organizationName: org.name,
    originalCompany,
    bannerDescription: org.bannerDescription,
  });

  const result = await openai.images.generate({
    model: 'gpt-image-1.5',
    prompt,
    size: '1536x1024',
    quality: 'high',
    output_format: 'jpeg',
    n: 1,
  });

  const imageBase64 = result.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error(`No image data returned for ${org.name} banner`);
  }

  logger.info(`Generated banner for ${org.name}`);
  return imageBase64;
}

/**
 * Saves base64 image data to a file
 */
async function saveBase64Image(
  base64Data: string,
  filepath: string
): Promise<void> {
  const buffer = Buffer.from(base64Data, 'base64');
  await writeFile(filepath, buffer);
  logger.info(`Saved image to ${filepath}`);
}

interface ImageJob {
  type: 'actor-pfp' | 'actor-banner' | 'org-pfp' | 'org-banner';
  id: string;
  name: string;
  outputPath: string;
  generator: () => Promise<string>;
}

/**
 * Processes image generation jobs with concurrency control
 *
 * Uses max 3 concurrent jobs to respect OpenAI rate limits for high-quality
 * image generation. Each gpt-image-1.5 high-quality image can take up to
 * 2 minutes to generate.
 */
async function processQueue(
  jobs: ImageJob[],
  maxConcurrent = 3
): Promise<{ generated: number; failed: number }> {
  let generated = 0;
  let failed = 0;
  const activeJobs = new Set<Promise<void>>();

  for (const job of jobs) {
    if (activeJobs.size >= maxConcurrent) {
      await Promise.race(activeJobs);
    }

    const jobPromise = (async () => {
      logger.info(
        `[${generated + failed + 1}/${jobs.length}] Generating ${job.type} for ${job.name}...`
      );
      await job
        .generator()
        .then(async (base64Data) => {
          await saveBase64Image(base64Data, job.outputPath);
          generated++;
          logger.info(
            `✅ [${generated}/${jobs.length}] Generated ${job.type} for ${job.name}`
          );
        })
        .catch((error: Error) => {
          failed++;
          logger.error(`❌ Failed ${job.type} for ${job.name}`, error);
        });
    })();

    activeJobs.add(jobPromise);
    jobPromise.finally(() => activeJobs.delete(jobPromise));
  }

  await Promise.all(activeJobs);

  return { generated, failed };
}

/**
 * Main execution function for image generation CLI
 *
 * Orchestrates the complete image generation workflow:
 * 1. Validates OPENAI_API_KEY environment variable
 * 2. Loads actors database
 * 3. Checks for existing images (skips if present, unless --force)
 * 4. Builds generation job queue
 * 5. Processes jobs concurrently (max 3)
 * 6. Reports statistics
 */
async function deleteIfExists(filePath: string): Promise<void> {
  try {
    await rm(filePath, { force: true });
  } catch {
    // ignore
  }
}

async function main() {
  // Parse CLI flags
  const args = process.argv.slice(2);
  const forceRegenerate = args.includes('--force');
  const filterActorId = parseFlagValue(args, '--actor');
  const filterOrgId = parseFlagValue(args, '--org');

  if (filterActorId) {
    logger.info(`Filtering to single actor: ${filterActorId}`);
  }
  if (filterOrgId) {
    logger.info(`Filtering to single organization: ${filterOrgId}`);
  }
  if (forceRegenerate) {
    logger.info('--force: existing images will be deleted and regenerated');
  }

  logger.info('Checking actor and organization images...');
  logger.info(`Model: gpt-image-1.5 | Quality: high | Format: jpeg`);

  if (forceRegenerate) {
    logger.info('--force flag detected: will regenerate ALL images');
  }

  // Check for OPENAI_API_KEY
  if (!process.env.OPENAI_API_KEY) {
    logger.error('Error: OPENAI_API_KEY not found in environment variables');
    logger.error('Please add OPENAI_API_KEY to your .env file');
    process.exit(1);
  }

  // Configure OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Load actors database using the engine package loader
  const parsedActors = loadActorsData();
  const actorsDb = ActorsDatabaseSchema.parse(parsedActors);

  // Paths are relative to the web app's public folder
  const webPublicDir = join(process.cwd(), '..', 'web', 'public');
  const actorsImagesDir = join(webPublicDir, 'images', 'actors');
  const actorsBannersDir = join(webPublicDir, 'images', 'actor-banners');
  const orgsImagesDir = join(webPublicDir, 'images', 'organizations');
  const orgsBannersDir = join(webPublicDir, 'images', 'org-banners');

  // Create directories if they don't exist
  await Promise.all([
    mkdir(actorsImagesDir, { recursive: true }),
    mkdir(actorsBannersDir, { recursive: true }),
    mkdir(orgsImagesDir, { recursive: true }),
    mkdir(orgsBannersDir, { recursive: true }),
  ]);

  let skippedCount = 0;
  const jobs: ImageJob[] = [];

  // Determine which actors/orgs to process
  const actorsToProcess = filterActorId
    ? actorsDb.actors.filter((a) => a.id === filterActorId)
    : actorsDb.actors;
  const orgsToProcess = filterOrgId
    ? actorsDb.organizations.filter((o) => o.id === filterOrgId)
    : filterActorId
      ? [] // --actor implies skip orgs unless --org also specified
      : actorsDb.organizations;

  if (filterActorId && actorsToProcess.length === 0) {
    logger.error(`No actor found with id "${filterActorId}"`);
    logger.info(
      'Available actor ids: ' +
        actorsDb.actors
          .map((a) => a.id)
          .slice(0, 10)
          .join(', ') +
        '...'
    );
    process.exit(1);
  }

  if (filterOrgId && orgsToProcess.length === 0) {
    logger.error(`No organization found with id "${filterOrgId}"`);
    logger.info(
      'Available org ids: ' +
        actorsDb.organizations
          .map((o) => o.id)
          .slice(0, 10)
          .join(', ') +
        '...'
    );
    process.exit(1);
  }

  // Build job queue for actor profile pictures
  logger.info(`Checking ${actorsToProcess.length} actor profile pictures...`);
  for (const actor of actorsToProcess) {
    const imagePath = join(actorsImagesDir, `${actor.id}.jpg`);

    if (forceRegenerate) {
      await deleteIfExists(imagePath);
    }

    if (await fileExists(imagePath)) {
      skippedCount++;
    } else {
      jobs.push({
        type: 'actor-pfp',
        id: actor.id,
        name: actor.name,
        outputPath: imagePath,
        generator: () => generateActorImage(openai, actor),
      });
    }
  }

  // Build job queue for actor banners
  logger.info(`Checking ${actorsToProcess.length} actor banners...`);
  for (const actor of actorsToProcess) {
    const bannerPath = join(actorsBannersDir, `${actor.id}.jpg`);

    if (forceRegenerate) {
      await deleteIfExists(bannerPath);
    }

    if (await fileExists(bannerPath)) {
      skippedCount++;
    } else {
      jobs.push({
        type: 'actor-banner',
        id: actor.id,
        name: actor.name,
        outputPath: bannerPath,
        generator: () => generateActorBannerImage(openai, actor),
      });
    }
  }

  // Build job queue for organization logos
  logger.info(`Checking ${orgsToProcess.length} organization logos...`);
  for (const org of orgsToProcess) {
    const imagePath = join(orgsImagesDir, `${org.id}.jpg`);

    if (forceRegenerate) {
      await deleteIfExists(imagePath);
    }

    if (await fileExists(imagePath)) {
      skippedCount++;
    } else {
      jobs.push({
        type: 'org-pfp',
        id: org.id,
        name: org.name,
        outputPath: imagePath,
        generator: () => generateOrganizationImage(openai, org),
      });
    }
  }

  // Build job queue for organization banners
  logger.info(`Checking ${orgsToProcess.length} organization banners...`);
  for (const org of orgsToProcess) {
    const bannerPath = join(orgsBannersDir, `${org.id}.jpg`);

    if (forceRegenerate) {
      await deleteIfExists(bannerPath);
    }

    if (await fileExists(bannerPath)) {
      skippedCount++;
    } else {
      jobs.push({
        type: 'org-banner',
        id: org.id,
        name: org.name,
        outputPath: bannerPath,
        generator: () => generateOrganizationBannerImage(openai, org),
      });
    }
  }

  logger.info(
    `Found ${jobs.length} images to generate (${skippedCount} already exist)`
  );

  if (jobs.length === 0) {
    logger.info('All images already exist! Use --force to regenerate.');
    return;
  }

  // Process jobs with up to 3 concurrent operations (OpenAI rate limit safe)
  logger.info(
    'Starting concurrent generation (max 3 at a time, gpt-image-1.5 high quality)...'
  );
  const result = await processQueue(jobs, 3);

  logger.info('Complete!', {
    generated: result.generated,
    failed: result.failed,
    skipped: skippedCount,
    totalActors: actorsToProcess.length,
    totalOrganizations: orgsToProcess.length,
  });
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: Error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
