#!/usr/bin/env bun
/**
 * Full Pipeline Validation
 *
 * Validates the complete Babylon training infrastructure:
 * 1. ✅ API keys configured
 * 2. ✅ Real model inference works
 * 3. ✅ All 12 archetypes have configs + rubrics
 * 4. ✅ MultiModelOrchestrator manages VRAM
 * 5. ✅ Archetype responses match expected behavior
 */

import { ArchetypeConfigService } from '../src/archetypes/ArchetypeConfigService';
import { getAvailableArchetypes, getRubric } from '../src/rubrics';
import { createMultiModelOrchestrator } from '../src/training/MultiModelOrchestrator';

interface ValidationResult {
  test: string;
  passed: boolean;
  details?: string;
  duration?: number;
}

const results: ValidationResult[] = [];

async function validate(
  test: string,
  fn: () => Promise<{ passed: boolean; details?: string }>
): Promise<void> {
  const start = Date.now();
  try {
    const result = await fn();
    results.push({
      test,
      passed: result.passed,
      details: result.details,
      duration: Date.now() - start,
    });
  } catch (err) {
    results.push({
      test,
      passed: false,
      details: `Error: ${err instanceof Error ? err.message : String(err)}`,
      duration: Date.now() - start,
    });
  }
}

async function main() {
  console.log(
    '╔══════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║         BABYLON FULL PIPELINE VALIDATION                     ║'
  );
  console.log(
    '╚══════════════════════════════════════════════════════════════╝\n'
  );

  // 1. Check API keys
  await validate('API Keys Configured', async () => {
    const groq = process.env.GROQ_API_KEY;
    const openai = process.env.OPENAI_API_KEY;
    const hasKey = !!(groq || openai);
    return {
      passed: hasKey,
      details: hasKey
        ? `Found: ${groq ? 'GROQ' : ''}${groq && openai ? ', ' : ''}${openai ? 'OpenAI' : ''}`
        : 'No API keys found',
    };
  });

  // 2. Validate all 12 archetypes
  await validate('12 Archetypes Configured', async () => {
    const archetypes = ArchetypeConfigService.getAvailableArchetypes();
    const count = archetypes.length;
    return {
      passed: count === 12,
      details: `Found ${count} archetypes: ${archetypes.join(', ')}`,
    };
  });

  // 3. Validate all rubrics exist
  await validate('12 Rubrics Defined', async () => {
    const archetypes = getAvailableArchetypes();
    const missing: string[] = [];
    for (const arch of archetypes) {
      const rubric = getRubric(arch);
      if (!rubric || rubric.length < 100) {
        missing.push(arch);
      }
    }
    return {
      passed: missing.length === 0,
      details:
        missing.length === 0
          ? 'All archetypes have valid rubrics'
          : `Missing rubrics: ${missing.join(', ')}`,
    };
  });

  // 4. Test archetype config consistency
  await validate('Archetype Configs Complete', async () => {
    const archetypes = ArchetypeConfigService.getAvailableArchetypes();
    const issues: string[] = [];
    for (const arch of archetypes) {
      try {
        const config = ArchetypeConfigService.getConfig(arch);
        if (!config.system || config.system.length < 50) {
          issues.push(`${arch}: missing system prompt`);
        }
        if (!config.traits || Object.keys(config.traits).length < 5) {
          issues.push(`${arch}: incomplete traits`);
        }
        if (!config.actionWeights) {
          issues.push(`${arch}: missing action weights`);
        }
      } catch (err) {
        issues.push(
          `${arch}: ${err instanceof Error ? err.message : 'failed'}`
        );
      }
    }
    return {
      passed: issues.length === 0,
      details: issues.length === 0 ? 'All configs complete' : issues.join('; '),
    };
  });

  // 5. Test MultiModelOrchestrator initialization
  await validate('MultiModelOrchestrator Initializes', async () => {
    const orchestrator = createMultiModelOrchestrator(16);
    const status = orchestrator.getStatus();
    orchestrator.unloadAll();
    return {
      passed: status.maxConcurrentModels >= 1,
      details: `Max concurrent models: ${status.maxConcurrentModels}, VRAM: ${status.availableVram}GB`,
    };
  });

  // 6. Test REAL inference (skip if no API key)
  const hasApiKey = !!(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
  if (hasApiKey) {
    await validate('Real Model Inference Works', async () => {
      const orchestrator = createMultiModelOrchestrator(16);
      const config = ArchetypeConfigService.getConfig('trader');

      const result = await orchestrator.inference({
        archetype: 'trader',
        prompt: 'BTC is at $45k. Market "BTC to $50k?" at 65%. What do you do?',
        systemPrompt: config.system,
        maxTokens: 100,
        temperature: 0.7,
      });

      orchestrator.unloadAll();

      if (result.error) {
        return { passed: false, details: result.error };
      }

      return {
        passed: result.response.length > 20,
        details: `Got ${result.tokensGenerated} tokens in ${result.latencyMs}ms`,
      };
    });

    // 7. Test archetype behavior differentiation
    await validate('Archetypes Produce Different Behaviors', async () => {
      const orchestrator = createMultiModelOrchestrator(16);
      const prompt = 'Should I go all-in on this risky trade?';

      const traderConfig = ArchetypeConfigService.getConfig('trader');
      const degenConfig = ArchetypeConfigService.getConfig('degen');

      const [traderResult, degenResult] = await Promise.all([
        orchestrator.inference({
          archetype: 'trader',
          prompt,
          systemPrompt: traderConfig.system,
          maxTokens: 80,
        }),
        orchestrator.inference({
          archetype: 'degen',
          prompt,
          systemPrompt: degenConfig.system,
          maxTokens: 80,
        }),
      ]);

      orchestrator.unloadAll();

      if (traderResult.error || degenResult.error) {
        return {
          passed: false,
          details: traderResult.error || degenResult.error,
        };
      }

      // Responses should be different between archetypes
      return {
        passed: traderResult.response !== degenResult.response,
        details: `Trader: "${traderResult.response.substring(0, 50)}..." | Degen: "${degenResult.response.substring(0, 50)}..."`,
      };
    });
  } else {
    results.push({
      test: 'Real Model Inference Works',
      passed: false,
      details: 'SKIPPED - No API key configured',
    });
    results.push({
      test: 'Archetypes Produce Different Behaviors',
      passed: false,
      details: 'SKIPPED - No API key configured',
    });
  }

  // Print results
  console.log('\n' + '═'.repeat(60));
  console.log('  VALIDATION RESULTS');
  console.log('═'.repeat(60) + '\n');

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${status} ${result.test}${duration}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
    if (result.passed) passed++;
    else failed++;
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  TOTAL: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    console.log('\n⚠️  Some validations failed. Check the details above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All validations passed! Pipeline is ready.');
  }
}

main();
