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
  type HypothesisMemory,
  type HypothesisMetadata,
  isHypothesisMemory,
  mergeMessageIds,
  mergeStringLists,
  toCsvArray,
  toNumber,
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

function formatHypothesisCsv(hypotheses: HypothesisMemory[]): string {
  const rows = hypotheses.map((hypothesis) => {
    const metadata = hypothesis.metadata;
    const id = hypothesis.id ?? '';
    const priority = metadata.priority ?? '';
    const title = metadata.title ?? '';
    const summary = metadata.summary ?? '';
    const keywords = metadata.keywords?.join('; ') ?? '';
    const tests = metadata.tests?.join('; ') ?? '';
    const disprove = metadata.disprove?.join('; ') ?? '';
    const learn = metadata.learn?.join('; ') ?? '';
    return [
      id,
      priority,
      title,
      summary,
      keywords,
      tests,
      disprove,
      learn,
    ].join(',');
  });

  if (rows.length === 0) {
    return '';
  }

  return `id,priority,title,description,keywords,tests,disproval,learn\n${rows.join('\n')}\n`;
}

function buildHypothesisMetadata(
  node: ParsedNode,
  messageId: string | undefined,
  existing?: HypothesisMetadata
): HypothesisMetadata {
  const keywords = mergeStringLists(
    existing?.keywords,
    toCsvArray(node.keywords)
  );
  const topics = mergeStringLists(existing?.topics, toCsvArray(node.topics));
  const participants = mergeStringLists(existing?.who, toCsvArray(node.who));
  const tests = mergeStringLists(existing?.tests, toCsvArray(node.tests));
  const disprove = mergeStringLists(
    existing?.disprove,
    toCsvArray(node.disprove)
  );
  const learn = mergeStringLists(existing?.learn, toCsvArray(node.learn));
  const context = mergeStringLists(existing?.context, toCsvArray(node.context));
  const narratives = mergeStringLists(
    existing?.narratives,
    toCsvArray(node.narratives)
  );
  const mergedMessageIds = mergeMessageIds(existing?.messageIds, [
    ...toCsvArray(node.messageIds),
    ...(messageId ? [messageId] : []),
  ]);

  const metadata: HypothesisMetadata = {
    type: 'custom',
    neuroType: 'neuro:hypothesis',
    title: toStringSafe(node.title, existing?.title ?? ''),
    summary: toStringSafe(node.summary, existing?.summary ?? ''),
    detail: toStringSafe(
      node.detail,
      existing?.detail ?? existing?.summary ?? ''
    ),
    result: toStringSafe(node.result, existing?.result ?? ''),
    keywords,
    topics,
    who: participants,
    tests,
    disprove,
    learn,
    context,
    narratives,
    priority: toNumber(node.priority, existing?.priority),
    daysAllocated: toNumber(node.daysAllocated, existing?.daysAllocated),
    messageIds:
      mergedMessageIds.length > 0 ? mergedMessageIds : existing?.messageIds,
  };

  return metadata;
}

function extractHypothesisNodes(root: ParsedNode | null): ParsedNode[] {
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

  const hypotheses = root.hypotheses ?? root.hypothesis;

  if (Array.isArray(hypotheses)) {
    for (const item of hypotheses) {
      pushRecord(item);
    }
    return nodes;
  }

  const hypothesisRecord = asRecord(hypotheses);
  if (hypothesisRecord) {
    const nested = hypothesisRecord.hypothesis;
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
    pushRecord(hypothesisRecord);
    return nodes;
  }

  pushRecord(root);
  return nodes;
}

function parseDirectiveList(value: unknown): string[] {
  return toCsvArray(value)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function ensureState(state?: State): State {
  return state ?? { values: {}, data: {}, text: '' };
}

export const hypothesisEvaluator: Evaluator = {
  name: 'HYPOTHESIS_GENERATE',
  similes: [],
  validate: async (): Promise<boolean> => true,
  description: 'Make bets',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<ActionResult | undefined> => {
    const logger = runtime.logger.child({ namespace: 'neuro:hypothesis' });
    const { roomId } = message;

    const conversationLength = runtime.getConversationLength();
    const hypothesisMemories = (
      await runtime.getMemories({
        tableName: 'hypotheses',
        unique: false,
      })
    ).filter(isHypothesisMemory);

    const entitiesData = await getEntityDetails({ runtime, roomId });
    logger.debug(
      { count: hypothesisMemories.length },
      'Loaded existing hypothesis memories'
    );

    if (hypothesisMemories.length > 0) {
      const hypothesisCsv = formatHypothesisCsv(hypothesisMemories);

      const formattedRecentMessages = await formatMessages({
        messages: [message],
        entities: entitiesData,
      });

      const promptTemplate = `<task>Given the following messages, see if you can make a prediction. Predictions are costly, make sure it has value.</task>

<hypotheses>
${hypothesisCsv}
</hypotheses>

<messages>
${formattedRecentMessages}
</messages>

<output>
Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the XML response format without any preamble or explanation.

Respond using XML format like this:
<response>
  <hypothesisIdOrNew>comma separated list of ids of hypothesis belongs to, OR new, OR NONE</hypothesisIdOrNew>
  <reasoning>Your thought here</reasoning>
  <title>What you'd currently call this hypothesis</title>
  <detail>detailed explanation of hypothesis</detail>
  <summary>what is the summary of this hypothesis</summary>
  <tests>How do we test this</tests>
  <disprove>How do we disprove this</disprove>
  <learn>what will we learn by testing this</learn>
  <priority>1-100 of how important it is</priority>
  <daysAllocated>Days allocated to test</daysAllocated>
  <topics>What are/is the topic(s)</topics>
  <who>Who's involved</who>
  <keywords>Best keywords for this hypothesis</keywords>
  <result>Take away from this hypothesis so far</result>
  <context>A comma separate list of related source, room and message ids</context>
  <narratives>What narrative could these results build/support</narratives>
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
      logger.debug({ response }, 'Model response for hypothesis evaluation');

      const parsed = parseXml(response);
      const parsedRecord = asRecord(parsed);
      if (!parsedRecord) {
        logger.warn('Unable to parse hypothesis response');
        return;
      }

      const directiveList = parseDirectiveList(parsedRecord.hypothesisIdOrNew);
      if (directiveList.length === 0) {
        logger.warn('Model response missing hypothesis directive');
        return;
      }

      const primaryDirective = directiveList[0].toLowerCase();
      if (primaryDirective === 'none') {
        logger.info('Model chose not to create or update any hypothesis');
        return;
      }

      if (primaryDirective === 'new') {
        const metadata = buildHypothesisMetadata(parsedRecord, message.id);
        const hypothesisMemory: HypothesisMemory = {
          id: asUUID(v4()),
          entityId: runtime.agentId,
          agentId: runtime.agentId,
          content: {},
          roomId,
          createdAt: Date.now(),
          metadata,
        };
        await runtime.createMemory(hypothesisMemory, 'hypotheses');
        logger.info(
          { hypothesisId: hypothesisMemory.id },
          'Created new hypothesis memory'
        );
        return;
      }

      const matchingHypothesis = hypothesisMemories.find(
        (hypothesis) => hypothesis.id === directiveList[0]
      );
      if (!matchingHypothesis || !matchingHypothesis.id) {
        logger.warn(
          { directive: directiveList[0] },
          'Unable to match hypothesis directive to existing memory'
        );
        return;
      }

      const updatedMetadata = buildHypothesisMetadata(
        parsedRecord,
        message.id,
        matchingHypothesis.metadata
      );
      await runtime.updateMemory({
        id: matchingHypothesis.id,
        metadata: updatedMetadata,
      });
      logger.debug(
        { hypothesisId: matchingHypothesis.id },
        'Updated hypothesis memory metadata'
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

    const promptTemplate = `<task>Given the following messages, see if you can make 0 or more predictions. Predictions are costly to test, make sure it has value.</task>

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
    <hypotheses>
        <!-- Ok to return none -->
        <hypothesis>
            <reasoning>Your thought here</reasoning>
            <title>What you'd currently call this hypothesis</title>
            <detail>detailed explanation of hypothesis</detail>
            <summary>what is the summary of this hypothesis</summary>
            <tests>How do we test this</tests>
            <disprove>How do we disprove this</disprove>
            <learn>what will we learn by testing this</learn>
            <priority>1-100 of how important it is</priority>
            <daysAllocated>Days allocated to test</daysAllocated>
            <topics>What are/is the topic(s)</topics>
            <who>Who's involved</who>
            <keywords>Best keywords for this hypothesis</keywords>
            <result>Take away from this hypothesis so far</result>
            <context>A comma separate list of related source, room and message ids</context>
            <narratives>What narrative could these results build/support</narratives>
        </hypothesis>
        <!-- Add more hypotheses as needed -->
    </hypotheses>
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
    logger.debug({ response }, 'Model response for hypothesis initialization');

    const parsed = parseXml(response);
    const hypothesisNodes = extractHypothesisNodes(asRecord(parsed));

    if (hypothesisNodes.length === 0) {
      logger.warn('Model did not return any hypotheses to create');
      return;
    }

    for (const node of hypothesisNodes) {
      const metadata = buildHypothesisMetadata(node, message.id);
      const hypothesisMemory: HypothesisMemory = {
        id: asUUID(v4()),
        entityId: runtime.agentId,
        agentId: runtime.agentId,
        content: {},
        roomId,
        createdAt: Date.now(),
        metadata,
      };
      await runtime.createMemory(hypothesisMemory, 'hypotheses');
      logger.info(
        { hypothesisId: hypothesisMemory.id },
        'Created hypothesis memory during initialization'
      );
    }
  },
  examples: [],
};
