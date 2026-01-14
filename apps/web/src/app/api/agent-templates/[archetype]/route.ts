/**
 * Agent Template by Archetype API
 *
 * @route GET /api/agent-templates/[archetype]
 * @access Public
 *
 * @description
 * Returns a specific agent template by archetype ID. Uses dynamic imports to
 * handle module loading errors gracefully in serverless environments.
 *
 * @returns {Promise<NextResponse>} JSON response with template data
 */

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

    // Use dynamic import to catch module-level errors
    const { getTemplate } = await import('@babylon/agents');
    const template = getTemplate(archetype);

    if (!template) {
      return NextResponse.json(
        { error: `Template '${archetype}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('[AgentTemplatesAPI] Failed to load template:', error);
    return NextResponse.json(
      {
        error: 'Failed to load template',
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
