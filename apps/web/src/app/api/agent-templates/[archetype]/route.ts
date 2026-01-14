/**
 * Agent Template by Archetype API
 *
 * @route GET /api/agent-templates/[archetype]
 * @access Public
 *
 * @description
 * Returns a specific agent template by archetype ID. Uses the isolated
 * @babylon/agents/templates export to avoid loading @elizaos/core and
 * other heavy server-side dependencies.
 *
 * @returns {Promise<NextResponse>} JSON response with template data
 */

import { getTemplate } from '@babylon/agents/templates';
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
    const { archetype } = await params;
    console.error(
      `[AgentTemplatesAPI] Failed to load template '${archetype}':`,
      error
    );
    return NextResponse.json(
      {
        error: `Failed to load template '${archetype}'`,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
