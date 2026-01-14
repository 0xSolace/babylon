/**
 * Agent Templates API
 *
 * @route GET /api/agent-templates
 * @access Public
 *
 * @description
 * Returns all available agent templates for the agent creation flow.
 * Uses the isolated @babylon/agents/templates export to avoid loading
 * @elizaos/core and other heavy server-side dependencies.
 *
 * @returns {Promise<NextResponse>} JSON response with templates
 */

import {
  getAllTemplates,
  getTemplateIds,
} from '@babylon/agents/templates';
import { NextResponse } from 'next/server';

// Force dynamic rendering to prevent caching of template list
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent-templates
 *
 * @description Fetches all available agent templates
 *
 * @returns {Promise<NextResponse>} Array of templates with IDs
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
    console.error('[AgentTemplatesAPI] Failed to load templates:', error);
    return NextResponse.json(
      {
        error: 'Failed to load templates',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
