/**
 * Article Image Generation Service
 *
 * Generates cover images for articles using Jeju Compute's decentralized
 * image generation models. Falls back gracefully when not available.
 */

import { logger } from '@babylon/shared'
import { getJejuComputeEndpoint } from '@babylon/shared/config'
import { articleCover, renderPrompt } from '../prompts'

/**
 * Jeju Compute endpoint for image generation
 * Uses decentralized compute marketplace for inference
 */
const JEJU_COMPUTE_ENDPOINT = getJejuComputeEndpoint()

interface JejuImageResponse {
  id: string
  images: Array<{
    url: string
    width?: number
    height?: number
  }>
}

interface ArticleImageParams {
  title: string
  summary: string
  category?: string
}

/**
 * Initialize the image generation client
 * With Jeju Compute, no explicit initialization needed - it's stateless
 */
export function initFalClient(): boolean {
  // Jeju Compute doesn't need explicit initialization
  // Return true if we have a configured endpoint
  const available = isImageGenerationAvailable()
  if (!available) {
    logger.warn(
      'Image generation disabled - JEJU_COMPUTE_ENDPOINT not configured',
      {},
      'ArticleImageService',
    )
  }
  return available
}

/**
 * Check if image generation is available
 * Requires Jeju Compute endpoint to be configured
 */
export function isImageGenerationAvailable(): boolean {
  // Available if we have a compute endpoint configured
  return !!JEJU_COMPUTE_ENDPOINT && JEJU_COMPUTE_ENDPOINT !== ''
}

/**
 * Generate a cover image for an article (best-effort, non-blocking)
 *
 * This function never throws - errors are logged and null is returned.
 * This ensures image generation failures don't block tick execution.
 *
 * @param params - Article details for image generation
 * @returns URL of the generated image, or null if generation fails
 */
export async function generateArticleImage(
  params: ArticleImageParams,
): Promise<string | null> {
  if (!isImageGenerationAvailable()) {
    logger.debug(
      'Skipping article image generation - FAL_KEY not available',
      { title: params.title },
      'ArticleImageService',
    )
    return null
  }

  const prompt = renderPrompt(articleCover, {
    title: params.title,
    summary: params.summary,
    category: params.category || 'general',
  })

  logger.debug(
    'Generating article cover image via Jeju Compute',
    { title: params.title, category: params.category },
    'ArticleImageService',
  )

  // EXCEPTION TO FAIL-FAST RULE: External API boundary
  // Image generation is non-critical - failures should not crash the game tick.
  // This try-catch is intentional per PR #651 review to ensure best-effort behavior.
  // Jeju Compute can fail for: network issues, provider unavailable, timeouts.
  let result: JejuImageResponse
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(
      `${JEJU_COMPUTE_ENDPOINT}/v1/images/generations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.JEJU_WALLET_ADDRESS && {
            'x-jeju-address': process.env.JEJU_WALLET_ADDRESS,
          }),
        },
        body: JSON.stringify({
          model: 'stable-diffusion-xl',
          prompt,
          size: '1792x1024', // landscape 16:9
          n: 1,
          response_format: 'url',
        }),
        signal: controller.signal,
      },
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Jeju Compute error: ${response.status}`)
    }

    result = (await response.json()) as JejuImageResponse
  } catch (error) {
    logger.warn(
      'Jeju Compute image generation failed (non-critical, continuing)',
      {
        title: params.title,
        error: error instanceof Error ? error.message : String(error),
      },
      'ArticleImageService',
    )
    return null
  }

  if (!result.images || result.images.length === 0) {
    logger.error(
      'No images returned from Jeju Compute',
      { title: params.title },
      'ArticleImageService',
    )
    return null
  }

  const imageUrl = result.images[0]?.url
  if (!imageUrl) {
    logger.error(
      'Image URL missing in Jeju Compute response',
      { title: params.title },
      'ArticleImageService',
    )
    return null
  }

  logger.info(
    'Generated article cover image via Jeju Compute',
    { title: params.title, imageUrl },
    'ArticleImageService',
  )

  return imageUrl
}

/**
 * Generate article image with retry logic
 *
 * @param params - Article details for image generation
 * @param maxRetries - Maximum number of retry attempts (default: 2)
 * @returns URL of the generated image, or null if all retries fail
 */
export async function generateArticleImageWithRetry(
  params: ArticleImageParams,
  maxRetries = 2,
): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const imageUrl = await generateArticleImage(params)
    if (imageUrl) {
      return imageUrl
    }

    if (attempt < maxRetries) {
      logger.warn(
        `Article image generation attempt ${attempt + 1} failed, retrying...`,
        { title: params.title },
        'ArticleImageService',
      )
      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
    }
  }

  logger.error(
    `Failed to generate article image after ${maxRetries + 1} attempts`,
    { title: params.title },
    'ArticleImageService',
  )
  return null
}
