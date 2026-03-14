import {
  type ActionResult,
  asUUID,
  type Evaluator,
  formatMessages,
  getEntityDetails,
  type IAgentRuntime,
  type Memory,
  ModelType,
} from '@elizaos/core';
import { v4 } from 'uuid';
import {
  type ConversationMemory,
  type ConversationMetadata,
  isConversationMemory,
  mergeMessageIds,
  mergeStringLists,
  toCsvArray,
  toStringSafe,
} from '../metadata.ts';
import { parseXml } from '../utils.ts';

type ParsedNode = Record<string, unknown>;

function asRecord(value: unknown): ParsedNode | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as ParsedNode;
  }
  return null;
}

function formatConversationCsv(conversations: ConversationMemory[]): string {
  const rows = conversations.map((conversation) => {
    const metadata = conversation.metadata;
    const id = conversation.id ?? '';
    const title = metadata.title ?? '';
    const summary = metadata.summary ?? '';
    const keywords = metadata.keywords?.join('; ') ?? '';
    return [id, title, summary, keywords].join(',');
  });
  if (rows.length === 0) {
    return '';
  }
  return `id,title,description,keywords\n${rows.join('\n')}\n`;
}

function getConversationDirective(parsed: ParsedNode): string {
  const candidates = [
    parsed.conservationIdOrNew,
    parsed.conversationIdOrNew,
    parsed.conversationId,
  ];
  for (const candidate of candidates) {
    const value = toStringSafe(candidate);
    if (value) {
      return value;
    }
  }
  return '';
}

function buildConversationMetadata(
  node: ParsedNode,
  messageId: string | undefined,
  existing?: ConversationMetadata
): ConversationMetadata {
  const keywords = mergeStringLists(
    existing?.keywords,
    toCsvArray(node.keywords)
  );
  const topics = mergeStringLists(existing?.topics, toCsvArray(node.topics));
  const participants = mergeStringLists(existing?.who, toCsvArray(node.who));
  const mergedMessageIds = mergeMessageIds(existing?.messageIds, [
    ...toCsvArray(node.messageIds),
    ...(messageId ? [messageId] : []),
  ]);

  const metadata: ConversationMetadata = {
    type: 'custom',
    neuroType: 'neuro:conversation',
    title: toStringSafe(node.title, existing?.title ?? ''),
    summary: toStringSafe(node.summary, existing?.summary ?? ''),
    result: toStringSafe(node.result, existing?.result ?? ''),
    keywords,
    topics,
    who: participants,
    messageIds:
      mergedMessageIds.length > 0 ? mergedMessageIds : existing?.messageIds,
  };

  return metadata;
}

function extractConversationNodes(root: ParsedNode | null): ParsedNode[] {
  if (!root) {
    return [];
  }

  const nodes: ParsedNode[] = [];
  const pushRecord = (value: unknown) => {
    const record = asRecord(value);
    if (record) {
      nodes.push(record);
    }
  };

  const conversations = root.conversations ?? root.conversation;

  if (Array.isArray(conversations)) {
    for (const item of conversations) {
      pushRecord(item);
    }
    return nodes;
  }

  const conversationRecord = asRecord(conversations);
  if (conversationRecord) {
    const nested = conversationRecord.conversation;
    if (Array.isArray(nested)) {
      for (const nestedItem of nested) {
        pushRecord(nestedItem);
      }
      return nodes;
    }
    if (nested) {
      pushRecord(nested);
      return nodes;
    }
    pushRecord(conversationRecord);
    return nodes;
  }

  pushRecord(root);
  return nodes;
}

export const conversationsEvaluator: Evaluator = {
  name: 'CONVERSATIONS',
  similes: [],
  validate: async (): Promise<boolean> => true,
  description: 'Build conversation tracking',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory
  ): Promise<ActionResult | undefined> => {
    const logger = runtime.logger.child({ namespace: 'neuro:conversations' });
    const { roomId } = message;

    const conversationLength = runtime.getConversationLength();
    const existingMemories = (
      await runtime.getMemories({
        tableName: 'conversations',
        roomId,
        unique: false,
      })
    ).filter(isConversationMemory);

    const entitiesData = await getEntityDetails({ runtime, roomId });
    logger.debug(
      { count: existingMemories.length },
      'Loaded existing neuro conversations'
    );

    if (existingMemories.length > 0) {
      const conversationCsv = formatConversationCsv(existingMemories);
      const formattedRecentMessages = await formatMessages({
        messages: [message],
        entities: entitiesData,
      });

      const conversationParserPrompt = `<task>Given the following messages, parse and organize them into conversation threads</task>

<conversations>
${conversationCsv}
</conversations>

<message>
${formattedRecentMessages}
</message>

<output>
Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the XML response format without any preamble or explanation.

Respond using XML format like this:
<response>
  <conversationIdOrNew>id of conversation it belongs to OR new</conversationIdOrNew>
  <reasoning>Your thought here</reasoning>
  <title>What you'd currently call this thread</title>
  <summary>what is the summary of this thread</summary>
  <topics>What are/is the topic(s)</topics>
  <who>Who's involved</who>
  <keywords>Best keywords for this conversation</keywords>
  <result>Take away from this thread so far</result>
</response>

IMPORTANT: Your response must ONLY contain the <response></response> XML block above. Do not include any text, thinking, or reasoning before or after this XML block. Start your response immediately with <response> and end with </response>.
</output>
`;

      const response = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: conversationParserPrompt,
      });
      logger.debug(
        { response },
        'Model response for neuro conversation routing'
      );

      const parsed = parseXml(response);
      const parsedRecord = asRecord(parsed);
      if (!parsedRecord) {
        logger.warn('Unable to parse conversation routing response');
        return;
      }

      const directive = getConversationDirective(parsedRecord);
      if (!directive) {
        logger.warn('Model response missing conversation directive');
        return;
      }

      if (directive.toLowerCase() === 'new') {
        const metadata = buildConversationMetadata(parsedRecord, message.id);
        const newMemory: ConversationMemory = {
          id: asUUID(v4()),
          entityId: runtime.agentId,
          agentId: runtime.agentId,
          content: {},
          roomId,
          createdAt: Date.now(),
          metadata,
        };
        await runtime.createMemory(newMemory, 'conversations');
        logger.info(
          { conversationId: newMemory.id },
          'Created new neuro conversation memory'
        );
        return;
      }

      const targetConversation = existingMemories.find(
        (conversation) => conversation.id === directive
      );
      if (!targetConversation || !targetConversation.id) {
        logger.warn(
          { directive },
          'Unable to match model directive to existing conversation'
        );
        return;
      }

      const updatedMetadata = buildConversationMetadata(
        parsedRecord,
        message.id,
        targetConversation.metadata
      );
      await runtime.updateMemory({
        id: targetConversation.id,
        metadata: updatedMetadata,
      });
      logger.debug(
        { conversationId: targetConversation.id },
        'Updated neuro conversation memory metadata'
      );
      return;
    }

    const recentMessagesData = await runtime.getMemories({
      tableName: 'messages',
      roomId,
      count: conversationLength,
      unique: false,
    });

    const dialogueMessages = recentMessagesData.filter(
      (msg) => msg.content?.type !== 'action_result'
    );

    const formattedRecentMessages = await formatMessages({
      messages: dialogueMessages,
      entities: entitiesData,
    });

    const conversationParserPrompt = `<task>Given the following messages, parse and organize them into conversation threads</task>

<messages>
${formattedRecentMessages}
</messages>

<output>
Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the XML response format without any preamble or explanation.

Respond using XML format like this:
<response>
    <conversations>
        <conversation>
            <reasoning>Your thought here</reasoning>
            <title>What you'd currently call this thread</title>
            <summary>what is the summary of this thread</summary>
            <topics>What are/is the topic(s)</topics>
            <who>Who's involved</who>
            <keywords>Best keywords for this conversation</keywords>
            <result>Take away from this thread so far</result>
            <messageIds>A comma separate list of message ids</messageIds>
        </conversation>
        <!-- Add more conversations as needed -->
    </conversations>
</response>

IMPORTANT: Your response must ONLY contain the <response></response> XML block above. Do not include any text, thinking, or reasoning before or after this XML block. Start your response immediately with <response> and end with </response>.
</output>
`;

    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt: conversationParserPrompt,
    });
    logger.debug(
      { response },
      'Model response for neuro conversation initialization'
    );

    const parsed = parseXml(response);
    const conversationNodes = extractConversationNodes(asRecord(parsed));

    if (conversationNodes.length === 0) {
      logger.warn('Model did not return any conversations to initialize');
      return;
    }

    for (const node of conversationNodes) {
      const metadata = buildConversationMetadata(node, message.id);
      const conversationMemory: ConversationMemory = {
        id: asUUID(v4()),
        entityId: runtime.agentId,
        agentId: runtime.agentId,
        content: {},
        roomId,
        createdAt: Date.now(),
        metadata,
      };
      await runtime.createMemory(conversationMemory, 'conversations');
      logger.info(
        { conversationId: conversationMemory.id },
        'Created neuro conversation memory from initialization'
      );
    }
  },
  examples: [],
};
