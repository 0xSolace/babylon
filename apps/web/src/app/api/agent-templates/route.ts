/**
 * Agent Templates API
 *
 * @route GET /api/agent-templates
 * @access Public
 *
 * @description
 * Returns all available agent templates. Uses dynamic imports to handle
 * module loading errors gracefully in serverless environments.
 *
 * @returns {Promise<NextResponse>} JSON response with templates data
 */

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
    // Use dynamic import to catch module-level errors
    const { getAllTemplates, getTemplateIds } = await import('@babylon/agents');

    const templates = getAllTemplates();
    const templateIds = getTemplateIds();

    return NextResponse.json({
      templates: Array.from(templateIds),
      templatesData: templates,
    });
  } catch (error) {
    console.error('[AgentTemplatesAPI] Failed to load templates:', error);
    return NextResponse.json(
      {
        error: 'Failed to load templates',
        details: error instanceof Error ? error.message : String(error),
        stack:
          process.env.NODE_ENV !== 'production' && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}
