import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { isConversationMemory, toStringSafe } from '../metadata.ts';

export const convoProvider: Provider = {
  name: 'CONVERSATIONS',
  description: 'Provides takeaways from conversations in the current room',
  dynamic: true,
  get: async (runtime: IAgentRuntime, message: Memory, _state: State) => {
    const logger = runtime.logger.child({
      namespace: 'neuro:provider:conversations',
    });
    const { roomId } = message;

    const conversations = (
      await runtime.getMemories({
        tableName: 'conversations',
        roomId,
        unique: false,
      })
    ).filter(isConversationMemory);

    if (conversations.length === 0) {
      return {
        data: { conversationCount: 0 },
        values: {},
        text: 'No tracked conversations for this room.\n',
      };
    }

    const lines = conversations.map((conversation) => {
      const metadata = conversation.metadata;
      const title = toStringSafe(metadata.title, 'Untitled conversation');
      const summary = toStringSafe(metadata.summary, 'No summary available');
      const result = toStringSafe(metadata.result);
      const keywords = (metadata.keywords ?? []).join('; ');
      return `${title} — ${summary}${result ? ` | Result: ${result}` : ''}${keywords ? ` | Keywords: ${keywords}` : ''}`;
    });

    const text = ['# Agent conversations', ...lines].join('\n') + '\n';

    logger.debug(
      { conversationCount: conversations.length },
      'Provided conversation summary'
    );

    return {
      data: { conversationCount: conversations.length },
      values: {},
      text,
    };
  },
};
