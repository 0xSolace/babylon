/**
 * Agent Templates API
 *
 * @route GET /api/agent-templates
 * @access Public
 *
 * @description
 * Returns all available agent templates. Uses TypeScript imports for optimal
 * performance and type safety.
 *
 * @returns {Promise<NextResponse>} JSON response with templates data
 */

import { getAllTemplates, getTemplateIds } from '@babylon/agents';
import { logger } from '@babylon/shared';
import { NextResponse } from 'next/server';

// Force dynamic rendering to prevent caching of template list
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent-templates
 *
 * @description Fetches all available agent templates
 *
 * @returns {Promise<NextResponse>} Templates data
 */
export async function GET() {
  try {
    const templates = getAllTemplates();
    const templateIds = getTemplateIds();

    return NextResponse.json({
      templates: Array.from(templateIds),
      templatesData: templates,
    });
  } catch (error) {
    logger.error(
      'Failed to load agent templates',
      { error: error instanceof Error ? error.message : String(error) },
      'AgentTemplatesAPI'
    );
    return NextResponse.json(
      {
        error: 'Failed to load templates',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
