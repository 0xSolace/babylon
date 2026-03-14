/**
 * @fileoverview Feeding Evaluator - Process feeding commands from plugin-grocery
 *
 * WHAT THIS DOES
 * ==============
 * Listens for FEEDING_COMMAND messages in the chat stream and applies
 * physiological restoration to this agent if targeted. This is the
 * "receiving end" of the FEED_ALL action in plugin-grocery.
 *
 * WHY AN EVALUATOR?
 * =================
 * Evaluators run on every incoming message, making them ideal for:
 * - Detecting special command patterns in the message stream
 * - Applying side effects without interfering with normal conversation
 * - Processing commands that weren't directed at a specific agent
 *
 * Alternative approaches considered:
 * 1. Action: Agents would need to "decide" to process the command - wrong model
 * 2. Service polling: Would require database writes - adds complexity
 * 3. Direct service calls: Requires knowing agentIds - not reliable cross-agent
 *
 * WHY SELF-FILTERING?
 * ===================
 * Cross-agent communication in elizaOS is tricky:
 * - entityId ≠ agentId (IDs are swizzled per-agent perspective)
 * - Direct service calls require knowing the target runtime
 * - Database writes don't trigger notifications
 *
 * Instead, we broadcast to everyone and let each agent check if they're
 * targeted. This is like a radio broadcast - everyone hears it, but only
 * those whose name is called respond.
 *
 * MESSAGE FORMAT
 * ==============
 * The feeding command is JSON embedded in the message text:
 * ```json
 * {
 *   "type": "FEEDING_COMMAND",
 *   "action": "FULL_RESTORE",
 *   "targets": ["AgentName1", "AgentName2", ...],
 *   "issuedBy": "<entityId of human who triggered>",
 *   "issuedAt": <timestamp>
 * }
 * ```
 *
 * WHY JSON IN TEXT?
 * =================
 * Structured content (content.receipt, content.feedingCommand) gets stripped
 * by Discord and other chat platforms. Only the text field survives transit.
 * JSON in text is ugly but reliable.
 *
 * NAME MATCHING
 * =============
 * The evaluator checks if either:
 * - runtime.character.name matches a target (case-insensitive)
 * - runtime.character.username matches a target (case-insensitive)
 *
 * This handles platform differences where the same agent might be known
 * by different names (e.g., "Alice" vs "alice_bot" on Discord).
 */

import type {
  ActionResult,
  Evaluator,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core';
import type { HomeostasisService } from '../services/homeostasis-service.ts';

/**
 * Interface for the feeding command structure.
 *
 * WHY TYPED INTERFACE?
 * ====================
 * Ensures we handle the command correctly and catch typos at compile time.
 * Also documents the expected structure for future maintainers.
 */
interface FeedingCommand {
  /** Identifies this as a feeding command */
  type: 'FEEDING_COMMAND';
  /** What to do - currently only FULL_RESTORE is supported */
  action: 'FULL_RESTORE';
  /** List of agent names to target - agents check if their name is here */
  targets: string[];
  /** entityId of whoever triggered the command - for audit trail */
  issuedBy: string;
  /** Timestamp when command was issued - for debugging */
  issuedAt: number;
}

/**
 * Parse a feeding command from message text.
 *
 * WHY SEPARATE FUNCTION?
 * ======================
 * 1. Isolates JSON parsing errors from main handler logic
 * 2. Returns null on any parse failure - easy to handle
 * 3. Validates structure before returning - ensures type safety
 *
 * WHY VALIDATE STRUCTURE?
 * =======================
 * Not all JSON in messages is a feeding command. We check:
 * - type === 'FEEDING_COMMAND' (not some other JSON)
 * - action === 'FULL_RESTORE' (supported action)
 * - targets is an array (required for name matching)
 */
function parseFeedingCommand(text: string): FeedingCommand | null {
  try {
    const parsed = JSON.parse(text);
    if (
      parsed &&
      parsed.type === 'FEEDING_COMMAND' &&
      parsed.action === 'FULL_RESTORE' &&
      Array.isArray(parsed.targets)
    ) {
      return parsed as FeedingCommand;
    }
    return null;
  } catch {
    // Not valid JSON or wrong structure - that's fine, most messages aren't commands
    return null;
  }
}

/**
 * Check if this agent is targeted by the feeding command.
 *
 * WHY CHECK BOTH NAME AND USERNAME?
 * =================================
 * Different platforms use different identifiers:
 * - character.name: The "display name" or persona name
 * - character.username: Platform-specific handle (e.g., Discord username)
 *
 * By checking both, we maximize the chance of a match even when the
 * sender and receiver are on different platforms or have mismatched
 * name configurations.
 *
 * WHY CASE-INSENSITIVE?
 * =====================
 * Platform inconsistencies: Discord might report "Alice" while the
 * character file says "alice". Case-insensitive matching is more forgiving.
 */
function isAgentTargeted(runtime: IAgentRuntime, targets: string[]): boolean {
  const myName = runtime.character.name?.toLowerCase();
  const myUsername = runtime.character.username?.toLowerCase();

  return targets.some((target) => {
    const targetLower = target.toLowerCase();
    return targetLower === myName || targetLower === myUsername;
  });
}

/**
 * Feeding Evaluator
 *
 * Processes FEEDING_COMMAND messages and applies full physiological restoration
 * if this agent is in the target list.
 *
 * WHY NOT AN ACTION?
 * ==================
 * Actions require agent "decision" to execute. But feeding commands are
 * incoming - we don't want the agent to decide whether to be fed. We want
 * automatic processing of commands directed at this agent.
 *
 * WHY NOT A SERVICE?
 * ==================
 * Services are for stateful, long-running operations. This is a stateless
 * message processor - perfect for an evaluator.
 */
export const feedingEvaluator: Evaluator = {
  name: 'PROCESS_FEEDING_COMMAND',
  description:
    'Process feeding commands from plugin-grocery and apply physiological restoration',

  /**
   * alwaysRun: true means this evaluator runs on every message.
   *
   * WHY ALWAYS RUN?
   * ===============
   * We need to check every incoming message for feeding commands because:
   * 1. Commands can come from any participant in the room
   * 2. We don't know which messages contain commands until we check
   * 3. The validate function quickly filters out non-commands
   *
   * The performance cost is minimal since validate() does a simple
   * string check before attempting any JSON parsing.
   */
  alwaysRun: true,

  similes: ['FEEDING_COMMAND', 'FEED_COMMAND', 'MASS_FEED'],

  /**
   * Examples help the LLM understand the evaluator's purpose.
   *
   * WHY INCLUDE EXAMPLES?
   * =====================
   * While evaluators don't use LLM for execution, examples help:
   * 1. Document expected behavior for developers
   * 2. Potentially inform other LLM-driven components about this evaluator
   * 3. Provide test case inspiration
   */
  examples: [
    {
      prompt: 'Agent receives a feeding command',
      messages: [
        {
          name: 'GroceryAgent',
          content: {
            text: '{"type":"FEEDING_COMMAND","action":"FULL_RESTORE","targets":["TestAgent"],"issuedBy":"user-123","issuedAt":1234567890}',
          },
        },
      ],
      outcome:
        'Feeding command processed, physiological stats restored to full',
    },
  ],

  /**
   * Validate if this message might contain a feeding command.
   *
   * WHY QUICK STRING CHECK?
   * =======================
   * Parsing JSON is expensive. Most messages (99%+) aren't feeding commands.
   * By checking for the command signature string first, we skip JSON parsing
   * for the vast majority of messages.
   *
   * WHY TWO PATTERNS?
   * =================
   * Different JSON serializers format differently:
   * - Some: {"type":"FEEDING_COMMAND"} (no space)
   * - Some: {"type": "FEEDING_COMMAND"} (with space)
   * We check both to be safe.
   */
  validate: async (
    _runtime: IAgentRuntime,
    message: Memory
  ): Promise<boolean> => {
    const text = message.content?.text || '';
    return (
      text.includes('"type":"FEEDING_COMMAND"') ||
      text.includes('"type": "FEEDING_COMMAND"')
    );
  },

  /**
   * Process the feeding command if this agent is targeted.
   *
   * FLOW:
   * 1. Parse JSON from message text
   * 2. Validate it's a proper feeding command
   * 3. Check if this agent's name is in targets
   * 4. If yes, call homeostasis service to reset physiological stats
   * 5. Log the result for debugging
   *
   * WHY SILENT ON NOT-TARGETED?
   * ===========================
   * If this agent isn't in the targets list, we log at debug level and
   * return silently. We don't want to spam logs or create responses
   * for every agent that receives but isn't targeted by a command.
   *
   * WHY -100 DELTA?
   * ===============
   * Physiological scale: 0 = satisfied, 100 = deprived.
   * To fully restore, we apply a -100 delta to all stats.
   * The homeostasis service clamps values, so even if hunger was at 30,
   * applying -100 brings it to 0 (not -70).
   */
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: { [key: string]: unknown },
    _callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult | undefined> => {
    try {
      const text = message.content?.text || '';

      // ========================================================================
      // STEP 1: Parse the feeding command
      // ========================================================================
      // WHY: We need to extract the structured command from the JSON text.
      // This also validates the structure - returns null if invalid.
      const command = parseFeedingCommand(text);
      if (!command) {
        runtime.logger.debug(
          { agentId: runtime.agentId, messageId: message.id },
          'Could not parse feeding command from message'
        );
        return undefined;
      }

      // ========================================================================
      // STEP 2: Check if this agent is targeted
      // ========================================================================
      // WHY: Self-filtering - only agents whose name is in the targets list
      // should apply the effects. This handles the entityId/agentId mismatch.
      if (!isAgentTargeted(runtime, command.targets)) {
        runtime.logger.debug(
          {
            agentId: runtime.agentId,
            myName: runtime.character.name,
            targets: command.targets,
          },
          'Agent not in feeding command targets, skipping'
        );
        return undefined;
      }

      // ========================================================================
      // STEP 3: Get homeostasis service
      // ========================================================================
      // WHY: We need the service to apply physiological changes.
      // If homeostasis isn't available, this agent can't be "fed" - log and return.
      const homeostasis = runtime.getService(
        'homeostasis'
      ) as HomeostasisService | null;
      if (!homeostasis) {
        runtime.logger.warn(
          { agentId: runtime.agentId },
          'Homeostasis service not available, cannot process feeding command'
        );
        return undefined;
      }

      // ========================================================================
      // STEP 4: Apply full restoration
      // ========================================================================
      // WHY -100 FOR ALL STATS:
      // - Physiological scale: 0 = satisfied, 100 = deprived
      // - Applying -100 ensures all stats go to 0 (fully satisfied)
      // - The service clamps values, so we won't go negative
      //
      // WHY INCLUDE SOURCE AND REASON:
      // - source: Identifies which plugin/system caused this change
      // - reason: Human-readable explanation for debugging and audit
      homeostasis.proposePhysiologicalDelta(
        {
          hunger: -100,
          fatigue: -100,
          hydration: -100,
          health: -100,
        },
        {
          source: 'feeding-command',
          reason: `fed_by_human:${command.issuedBy}`,
        }
      );

      runtime.logger.info(
        {
          agentId: runtime.agentId,
          agentName: runtime.character.name,
          issuedBy: command.issuedBy,
          issuedAt: command.issuedAt,
        },
        'Processed feeding command - full physiological restoration applied'
      );
      return {
        success: true,
        text: 'Feeding command processed',
      };
    } catch (error) {
      // WHY CATCH ALL: We don't want a parsing/processing error to crash
      // the evaluator loop. Log and continue processing other messages.
      runtime.logger.error(
        {
          agentId: runtime.agentId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Error processing feeding command'
      );
      return {
        success: false,
        text: 'Feeding command processing failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export default feedingEvaluator;
