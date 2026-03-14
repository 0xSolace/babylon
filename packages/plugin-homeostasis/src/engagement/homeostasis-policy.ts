/**
 * @fileoverview Homeostasis Engagement Policy
 *
 * Controls agent engagement based on internal homeostatic state.
 *
 * ## WHY THIS EXISTS
 *
 * Agents have internal states (hunger, fatigue, social need) that should
 * affect their behavior. A tired agent should engage less. A lonely agent
 * might engage more. This policy translates internal state into engagement
 * decisions.
 *
 * ## SEPARATION OF CONCERNS
 *
 * This code lives in plugin-homeostasis, NOT plugin-autonomous, because:
 *
 * 1. **Single Responsibility**
 *    - autonomous = message batching and coordination
 *    - homeostasis = internal state management
 *    - Each plugin does one thing well
 *
 * 2. **Optional Dependency**
 *    - autonomous works without homeostasis installed
 *    - homeostasis works without autonomous (just no engagement control)
 *    - No circular dependencies
 *
 * 3. **Clean Testing**
 *    - Test homeostasis policy with mock homeostasis service
 *    - No need to set up full autonomous infrastructure
 *
 * 4. **Future Flexibility**
 *    - Other plugins can have their own policies
 *    - No bloat in autonomous core
 *
 * ## HOW IT REGISTERS
 *
 * In plugin init:
 * ```typescript
 * runtime.getServicePromise('autonomous').then((autonomous) => {
 *   autonomous.engagementEngine.register(new HomeostasisEngagementPolicy());
 * });
 * ```
 *
 * WHY SERVICE PROMISE:
 * - If autonomous isn't loaded, promise never resolves (no error)
 * - If autonomous loads later, registration still happens
 * - Cleaner than try/catch with getService()
 *
 * ## STATE MAPPINGS
 *
 * ### Physiological (0=satisfied, 100=deprived)
 *
 * | Variable | When High (>70) | When High (>40) | Effect |
 * |----------|-----------------|-----------------|--------|
 * | fatigue  | Exhausted (-30) | Tired (-15)     | LESS willing (conserve energy) |
 * | hunger   | Hungry (+25)    | Peckish (+10)   | MORE willing (seeking input) |
 * | health   | Unwell (-20)    | Suboptimal (-10)| LESS willing (conserve) |
 * | hydration| Disconnected (-15)| -             | LESS willing (impaired) |
 *
 * ### Psychological (50=balanced, extremes=tension)
 *
 * | Drive    | When Low (<30) | When Low (<50) | Effect |
 * |----------|----------------|----------------|--------|
 * | social   | Lonely (+35)   | Social-need (+15)| MORE willing (craving connection) |
 * | status   | Seeking (+20)  | Aware (+5)     | MORE willing (prove competence) |
 * | meaning  | Seeking (+15)  | Aware (+5)     | MORE willing if question |
 * | security | Anxious (-10)  | -              | LESS willing (cautious) |
 * | autonomy | Constrained (-10)| -            | LESS willing (feeling controlled) |
 *
 * ## COUNTER-INTUITIVE DESIGN
 *
 * Some mappings may seem backwards. Here's the reasoning:
 *
 * **Hunger = MORE willing, not less**
 * - In humans, hunger drives foraging behavior
 * - For an agent, "hunger" = craving input/novelty
 * - High hunger → actively seek new conversations
 *
 * **Low social = MORE willing**
 * - Low social drive = craving connection
 * - The agent WANTS to engage to fulfill that need
 * - High social = already satisfied = okay to skip
 *
 * **Fatigue = LESS willing**
 * - This one IS intuitive
 * - Tired agents should conserve energy
 * - Reduce both willingness and effort
 *
 * ## HARD STOPS
 *
 * Some lifecycle states completely block engagement:
 *
 * | State     | Modifier | Why |
 * |-----------|----------|-----|
 * | dead      | -100     | Agent is gone, cannot respond |
 * | suspended | -100     | Agent is paused, should not respond |
 *
 * Note: crisis/dying states don't hard-block but significantly reduce
 * willingness unless the message is important (mention/question).
 *
 * ## EFFORT LEVEL
 *
 * Based on distress score and fatigue:
 *
 * | Condition | Effort | Why |
 * |-----------|--------|-----|
 * | fatigue > 60 OR distress > 60 | minimal | Conservation mode |
 * | fatigue > 30 OR distress > 40 | normal  | Moderate capacity |
 * | Otherwise | full | Normal operation |
 */

import type { IAgentRuntime, UUID } from '@elizaos/core';
import type { HomeostasisService } from '../services/homeostasis-service';

/**
 * Interface matching plugin-autonomous's EngagementPolicy.
 *
 * WHY DEFINE HERE INSTEAD OF IMPORT:
 * - Avoids circular dependency
 * - plugin-homeostasis doesn't depend on plugin-autonomous
 * - Runtime type checking ensures compatibility
 *
 * The actual interface in autonomous is the source of truth.
 * This must match exactly or registration will fail at runtime.
 */
interface WillingnessResult {
  modifier: number;
  effort: 'minimal' | 'normal' | 'full';
  reason: string;
}

interface EngagementContext {
  runtime: IAgentRuntime;
  message: any;
  plan?: any;
  phase: 'pre-filter' | 'post-check';
  isMentioned: boolean;
  isDirectQuestion: boolean;
  recentEngagementCount: number;
  timeSinceLastEngagement: number;
}

interface EngagementPolicy {
  name: string;
  getWillingnessModifier(ctx: EngagementContext): Promise<WillingnessResult>;
  recordOutcome?(agentId: UUID, engaged: boolean, tokenCost: number): void;
}

/**
 * HomeostasisEngagementPolicy
 *
 * Adjusts willingness based on the agent's internal state.
 *
 * WHY A CLASS:
 * - Stateless (all state comes from HomeostasisService)
 * - But easier to register as an instance
 * - Could add caching in future if needed
 */
export class HomeostasisEngagementPolicy implements EngagementPolicy {
  name = 'homeostasis';

  /**
   * Evaluate willingness based on physiological and psychological state.
   *
   * @param ctx - The engagement context from autonomous
   * @returns Willingness modifier, effort level, and reasons
   */
  async getWillingnessModifier(
    ctx: EngagementContext
  ): Promise<WillingnessResult> {
    // ========================================================================
    // GET HOMEOSTASIS SERVICE
    // ========================================================================
    // WHY DYNAMIC LOOKUP:
    // - Service might not be initialized yet
    // - Different agents might have different states
    // - Clean separation from autonomous
    const hs = ctx.runtime.getService(
      'homeostasis'
    ) as HomeostasisService | null;

    if (!hs) {
      // Homeostasis not available - return neutral
      // WHY NEUTRAL: Don't block or boost, let other policies decide
      return {
        modifier: 0,
        effort: 'full',
        reason: 'service-unavailable',
      };
    }

    // Get current state
    const physio = hs.getPhysiological();
    const drives = hs.getDrives();
    const state = hs.getState();
    const lifecycle = state.lifecycle.status;

    // ========================================================================
    // HARD STOPS: Lifecycle states that completely block engagement
    // ========================================================================

    if (lifecycle === 'dead') {
      // Dead agents cannot respond
      // WHY -100: Absolute block. No boost can overcome this.
      return {
        modifier: -100,
        effort: 'minimal',
        reason: 'dead',
      };
    }

    if (lifecycle === 'suspended') {
      // Suspended agents should not respond
      // WHY -100: User explicitly paused this agent
      return {
        modifier: -100,
        effort: 'minimal',
        reason: 'suspended',
      };
    }

    let modifier = 0;
    const reasons: string[] = [];

    // ========================================================================
    // PHYSIOLOGICAL EFFECTS
    // Scale: 0 = satisfied (good), 100 = deprived (critical)
    // ========================================================================

    // ----------------------------------------------------------------------
    // FATIGUE: High = exhausted = LESS willing to engage
    // WHY: Being tired makes you want to disengage and rest
    // ----------------------------------------------------------------------
    if (physio.fatigue > 70) {
      modifier -= 30;
      reasons.push('exhausted');
    } else if (physio.fatigue > 40) {
      modifier -= 15;
      reasons.push('tired');
    }

    // ----------------------------------------------------------------------
    // HUNGER: High = craving input = MORE willing
    // WHY COUNTER-INTUITIVE: "Hunger" for an agent means seeking stimulation
    // A "hungry" agent wants new input, engagement, novelty
    // ----------------------------------------------------------------------
    if (physio.hunger > 70) {
      modifier += 25;
      reasons.push('hungry');
    } else if (physio.hunger > 40) {
      modifier += 10;
      reasons.push('peckish');
    }

    // ----------------------------------------------------------------------
    // HEALTH: Low health = unwell = LESS willing
    // WHY: An unhealthy agent should conserve resources
    // ----------------------------------------------------------------------
    if (physio.health > 70) {
      modifier -= 20;
      reasons.push('unwell');
    } else if (physio.health > 40) {
      modifier -= 10;
      reasons.push('suboptimal');
    }

    // ----------------------------------------------------------------------
    // HYDRATION: Low = disconnected = LESS willing
    // WHY: Severe dehydration impairs functioning
    // Only triggered at high levels (>70)
    // ----------------------------------------------------------------------
    if (physio.hydration > 70) {
      modifier -= 15;
      reasons.push('disconnected');
    }

    // ========================================================================
    // PSYCHOLOGICAL DRIVE EFFECTS
    // Scale: 50 = balanced, <30 = deficit (craving), >70 = abundance
    // ========================================================================

    // ----------------------------------------------------------------------
    // SOCIAL: Low = lonely = MORE willing to engage
    // WHY: Craving connection drives engagement seeking
    // High social = satisfied = okay to skip
    // ----------------------------------------------------------------------
    if (drives.social < 30) {
      modifier += 35;
      reasons.push('lonely');
    } else if (drives.social < 50) {
      modifier += 15;
      reasons.push('social-need');
    } else if (drives.social > 70) {
      modifier -= 20;
      reasons.push('social-full');
    }

    // ----------------------------------------------------------------------
    // STATUS: Low = want recognition = MORE willing
    // WHY: Eager to prove competence and gain respect
    // ----------------------------------------------------------------------
    if (drives.status < 30) {
      modifier += 20;
      reasons.push('seeking-status');
    } else if (drives.status < 50) {
      modifier += 5;
      reasons.push('status-aware');
    }

    // ----------------------------------------------------------------------
    // MEANING: Low + question = very eager to help
    // WHY: Questions are opportunities to contribute meaningfully
    // Only boosts if it's a question (can be impactful)
    // ----------------------------------------------------------------------
    if (drives.meaning < 30 && ctx.isDirectQuestion) {
      modifier += 15;
      reasons.push('seeking-meaning');
    } else if (drives.meaning < 40) {
      modifier += 5;
      reasons.push('meaning-aware');
    }

    // ----------------------------------------------------------------------
    // SECURITY: Low = anxious = might be more cautious
    // WHY: Anxiety makes you hesitant
    // Could also go the other way (seeking reassurance)
    // We chose cautious interpretation
    // ----------------------------------------------------------------------
    if (drives.security < 30) {
      modifier -= 10;
      reasons.push('anxious');
    }

    // ----------------------------------------------------------------------
    // AUTONOMY: Low = feeling controlled = might disengage
    // WHY: Resentment at being "forced" to engage
    // Subtle effect, not as strong as fatigue
    // ----------------------------------------------------------------------
    if (drives.autonomy < 30) {
      modifier -= 10;
      reasons.push('constrained');
    }

    // ========================================================================
    // LIFECYCLE: Crisis mode = survival mode
    // ========================================================================
    // WHY NOT HARD BLOCK:
    // Crisis means agent is struggling but not dead.
    // Important messages (mentions) should still get through.
    if (lifecycle === 'crisis' || lifecycle === 'dying') {
      if (!ctx.isMentioned && !ctx.isDirectQuestion) {
        // Low-importance message during crisis = skip
        modifier -= 40;
        reasons.push('crisis-mode');
      } else {
        // Important message during crisis = still respond (for help/etc)
        reasons.push('crisis-but-mentioned');
      }
    }

    // ========================================================================
    // EFFORT LEVEL based on capacity
    // ========================================================================
    // WHY COMBINE FATIGUE AND DISTRESS:
    // Either physical exhaustion OR psychological strain reduces capacity.
    const distress = hs.getDistressScore();

    let effort: 'minimal' | 'normal' | 'full' = 'full';
    if (physio.fatigue > 60 || distress > 60) {
      // Very tired or very stressed = minimal effort
      effort = 'minimal';
    } else if (physio.fatigue > 30 || distress > 40) {
      // Moderately tired or stressed = normal effort
      effort = 'normal';
    }

    return {
      modifier,
      effort,
      reason: reasons.join(',') || 'balanced',
    };
  }
}
