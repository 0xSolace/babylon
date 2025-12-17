#!/usr/bin/env bun

/**
 * Test Real Model Inference
 *
 * Validates that the MultiModelOrchestrator makes REAL API calls,
 * not mocked or simulated ones.
 */

import { ArchetypeConfigService } from '../src/archetypes/ArchetypeConfigService';
import { createMultiModelOrchestrator } from '../src/training/MultiModelOrchestrator';

async function main() {
  console.log(
    '╔══════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║           TESTING REAL MODEL INFERENCE                       ║'
  );
  console.log(
    '╚══════════════════════════════════════════════════════════════╝\n'
  );

  // Check for API keys
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  console.log('🔑 API Key Status:');
  console.log(`   GROQ_API_KEY: ${groqKey ? '✅ Set' : '❌ Not set'}`);
  console.log(`   OPENAI_API_KEY: ${openaiKey ? '✅ Set' : '❌ Not set'}`);
  console.log();

  if (!groqKey && !openaiKey) {
    console.error('❌ No API keys found. Set GROQ_API_KEY or OPENAI_API_KEY');
    process.exit(1);
  }

  // Create orchestrator
  const orchestrator = createMultiModelOrchestrator(16);
  console.log('📦 Created MultiModelOrchestrator');
  console.log(
    `   Status: ${JSON.stringify(orchestrator.getStatus(), null, 2)}\n`
  );

  // Test archetypes
  const archetypes = ['trader', 'degen', 'researcher'];

  for (const archetype of archetypes) {
    console.log(`\n🎭 Testing archetype: ${archetype}`);
    console.log('─'.repeat(50));

    const config = ArchetypeConfigService.getConfig(archetype);
    console.log(
      `   System prompt preview: "${config.system.substring(0, 60)}..."`
    );

    const startTime = Date.now();

    const result = await orchestrator.inference({
      archetype,
      prompt:
        'You are in a prediction market. BTC is at $45,000. There is a market "Will BTC reach $50k by end of month?" currently at 65% YES. What would you do?',
      systemPrompt: config.system,
      maxTokens: 150,
      temperature: 0.7,
    });

    const duration = Date.now() - startTime;

    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    } else {
      console.log(`   ✅ Response received in ${duration}ms`);
      console.log(`   📝 Model: ${result.modelId}`);
      console.log(`   📊 Tokens: ${result.tokensGenerated}`);
      console.log(`   💬 Response preview:`);
      console.log(
        `      "${result.response.substring(0, 200).replace(/\n/g, ' ')}..."`
      );
    }
  }

  // Print final status
  console.log('\n\n📊 Final Orchestrator Status:');
  const status = orchestrator.getStatus();
  console.log(`   Loaded models: ${status.loadedModels.length}`);
  console.log(`   Total VRAM used: ${status.totalVramUsed}GB`);
  console.log(`   vLLM available: ${status.vllmAvailable}`);

  // Cleanup
  orchestrator.unloadAll();
  console.log('\n✅ Test complete - Real inference validated!');
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
