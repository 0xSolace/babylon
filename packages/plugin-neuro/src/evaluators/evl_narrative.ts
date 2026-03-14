import {
  type ActionResult,
  asUUID,
  composePromptFromState,
  type Evaluator,
  formatMessages,
  getEntityDetails,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type State,
} from '@elizaos/core';
import { v4 } from 'uuid';
import {
  isNarrativeMemory,
  mergeMessageIds,
  mergeStringLists,
  type NarrativeMemory,
  type NarrativeMetadata,
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

function formatNarrativeSummary(narratives: NarrativeMemory[]): string {
  if (narratives.length === 0) {
    return 'None';
  }

  return narratives
    .map((narrative) => {
      const { metadata } = narrative;
      const title = metadata.title ?? 'Untitled';
      const summary = metadata.summary ?? '';
      return `- ${title}: ${summary}`;
    })
    .join('\n');
}

function buildNarrativeMetadata(
  node: ParsedNode,
  messageId: string | undefined
): NarrativeMetadata {
  const keywords = mergeStringLists(undefined, toCsvArray(node.keywords));
  const topics = mergeStringLists(undefined, toCsvArray(node.topics));
  const participants = mergeStringLists(undefined, toCsvArray(node.who));
  const mergedMessageIds = mergeMessageIds(undefined, [
    ...toCsvArray(node.messageIds),
    ...(messageId ? [messageId] : []),
  ]);

  const metadata: NarrativeMetadata = {
    type: 'custom',
    neuroType: 'neuro:narrative',
    title: toStringSafe(node.title, 'Untitled Narrative'),
    summary: toStringSafe(node.summary),
    details: toStringSafe(node.details),
    intent: toStringSafe(node.intent),
    motivation: toStringSafe(node.motivation),
    result: toStringSafe(node.result),
    keywords,
    topics,
    who: participants,
    messageIds: mergedMessageIds.length > 0 ? mergedMessageIds : undefined,
  };

  return metadata;
}

function extractNarrativeNodes(root: ParsedNode | null): ParsedNode[] {
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

  const narratives = root.narratives ?? root.narrative;

  if (Array.isArray(narratives)) {
    for (const item of narratives) {
      pushRecord(item);
    }
    return nodes;
  }

  const narrativeRecord = asRecord(narratives);
  if (narrativeRecord) {
    const nested = narrativeRecord.narrative;
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
    pushRecord(narrativeRecord);
    return nodes;
  }

  pushRecord(root);
  return nodes;
}

function ensureState(state?: State): State {
  return state ?? { values: {}, data: {}, text: '' };
}

export const narrativeEvaluator: Evaluator = {
  name: 'NARRATIVE_GENERATE',
  similes: [],
  validate: async (): Promise<boolean> => true,
  description: 'Craft stories',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<ActionResult | undefined> => {
    const logger = runtime.logger.child({ namespace: 'neuro:narrative' });
    const { roomId } = message;

    const conversationLength = runtime.getConversationLength();
    const existingNarratives = (
      await runtime.getMemories({
        tableName: 'narratives',
        unique: false,
      })
    ).filter(isNarrativeMemory);

    const entitiesData = await getEntityDetails({ runtime, roomId });
    logger.debug(
      { count: existingNarratives.length },
      'Loaded existing narratives'
    );

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

    const promptTemplate = `<task>Given the following messages, evaluate whether any coherent narratives are emerging. Narratives should capture intent, motivation, and key outcomes.</task>

<existingNarratives>
${formatNarrativeSummary(existingNarratives)}
</existingNarratives>

<messages>
${formattedRecentMessages}
</messages>
<otherData>
{{providers}}
</otherData>

<output>
Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the XML response format without any preamble or explanation.

Respond using XML format like this:
<response>
    <narratives>
        <!-- Ok to return none -->
        <narrative>
            <reasoning>Your thought here</reasoning>
            <title>What you'd currently call this narrative</title>
            <details>detailed explanation of narrative</details>
            <intent>Intent of narrative</intent>
            <motivation>Why this narrative</motivation>
            <summary>what is the summary of this narrative</summary>
            <topics>What are/is the topic(s)</topics>
            <who>Who's involved</who>
            <keywords>Best keywords for this narrative</keywords>
            <result>Take away from this narrative so far</result>
            <messageIds>A comma separate list of message ids</messageIds>
        </narrative>
        <!-- Add more narratives as needed -->
    </narratives>
</response>

IMPORTANT: Your response must ONLY contain the <response></response> XML block above. Do not include any text, thinking, or reasoning before or after this XML block. Start your response immediately with <response> and end with </response>.
</output>
`;

    const promptWithState = composePromptFromState({
      state: ensureState(state),
      template: promptTemplate,
    });

    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt: promptWithState,
    });
    logger.debug({ response }, 'Model response for narrative generation');

    const parsed = parseXml(response);
    const narrativeNodes = extractNarrativeNodes(asRecord(parsed));

    if (narrativeNodes.length === 0) {
      logger.info('Model did not produce any narratives');
      return;
    }

    const existingTitles = new Set(
      existingNarratives.map((narrative) =>
        (narrative.metadata.title ?? '').toLowerCase()
      )
    );

    for (const node of narrativeNodes) {
      const metadata = buildNarrativeMetadata(node, message.id);
      const titleKey = (metadata.title ?? '').toLowerCase();
      if (titleKey && existingTitles.has(titleKey)) {
        logger.debug(
          { title: metadata.title },
          'Skipping narrative because title already exists'
        );
        continue;
      }

      const narrativeMemory: NarrativeMemory = {
        id: asUUID(v4()),
        entityId: runtime.agentId,
        agentId: runtime.agentId,
        content: {},
        roomId,
        createdAt: Date.now(),
        metadata,
      };
      await runtime.createMemory(narrativeMemory, 'narratives');
      logger.info(
        { narrativeId: narrativeMemory.id },
        'Created new narrative memory'
      );
    }
  },
  examples: [],
};
