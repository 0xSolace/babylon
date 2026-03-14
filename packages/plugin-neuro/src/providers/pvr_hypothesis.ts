import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { isHypothesisMemory, toNumber, toStringSafe } from '../metadata.ts';

export const hypothesisProvider: Provider = {
  name: 'THINGS_TO_TEST',
  description: 'Provides information on active hypotheses and their status',
  dynamic: true,
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const logger = runtime.logger.child({
      namespace: 'neuro:provider:hypotheses',
    });

    const hypotheses = (
      await runtime.getMemories({
        tableName: 'hypotheses',
        unique: false,
      })
    ).filter(isHypothesisMemory);

    if (hypotheses.length === 0) {
      return {
        data: { hypothesisCount: 0 },
        values: {},
        text: 'No active hypotheses tracked.\n',
      };
    }

    const lines = hypotheses.map((hypothesis) => {
      const { metadata } = hypothesis;
      const title = toStringSafe(metadata.title, 'Untitled hypothesis');
      const summary = toStringSafe(metadata.summary, 'No summary available');
      const priority = toNumber(metadata.priority);
      const tests = (metadata.tests ?? []).join('; ');
      const disprove = (metadata.disprove ?? []).join('; ');
      const learn = (metadata.learn ?? []).join('; ');
      const keywords = (metadata.keywords ?? []).join('; ');

      return `${title}${priority ? ` (priority ${priority})` : ''}\nSummary: ${summary}${
        tests ? `\nTests: ${tests}` : ''
      }${disprove ? `\nDisprove: ${disprove}` : ''}${learn ? `\nLearnings: ${learn}` : ''}${
        keywords ? `\nKeywords: ${keywords}` : ''
      }\n`;
    });

    const text = ['# Agent hypotheses', ...lines].join('\n');

    logger.debug(
      { hypothesisCount: hypotheses.length },
      'Provided hypothesis summary'
    );

    return {
      data: { hypothesisCount: hypotheses.length },
      values: {},
      text,
    };
  },
};
