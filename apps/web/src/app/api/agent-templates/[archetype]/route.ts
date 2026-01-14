/**
 * Agent Template by Archetype API
 *
 * @route GET /api/agent-templates/[archetype]
 * @access Public
 *
 * @description
 * Returns a specific agent template by archetype ID. Uses TypeScript imports
 * for optimal performance and type safety.
 *
 * @returns {Promise<NextResponse>} JSON response with template data
 */

import { getTemplate } from '@babylon/agents';
import { logger } from '@babylon/shared';
import { NextResponse } from 'next/server';

// Force dynamic rendering to prevent caching of templates
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent-templates/[archetype]
 *
 * @description Fetches a specific agent template by archetype
 *
 * @returns {Promise<NextResponse>} Template data
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ archetype: string }> }
) {
  try {
    const { archetype } = await params;
    const template = getTemplate(archetype);

    if (!template) {
      return NextResponse.json(
        { error: `Template '${archetype}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    logger.error(
      'Failed to load agent template',
      { error: error instanceof Error ? error.message : String(error) },
      'AgentTemplatesAPI'
    );
    return NextResponse.json(
      {
        error: 'Failed to load template',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
