import { describe, expect, it } from 'vitest';
import { StaticDataRegistry } from '../../services/static-data-registry';
import {
  formatActorFinanceGuardrails,
  isDegenSpeaker,
} from '../../utils/shared-utils';

function toGuardrailsActor(actorId: string): {
  name: string;
  domain: string[];
  personality?: string;
  voice?: string;
  postStyle?: string;
  postExample?: string[];
} {
  const actor = StaticDataRegistry.getActor(actorId);
  if (!actor) {
    throw new Error(
      `Expected actor '${actorId}' to exist in StaticDataRegistry`
    );
  }
  return {
    name: actor.name,
    domain: actor.domain,
    personality: actor.personality,
    voice: actor.voice,
    postStyle: actor.postStyle,
    postExample: actor.postExample,
  };
}

describe('NPC finance/ticker guardrails', () => {
  it('classifies degens vs non-degens reasonably', () => {
    // Non-degens: tech leaders without trading/crypto jargon
    // Note: ben-horowaitz contains "funding rounds" which triggers degen detection
    // so we use jensen-huaing (GPU hardware) and sergey-brain (tech/science) instead
    expect(isDegenSpeaker(toGuardrailsActor('jensen-huaing'))).toBe(false);
    expect(isDegenSpeaker(toGuardrailsActor('sergey-brain'))).toBe(false);

    // Degens: traders and finance people who naturally use tickers/jargon
    expect(isDegenSpeaker(toGuardrailsActor('gainzy'))).toBe(true);
    // Finance voice that naturally uses tickers should be allowed
    expect(isDegenSpeaker(toGuardrailsActor('nancy-pelosai'))).toBe(true);
  });

  it('applies finance guardrails only to non-degens', () => {
    // Non-degen should get guardrails
    const jensenRules = formatActorFinanceGuardrails(
      toGuardrailsActor('jensen-huaing')
    );
    expect(jensenRules).toContain('DO NOT talk in tickers');

    // Degens should NOT get guardrails (empty string)
    const degenRules = formatActorFinanceGuardrails(
      toGuardrailsActor('gainzy')
    );
    expect(degenRules).toBe('');

    const nancyRules = formatActorFinanceGuardrails(
      toGuardrailsActor('nancy-pelosai')
    );
    expect(nancyRules).toBe('');
  });
});
