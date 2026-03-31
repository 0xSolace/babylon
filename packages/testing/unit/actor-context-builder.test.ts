import { describe, expect, it } from 'bun:test';
import { ActorContextBuilder } from '@babylon/engine';

describe('ActorContextBuilder', () => {
  const builder = new ActorContextBuilder();

  it('builds context for a known NPC', async () => {
    const ctx = await builder.buildContext('ailon-musk');
    expect(ctx).not.toBeNull();
    expect(ctx!.identity.name).toBe('AIlon Musk');
    expect(ctx!.identity.personality).toBe('erratic visionary');
    expect(ctx!.identity.postExamples.length).toBeGreaterThan(10);
    expect(ctx!.identity.domains).toContain('tech');
    expect(ctx!.identity.affiliations).toContain('teslai');
  });

  it('returns null for unknown actor', async () => {
    const ctx = await builder.buildContext('nonexistent-actor-xyz');
    expect(ctx).toBeNull();
  });

  it('includes ignoreTopics in rules', async () => {
    const ctx = await builder.buildContext('ailon-musk');
    expect(ctx).not.toBeNull();
    // AIlon Musk ignores fashion, sports, entertainment
    if (ctx!.identity.ignoreTopics.length > 0) {
      expect(ctx!.rules.ignoreTopicsRule).toContain('never talk about');
    }
  });

  it('builds context for different actors with different data', async () => {
    const ailon = await builder.buildContext('ailon-musk');
    const trump = await builder.buildContext('trump-terminal');
    const vitalik = await builder.buildContext('vitailik-buterin');

    expect(ailon).not.toBeNull();
    expect(trump).not.toBeNull();
    expect(vitalik).not.toBeNull();

    // Different personalities
    expect(ailon!.identity.personality).not.toBe(trump!.identity.personality);
    expect(trump!.identity.personality).not.toBe(vitalik!.identity.personality);

    // Different domains
    expect(ailon!.identity.domains).toContain('space');
    expect(trump!.identity.domains).toContain('politics');
    expect(vitalik!.identity.domains).toContain('crypto');

    // Different post example counts
    expect(ailon!.identity.postExamples.length).not.toBe(
      vitalik!.identity.postExamples.length
    );
  });

  it('fetches recent posts without crashing', async () => {
    const ctx = await builder.buildContext('ailon-musk');
    expect(ctx).not.toBeNull();
    // Posts may be empty on fresh DB, but shouldn't crash
    expect(Array.isArray(ctx!.awareness.recentPosts)).toBe(true);
  });

  it('fetches world events without crashing', async () => {
    const ctx = await builder.buildContext('ailon-musk');
    expect(ctx).not.toBeNull();
    expect(Array.isArray(ctx!.awareness.worldEvents)).toBe(true);
  });

  it('fetches relationships without crashing', async () => {
    const ctx = await builder.buildContext('ailon-musk');
    expect(ctx).not.toBeNull();
    expect(Array.isArray(ctx!.relationships)).toBe(true);
  });

  it('fetches resolved questions without crashing', async () => {
    const ctx = await builder.buildContext('ailon-musk');
    expect(ctx).not.toBeNull();
    expect(Array.isArray(ctx!.awareness.resolvedQuestions)).toBe(true);
  });

  it('includes tone guardrails for non-degen actors', async () => {
    // Trump Terminal doesn't use degen slang
    const ctx = await builder.buildContext('trump-terminal');
    expect(ctx).not.toBeNull();
    // Should have some tone guardrails
    // (may or may not have content depending on actor's corpus)
    expect(typeof ctx!.rules.toneGuardrails).toBe('string');
  });

  it('includes finance guardrails for non-finance actors', async () => {
    // Trump Terminal is politics domain, not finance
    const ctx = await builder.buildContext('trump-terminal');
    expect(ctx).not.toBeNull();
    expect(typeof ctx!.rules.financeGuardrails).toBe('string');
    if (ctx!.rules.financeGuardrails) {
      expect(ctx!.rules.financeGuardrails).toContain('FINANCE');
    }
  });

  it('returns memories as formatted string', async () => {
    const ctx = await builder.buildContext('ailon-musk');
    expect(ctx).not.toBeNull();
    expect(typeof ctx!.state.memories).toBe('string');
  });

  it('includes actor behavioral rules from pack data', async () => {
    const ctx = await builder.buildContext('ailon-musk');
    expect(ctx).not.toBeNull();
    // actorRules should exist with style arrays
    expect(ctx!.actorRules).toBeDefined();
    expect(Array.isArray(ctx!.actorRules.styleAll)).toBe(true);
    expect(Array.isArray(ctx!.actorRules.stylePost)).toBe(true);
    // Should have post style content
    expect(ctx!.actorRules.stylePost.length).toBeGreaterThan(0);
    // Should have trading/social style
    expect(ctx!.actorRules.tradingStyle).toBeTruthy();
    expect(ctx!.actorRules.socialStyle).toBeTruthy();
    // Should have alignment
    expect(['good', 'neutral', 'evil']).toContain(ctx!.actorRules.alignment);
  });

  it('includes system prompt from pack data', async () => {
    const ctx = await builder.buildContext('ailon-musk');
    expect(ctx).not.toBeNull();
    expect(ctx!.identity.system).toBeTruthy();
    expect(ctx!.identity.system.length).toBeGreaterThan(100);
  });

  it('formats behavioral rules into prompt output', async () => {
    const ctx = await builder.buildContext('ailon-musk');
    expect(ctx).not.toBeNull();
    const formatted = builder.formatForPrompt(ctx!);
    expect(formatted).toContain('BEHAVIOR:');
    expect(formatted).toContain('Trading style:');
  });

  it('returns avoidance patterns as string', async () => {
    const ctx = await builder.buildContext('ailon-musk');
    expect(ctx).not.toBeNull();
    expect(typeof ctx!.state.avoidPatterns).toBe('string');
  });
});
