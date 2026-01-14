/**
 * Templates-only export
 *
 * This module exports ONLY the template loading functionality without any
 * dependencies on @elizaos/core or other heavy server-side packages.
 *
 * Use this export path for API routes that only need template data:
 * ```ts
 * import { getAllTemplates, getTemplate } from '@babylon/agents/templates';
 * ```
 *
 * @packageDocumentation
 */

export {
  getAllTemplates,
  getRandomTemplate,
  getTemplate,
  getTemplateIds,
} from './templates-loader';

export type { AgentTemplate } from './types/agent-template';

