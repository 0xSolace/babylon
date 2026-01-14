/**
 * Agent Templates Loader
 *
 * Loads agent templates from TypeScript data files using direct imports
 * for optimal performance and type safety.
 *
 * @remarks
 * Architecture:
 * - Individual TypeScript files for each template
 * - Index file exports all templates
 * - In-memory caching for performance
 * - Direct imports for template lookups
 *
 * Performance:
 * - First load: <1ms (direct imports, no file I/O)
 * - Subsequent loads: <1ms (uses cache)
 * - Template lookups: Direct import (fastest)
 *
 * @packageDocumentation
 */

import { templateIds, templates } from './templates';
import type { AgentTemplate } from './types/agent-template';

/**
 * In-memory cache for loaded templates
 * @internal
 */
const templateCache: Map<string, AgentTemplate> = new Map();

/**
 * Flag to track initialization status
 * @internal
 */
let initializationError: Error | null = null;

/**
 * Initializes cache from imported data
 * @internal
 */
function initializeCache(): void {
  if (templateCache.size === 0 && !initializationError) {
    try {
      if (!templates || !Array.isArray(templates)) {
        throw new Error('Templates data is not available or not an array');
      }
      templates.forEach((template) => {
        if (!template || !template.archetype) {
          console.warn('Skipping invalid template:', template);
          return;
        }
        const templateData = { ...template } as AgentTemplate;
        templateCache.set(templateData.archetype, templateData);
      });
    } catch (error) {
      initializationError =
        error instanceof Error ? error : new Error(String(error));
      console.error(
        'Failed to initialize template cache:',
        initializationError.message
      );
    }
  }
}

/**
 * Gets all available template IDs
 *
 * @returns Array of template archetype IDs
 */
export function getTemplateIds(): readonly string[] {
  if (!templateIds || !Array.isArray(templateIds)) {
    console.warn('Template IDs not available');
    return [];
  }
  return templateIds;
}

/**
 * Gets all templates
 *
 * @returns Array of all agent templates
 */
export function getAllTemplates(): AgentTemplate[] {
  initializeCache();
  if (initializationError) {
    console.error(
      'Template initialization failed:',
      initializationError.message
    );
    return [];
  }
  return Array.from(templateCache.values());
}

/**
 * Gets a template by archetype ID
 *
 * @param archetype - The archetype ID (e.g., 'trader', 'researcher')
 * @returns Template data or null if not found
 */
export function getTemplate(archetype: string): AgentTemplate | null {
  initializeCache();
  if (initializationError) {
    console.error(
      'Template initialization failed:',
      initializationError.message
    );
    return null;
  }
  return templateCache.get(archetype) ?? null;
}

/**
 * Gets a random template
 *
 * @returns Random template or null if no templates available
 */
export function getRandomTemplate(): AgentTemplate | null {
  initializeCache();
  if (initializationError) {
    console.error(
      'Template initialization failed:',
      initializationError.message
    );
    return null;
  }
  const allTemplates = Array.from(templateCache.values());
  if (allTemplates.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * allTemplates.length);
  return allTemplates[randomIndex] ?? null;
}
