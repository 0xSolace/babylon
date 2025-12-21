/**
 * @fileoverview Actor and Organization Image Generation CLI
 *
 * Generates profile pictures and banner images for all actors and organizations
 * using fal.ai's Flux AI image generation models. Supports concurrent generation
 * with automatic skip for existing images.
 *
 * **Generated Images:**
 * - Actor profile pictures (square, portrait style)
 * - Actor banner images (16:9 landscape)
 * - Organization logos (square, satirical parodies)
 * - Organization banners (16:9 landscape)
 *
 * **Features:**
 * - Concurrent generation (max 10 at a time for rate limiting)
 * - Automatic skip for existing images
 * - Satirical logo generation using company name mappings
 * - Template-based prompt rendering
 * - Progress tracking and error reporting
 * - Automatic directory creation
 *
 * **Requirements:**
 * - `FAL_KEY` environment variable must be set
 * - Actor data files must exist in `packages/engine/src/data/actors/` and `packages/engine/src/data/organizations/` (TypeScript files)
 * - Output directories must be writable:
 *   - `public/images/actors/`
 *   - `public/images/actor-banners/`
 *   - `public/images/organizations/`
 *   - `public/images/org-banners/`
 *
 * **Image Specifications:**
 * - Actor PFP: Square (1024x1024), high quality portrait
 * - Actor Banner: Landscape 16:9, thematic background
 * - Org Logo: Square (1024x1024), satirical parody
 * - Org Banner: Landscape 16:9, branded background
 *
 * @module cli/generate-actor-images
 * @category CLI - Content Generation
 *
 * @example
 * ```bash
 * # Set API key
 * export FAL_KEY=your_fal_key_here
 *
 * # Generate all missing images
 * bun run src/cli/generate-actor-images.ts
 *
 * # Output:
 * # Checking actor and organization images...
 * # Checking 64 actor profile pictures...
 * # Checking 64 actor banners...
 * # Checking 52 organization logos...
 * # Checking 52 organization banners...
 * # Found 30 images to generate (202 already exist)
 * # Starting concurrent generation (max 10 at a time)...
 * # ✅ Generated actor-pfp for Actor1
 * # ✅ Generated org-logo for OpenLie
 * # Complete!
 * # { generated: 30, failed: 0, skipped: 202 }
 * ```
 *
 * @see {@link @fal-ai/client} for fal.ai SDK
 * @see {@link ../prompts} for image generation prompts
 * @since v0.1.0
 *
 * **Environment Variables:**
 * @env {string} FAL_KEY - Required fal.ai API key for image generation
 */

import {
  actorBanner,
  actorPortrait,
  loadActorsData,
  organizationBanner,
  organizationLogo,
  renderPrompt,
} from '@babylon/engine';
import { fal } from '@fal-ai/client';
import { config } from 'dotenv';
import { access, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { logger } from './lib/logger.js';

// Load environment variables
config();

const ActorSchema = z.object({
  id: z.string(),
  name: z.string(),
  realName: z.string().optional(),
  description: z.string(),
  domain: z.array(z.string()).optional(),
  personality: z.string().optional(),
  physicalDescription: z.string().optional(),
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

interface FalImageResult {
  url: string;
  width: number;
  height: number;
  content_type: string;
}

interface FalResponse {
  data: {
    images: FalImageResult[];
    seed?: number;
    has_nsfw_concepts?: boolean[];
  };
}

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
 * Generates a profile picture for an actor using fal.ai's Flux Krea model
 */
async function generateActorImage(actor: Actor): Promise<string> {
  logger.info(`Generating profile picture for ${actor.name}...`);

  if (!actor.physicalDescription) {
    throw new Error(`Actor ${actor.name} is missing physicalDescription field`);
  }

  // Extract key satirical elements from description
  const descriptionParts = actor.description.split('.').slice(0, 3).join('. ');

  // Render prompt template with variables
  const prompt = renderPrompt(actorPortrait, {
    actorName: actor.name,
    realName: actor.realName || actor.name,
    physicalDescription: actor.physicalDescription,
    descriptionParts,
    personality: actor.personality || 'satirical',
  });

  const result = (await fal.subscribe('fal-ai/flux/krea', {
    input: {
      prompt,
      image_size: 'square',
      num_images: 1,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS') {
        update.logs
          .map((log) => log.message)
          .forEach((msg) => logger.debug(msg));
      }
    },
  })) as FalResponse;

  // Validate response has images array with at least one image
  if (!result.data.images || result.data.images.length === 0) {
    throw new Error(
      `Fal.ai API returned no images for ${actor.name}. Response: ${JSON.stringify(result.data)}`
    );
  }

  const firstImage = result.data.images[0];
  if (!firstImage?.url) {
    throw new Error(
      `First image missing URL for ${actor.name}. Image data: ${JSON.stringify(firstImage)}`
    );
  }

  logger.info(`Generated profile picture for ${actor.name}: ${firstImage.url}`);
  return firstImage.url;
}

async function generateActorBanner(actor: Actor): Promise<string> {
  logger.info(`Generating banner for ${actor.name}...`);

  if (!actor.profileBanner) {
    throw new Error(`Actor ${actor.name} is missing profileBanner field`);
  }

  // Render prompt template with variables
  const prompt = renderPrompt(actorBanner, {
    actorName: actor.name,
    realName: actor.realName || actor.name,
    profileBanner: actor.profileBanner,
  });

  const result = (await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt,
      image_size: 'landscape_16_9',
      num_inference_steps: 4,
      num_images: 1,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS') {
        update.logs
          .map((log) => log.message)
          .forEach((msg) => logger.debug(msg));
      }
    },
  })) as FalResponse;

  // Validate response has images array with at least one image
  if (!result.data.images || result.data.images.length === 0) {
    throw new Error(
      `Fal.ai API returned no images for ${actor.name} banner. Response: ${JSON.stringify(result.data)}`
    );
  }

  const firstImage = result.data.images[0];
  if (!firstImage?.url) {
    throw new Error(
      `First image missing URL for ${actor.name} banner. Image data: ${JSON.stringify(firstImage)}`
    );
  }

  logger.info(`Generated banner for ${actor.name}: ${firstImage.url}`);
  return firstImage.url;
}

async function generateOrganizationImage(org: Organization): Promise<string> {
  logger.info(`Generating logo for ${org.name}...`);

  if (!org.pfpDescription) {
    throw new Error(`Organization ${org.name} is missing pfpDescription field`);
  }

  // Get the original company name for logo parody
  const originalCompany = getOriginalCompanyName(org.name, org.id);

  // Render prompt template with variables
  const prompt = renderPrompt(organizationLogo, {
    organizationName: org.name,
    originalCompany,
    pfpDescription: org.pfpDescription,
    organizationType: org.type,
    organizationDescription: org.description,
  });

  const result = (await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt,
      image_size: 'square',
      num_inference_steps: 4,
      num_images: 1,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS') {
        update.logs
          .map((log) => log.message)
          .forEach((msg) => logger.debug(msg));
      }
    },
  })) as FalResponse;

  // Validate response has images array with at least one image
  if (!result.data.images || result.data.images.length === 0) {
    throw new Error(
      `Fal.ai API returned no images for ${org.name}. Response: ${JSON.stringify(result.data)}`
    );
  }

  const firstImage = result.data.images[0];
  if (!firstImage?.url) {
    throw new Error(
      `First image missing URL for ${org.name}. Image data: ${JSON.stringify(firstImage)}`
    );
  }

  logger.info(`Generated logo for ${org.name}: ${firstImage.url}`);
  return firstImage.url;
}

async function generateOrganizationBanner(org: Organization): Promise<string> {
  logger.info(`Generating banner for ${org.name}...`);

  if (!org.bannerDescription) {
    throw new Error(
      `Organization ${org.name} is missing bannerDescription field`
    );
  }

  // Get the original company name for logo parody
  const originalCompany = getOriginalCompanyName(org.name, org.id);

  // Render prompt template with variables
  const prompt = renderPrompt(organizationBanner, {
    organizationName: org.name,
    originalCompany,
    bannerDescription: org.bannerDescription,
  });

  const result = (await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt,
      image_size: 'landscape_16_9',
      num_inference_steps: 4,
      num_images: 1,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS') {
        update.logs
          .map((log) => log.message)
          .forEach((msg) => logger.debug(msg));
      }
    },
  })) as FalResponse;

  // Validate response has images array with at least one image
  if (!result.data.images || result.data.images.length === 0) {
    throw new Error(
      `Fal.ai API returned no images for ${org.name} banner. Response: ${JSON.stringify(result.data)}`
    );
  }

  const firstImage = result.data.images[0];
  if (!firstImage?.url) {
    throw new Error(
      `First image missing URL for ${org.name} banner. Image data: ${JSON.stringify(firstImage)}`
    );
  }

  logger.info(`Generated banner for ${org.name}: ${firstImage.url}`);
  return firstImage.url;
}

async function downloadImage(url: string, filepath: string): Promise<void> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
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
 */
async function processQueue(
  jobs: ImageJob[],
  maxConcurrent = 10
): Promise<{ generated: number; failed: number }> {
  let generated = 0;
  let failed = 0;
  const activeJobs = new Set<Promise<void>>();

  for (const job of jobs) {
    // Wait if we're at max concurrency
    if (activeJobs.size >= maxConcurrent) {
      await Promise.race(activeJobs);
    }

    // Create and track the job
    const jobPromise = (async () => {
      logger.info(`Generating ${job.type} for ${job.name}...`);
      await job
        .generator()
        .then(async (imageUrl) => {
          await downloadImage(imageUrl, job.outputPath);
          generated++;
          logger.info(`✅ Generated ${job.type} for ${job.name}`);
        })
        .catch((error: Error) => {
          failed++;
          logger.error(`❌ Failed ${job.type} for ${job.name}`, error);
        });
    })();

    activeJobs.add(jobPromise);

    // Remove from active set when complete
    jobPromise.finally(() => activeJobs.delete(jobPromise));
  }

  // Wait for all remaining jobs to complete
  await Promise.all(activeJobs);

  return { generated, failed };
}

/**
 * Main execution function for image generation CLI
 */
async function main() {
  logger.info('Checking actor and organization images...');

  // Check for FAL_KEY
  if (!process.env.FAL_KEY) {
    logger.error('Error: FAL_KEY not found in environment variables');
    logger.error('Please add FAL_KEY to your .env file');
    process.exit(1);
  }

  // Configure fal.ai client
  fal.config({
    credentials: process.env.FAL_KEY,
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

  // Build job queue for actor profile pictures
  logger.info(`Checking ${actorsDb.actors.length} actor profile pictures...`);
  for (const actor of actorsDb.actors) {
    const imagePath = join(actorsImagesDir, `${actor.id}.jpg`);

    if (await fileExists(imagePath)) {
      skippedCount++;
    } else {
      jobs.push({
        type: 'actor-pfp',
        id: actor.id,
        name: actor.name,
        outputPath: imagePath,
        generator: () => generateActorImage(actor),
      });
    }
  }

  // Build job queue for actor banners
  logger.info(`Checking ${actorsDb.actors.length} actor banners...`);
  for (const actor of actorsDb.actors) {
    const bannerPath = join(actorsBannersDir, `${actor.id}.jpg`);

    if (await fileExists(bannerPath)) {
      skippedCount++;
    } else {
      jobs.push({
        type: 'actor-banner',
        id: actor.id,
        name: actor.name,
        outputPath: bannerPath,
        generator: () => generateActorBanner(actor),
      });
    }
  }

  // Build job queue for organization logos
  logger.info(
    `Checking ${actorsDb.organizations.length} organization logos...`
  );
  for (const org of actorsDb.organizations) {
    const imagePath = join(orgsImagesDir, `${org.id}.jpg`);

    if (await fileExists(imagePath)) {
      skippedCount++;
    } else {
      jobs.push({
        type: 'org-pfp',
        id: org.id,
        name: org.name,
        outputPath: imagePath,
        generator: () => generateOrganizationImage(org),
      });
    }
  }

  // Build job queue for organization banners
  logger.info(
    `Checking ${actorsDb.organizations.length} organization banners...`
  );
  for (const org of actorsDb.organizations) {
    const bannerPath = join(orgsBannersDir, `${org.id}.jpg`);

    if (await fileExists(bannerPath)) {
      skippedCount++;
    } else {
      jobs.push({
        type: 'org-banner',
        id: org.id,
        name: org.name,
        outputPath: bannerPath,
        generator: () => generateOrganizationBanner(org),
      });
    }
  }

  logger.info(
    `Found ${jobs.length} images to generate (${skippedCount} already exist)`
  );

  if (jobs.length === 0) {
    logger.info('All images already exist!');
    return;
  }

  // Process jobs with up to 10 concurrent operations
  logger.info('Starting concurrent generation (max 10 at a time)...');
  const result = await processQueue(jobs, 10);

  logger.info('Complete!', {
    generated: result.generated,
    failed: result.failed,
    skipped: skippedCount,
    totalActors: actorsDb.actors.length,
    totalOrganizations: actorsDb.organizations.length,
    totalPossibleImages:
      actorsDb.actors.length * 2 + actorsDb.organizations.length * 2,
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
