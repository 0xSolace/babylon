/**
 * Jeju Compute Provider Tests
 *
 * Verifies that the Jeju Compute integration works correctly
 * NO FALLBACKS - Decentralized compute is required
 */

import { describe, expect, it } from 'bun:test';
import dotenv from 'dotenv';
import { AgentDecisionMaker } from '../src/decision';

dotenv.config({ path: '.env.local' });

describe('Jeju Compute Configuration', () => {
  it('should create decision maker with Jeju Compute', () => {
    const maker = new AgentDecisionMaker({
      strategy: 'balanced',
      jejuGatewayUrl: 'http://localhost:4200',
    });

    expect(maker.getProvider()).toContain('Jeju Compute');
  });

  it('should use environment variable for gateway URL', () => {
    const originalUrl = process.env.JEJU_GATEWAY_URL;
    process.env.JEJU_GATEWAY_URL = 'http://test-gateway:4200';

    const maker = new AgentDecisionMaker({
      strategy: 'balanced',
    });

    expect(maker.getProvider()).toContain('test-gateway');

    // Restore original
    if (originalUrl) {
      process.env.JEJU_GATEWAY_URL = originalUrl;
    } else {
      delete process.env.JEJU_GATEWAY_URL;
    }
  });

  it('should support different strategies', () => {
    const strategies = [
      'conservative',
      'balanced',
      'aggressive',
      'social',
    ] as const;

    for (const strategy of strategies) {
      const maker = new AgentDecisionMaker({
        strategy,
        jejuGatewayUrl: 'http://localhost:4200',
      });
      expect(maker.getProvider()).toBeDefined();
    }
  });
});

describe('Jeju Compute Live Test', () => {
  const hasJejuCompute = !!(
    process.env.JEJU_GATEWAY_URL || process.env.JEJU_COMPUTE_ENDPOINT
  );

  if (hasJejuCompute) {
    it('should make a real decision with Jeju Compute', async () => {
      const maker = new AgentDecisionMaker({
        strategy: 'balanced',
        jejuGatewayUrl: process.env.JEJU_GATEWAY_URL,
      });

      console.log(`   Using: ${maker.getProvider()}`);

      const decision = await maker.decide({
        portfolio: { balance: 1000, positions: [], pnl: 0 },
        markets: {
          predictions: [
            {
              id: 'test-1',
              question: 'Will Bitcoin reach $100k?',
              yesShares: 35,
              noShares: 65,
            },
          ],
          perps: [],
        },
        feed: { posts: [] },
        memory: [],
      });

      expect(decision).toBeDefined();
      expect(decision.action).toBeDefined();
      expect([
        'BUY_YES',
        'BUY_NO',
        'SELL',
        'OPEN_LONG',
        'OPEN_SHORT',
        'CLOSE_POSITION',
        'CREATE_POST',
        'CREATE_COMMENT',
        'HOLD',
      ]).toContain(decision.action);

      console.log(`   Decision: ${decision.action}`);
      if (decision.reasoning) {
        console.log(`   Reasoning: ${decision.reasoning.substring(0, 60)}...`);
      }
    }, 30000); // 30 second timeout for decentralized compute
  } else {
    it('Live Jeju test skipped - no Jeju Compute configured', () => {
      console.log('\n⚠️  Live Jeju Compute test skipped');
      console.log('   Configure Jeju Compute to test:');
      console.log('   - JEJU_GATEWAY_URL');
      console.log('   - JEJU_COMPUTE_ENDPOINT');
      console.log('   Start Jeju with: cd /path/to/jeju && bun run dev\n');
      // Test skipped - no Jeju Compute configured
    });
  }
});
