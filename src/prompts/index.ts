/**
 * Prompt Registry
 *
 * Central export for all prompt definitions across the application.
 * Provides a single import point for all prompts, enabling type safety
 * and tree-shaking. Prompts are organized by category (feed, game, image,
 * system, world, trading).
 *
 * @example
 * ```ts
 * import { ambientPost, renderPrompt } from '@/prompts';
 *
 * const prompt = renderPrompt(ambientPost, {
 *   actorName: 'Alice',
 *   actorDescription: 'Tech CEO'
 * });
 * ```
 */

export type { PromptDefinition } from './define-prompt';
// Re-export utilities
export { definePrompt, renderTemplate } from './define-prompt';
export { ambientPost } from './feed/ambient-post';
export { ambientPosts } from './feed/ambient-posts';
export { analystReaction } from './feed/analyst-reaction';
export { commentary } from './feed/commentary';
export { companyPost } from './feed/company-post';
export { companyPosts } from './feed/company-posts';
export { conspiracy } from './feed/conspiracy';
export { conspiracyPost } from './feed/conspiracy-post';
export { directReaction } from './feed/direct-reaction';
export { expertCommentary } from './feed/expert-commentary';
export { governmentPost } from './feed/government-post';
// Prompts by category
// Feed prompts
export { governmentPosts } from './feed/government-posts';
export { journalistPost } from './feed/journalist-post';
export { journalistPosts } from './feed/journalist-posts';
export { mediaPost } from './feed/media-post';
export { minuteAmbient } from './feed/minute-ambient';
export { newsPosts } from './feed/news-posts';
export { reactions } from './feed/reactions';
export { replies } from './feed/replies';
export { reply } from './feed/reply';
export { stockTicker } from './feed/stock-ticker';
export { baselineEvent } from './game/baseline-event';
export { dayEvents } from './game/day-events';
// Game prompts
export { dayTransition } from './game/day-transition';
export { eventDescriptions } from './game/event-descriptions';
export { groupChatName } from './game/group-chat-name';
export { groupChatNames } from './game/group-chat-names';
export { groupMessage } from './game/group-message';
export { groupMessages } from './game/group-messages';
export { phaseContext } from './game/phase-context';
export { priceAnnouncement } from './game/price-announcement';
export { priceImpact } from './game/price-impact';
export { questionGeneration } from './game/question-generation';
export { questionRankings } from './game/question-rankings';
export { questionResolutionValidation } from './game/question-resolution-validation';
export { questionResolvedFeed } from './game/question-resolved-feed';
export { questions } from './game/questions';
export { resolutionEvent } from './game/resolution-event';
export { scenarios } from './game/scenarios';
// Image prompts
export { actorBanner, actorPortrait } from './image/actor-portrait';
export {
  organizationBanner,
  organizationLogo,
} from './image/organization-logo';
export { userProfileBanner } from './image/user-profile-banner';
export { userProfilePicture } from './image/user-profile-picture';
export { getPromptParams, renderPrompt } from './loader';
// System prompts
export { xmlAssistant } from './system/json-assistant';
// Trading prompts
export { npcMarketDecisions } from './trading/npc-market-decisions';
export { daySummary } from './world/day-summary';
export { expertAnalysis } from './world/expert-analysis';
export { newsReport } from './world/news-report';
export { npcConversation } from './world/npc-conversation';
// World prompts
export { rumor } from './world/rumor';
export type { WorldContext, WorldContextOptions } from './world-context';
// World Context & Reality Grounding
export {
  REALITY_GROUNDING,
  checkRealityGrounding,
  generateActivePredictions,
  generateCurrentMarkets,
  generateRecentTrades,
  generateWorldActors,
  generateWorldContext,
  getCurrentDateContext,
  getForbiddenRealNames,
  getMinimalRealityGrounding,
  getParodyActorNames,
  getRealityGrounding,
  validateGeneratedContent,
  validateNoRealNames,
} from './world-context';

/**
 * Usage examples:
 *
 * import { ambientPost, renderPrompt } from '@/prompts';
 *
 * const prompt = renderPrompt(ambientPost, {
 *   actorName: 'Alice',
 *   actorDescription: 'Tech CEO'
 * });
 *
 * const params = getPromptParams(ambientPost);
 * // { temperature: 0.9, maxTokens: 5000 }
 */
