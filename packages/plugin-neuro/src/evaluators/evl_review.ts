import {
  type Action,
  type ActionResult,
  addHeader,
  asUUID,
  type Evaluator,
  formatActionNames,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type State,
} from '@elizaos/core';
import { v4 } from 'uuid';
import { toStringSafe } from '../metadata.ts';
import { asRecord, parseXml } from '../utils.ts';

export const reviewEvaluator: Evaluator = {
  name: 'REVIEW',
  similes: [],
  validate: async (
    runtime: IAgentRuntime,
    message: Memory
  ): Promise<boolean> => {
    // in DMs only? or with single person

    // ensure we have at least 2 messages

    // Parallelize initial data fetching operations including recentInteractions
    const { roomId } = message;
    const conversationLength = runtime.getConversationLength(); // defaults to 32
    const [
      recentMessagesData /* entitiesData, room, recentInteractionsData */,
    ] = await Promise.all([
      runtime.getMemories({
        tableName: 'messages',
        roomId,
        count: conversationLength,
        unique: false,
      }),
      /*
      getEntityDetails({ runtime, roomId }),
      runtime.getRoom(roomId),
      message.entityId !== runtime.agentId
        ? getRecentInteractions(runtime, message.entityId, runtime.agentId, roomId)
        : Promise.resolve([]),
      */
    ]);
    // what was the last message that was directed to me?
    //console.log('neuro:review:valid - recentMessagesData', recentMessagesData.length)

    if (recentMessagesData.length < 2) {
      //console.log('two messages ago', recentMessagesData[2]) // skip our response?
      //console.log('last message', recentMessagesData[0])
      runtime.logger.warn(
        { namespace: 'neuro:review' },
        'Not enough message history for review evaluation'
      );
    }

    // always evaluate task
    return recentMessagesData.length > 1;
  },
  description: 'How did we do on the last 2 messages',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<ActionResult | undefined> => {
    const logger = runtime.logger.child({ namespace: 'neuro:review' });
    logger.debug('Starting review evaluator');
    // figure out what the tasks is
    const { roomId } = message;
    const conversationLength = runtime.getConversationLength(); // defaults to 32
    const recentMessagesData = await runtime.getMemories({
      tableName: 'messages',
      roomId,
      count: conversationLength,
      unique: false,
    });
    // get last message we sent
    const dialogueMessages = recentMessagesData.filter(
      (msg) => msg.content?.type !== 'action_result'
    );

    const actionResultMessages = recentMessagesData.filter(
      (msg) => msg.content?.type === 'action_result'
    );
    let actionResultsText = '';
    if (actionResultMessages.length > 0) {
      // Group by runId using Map
      const groupedByRun = new Map<string, Memory[]>();

      for (const mem of actionResultMessages) {
        const runId: string = String(mem.content?.runId || 'unknown');
        if (!groupedByRun.has(runId)) {
          groupedByRun.set(runId, []);
        }
        const memories = groupedByRun.get(runId);
        if (memories) {
          memories.push(mem);
        }
      }

      const formattedActionResults = Array.from(groupedByRun.entries())
        .slice(-3) // Show last 3 runs
        .map(([runId, memories]) => {
          const sortedMemories = memories.sort(
            (a: Memory, b: Memory) => (a.createdAt || 0) - (b.createdAt || 0)
          );

          const thought = sortedMemories[0]?.content?.planThought || '';
          const runText = sortedMemories
            .map((mem: Memory) => {
              const actionName = mem.content?.actionName || 'Unknown';
              const status = mem.content?.actionStatus || 'unknown';
              const planStep = mem.content?.planStep || '';
              const text = mem.content?.text || '';
              const error = mem.content?.error || '';

              let memText = `  - ${actionName} (${status})`;
              if (planStep) memText += ` [${planStep}]`;
              if (error) {
                memText += `: Error - ${error}`;
              } else if (text && text !== `Executed action: ${actionName}`) {
                memText += `: ${text}`;
              }

              return memText;
            })
            .join('\n');

          return `**Action Run ${runId.slice(0, 8)}**${thought ? ` - "${thought}"` : ''}\n${runText}`;
        })
        .join('\n\n');

      actionResultsText = formattedActionResults
        ? addHeader('# Recent Action Executions', formattedActionResults)
        : '';
    }
    // but what's our discord name?
    //const ourLastByName = dialogueMessages.find(m => m.metadata?.entityName === runtime.character.name)

    /*
    const task = dialogueMessages[2]
    const reply = dialogueMessages[1]
    // how do we know if our reply is related? metadata
    console.log('task', task)
    console.log('reply', reply)
    */
    // ensure reply/ies are related to task

    // entityId, agentId?
    const mine = dialogueMessages.filter((m) => m.entityId === runtime.agentId);
    if (mine.length === 0) {
      logger.debug('No prior agent messages available for review evaluation');
      return;
    }

    const ourLast = mine[0]; // will always be to the current msg since we're an eval
    logger.debug({ ourLast }, 'Last agent message in dialogue');
    if (!ourLast?.content) {
      logger.warn(
        'Last agent message is missing content; skipping review evaluation'
      );
      return;
    }

    const our2ndLast = mine[1];
    logger.debug({ our2ndLast }, 'Second to last agent message in dialogue');

    // first check the last, make sure it's not the current
    let useLast = ourLast;
    if (ourLast.content.inReplyTo === message.id) {
      if (!our2ndLast?.content) {
        logger.debug(
          'Second to last agent message missing or without content; skipping review evaluation'
        );
        return;
      }
      useLast = our2ndLast;
    }
    logger.debug({ useLast }, 'Using message for review evaluation');

    const replyTargetId = useLast.content?.inReplyTo;
    if (!replyTargetId) {
      logger.debug(
        'No inReplyTo reference on selected agent message; skipping review evaluation'
      );
      return;
    }

    const request = dialogueMessages.find((m) => m.id === replyTargetId);
    // and in theory, the current message is from request.entityId
    // if the request just came in, it's not the request we want
    if (
      request &&
      message.entityId === request.entityId &&
      request.id !== message.id
    ) {
      // got a response to our response
      logger.debug({ request: request.content.text }, 'Original user request');
      logger.debug(
        { reply: useLast.content.text },
        'Agent reply being evaluated'
      );
      // doesn't seem to be recent, just
      logger.debug(
        { response: message.content.text },
        'User response to review'
      );
      // how did we do?

      // build prompt

      // get data
      // - is task complete
      // - did we get a good enough result (maybe grade it with a letter A,B,C,D,F and can be tuned)
      // if we got a bad grade
      //   - how could we break this task into smaller prompts
      //   - goal of this step
      //   - what providers could we called to get more information
      //   - what actions could we call to try to complete this task

      // Get actions that validate for this message
      const actionPromises = runtime.actions.map(async (action: Action) => {
        try {
          const result = await action.validate(runtime, message, state);
          if (result) {
            return action;
          }
        } catch (e) {
          logger.error(
            { actionName: action.name, error: e },
            'Action validation failed during review evaluation'
          );
        }
        return null;
      });

      const resolvedActions = await Promise.all(actionPromises);

      const actionsData = resolvedActions.filter(Boolean) as Action[];

      // Format action-related texts
      const actionNames = `Possible response actions: ${formatActionNames(actionsData)}`;

      const dynamicProviders = runtime.providers.filter(
        (provider) => provider.dynamic === true
      );

      const evalPrompt = `<task>Given the following messages, evaluate how do did on a UserRequest.</task>

<UserRequest>
${request.content.text}
</UserRequest>
<ourReply>
${useLast.content.text}
</ourReply>
<UserResponse>
${message.content.text}
</UserResponse>

<actionResults>
${actionResultsText}
</actionResults>

<availableProviders>
${dynamicProviders.map((p) => p.name + ': ' + p.description).join('\n')}
</availableProviders>
<availableActions>
${actionNames}
</availableActions>

<output>
Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the XML response format without any preamble or explanation.

Respond using XML format like this:
<response>
  <reasoning>Your thought here</reasoning>
  <userRequestFullyAddress>true or false</userRequestFullyAddress>
  <replyGrade>Grade our reply with A, B, C, D or F grade letter</replyGrade>
  <properlyEquiped>true or false: Did we have all the available tools to complete the task </properlyEquiped>
  <!-- How might we breakdown the tasks into elizaOS specific steps to improve our grade. Be economical (only call a provider once) but thorough (retrying everything has an even greater cost) -->
  <taskBreakdown>
    <step>
      <goal>goal of this step</goal>
      <providers>what providers could we call to get more information</providers>
      <actions>what actions could we call to try to complete this task</actions>
    </step>
    <!-- Add more steps as needed -->
  <taskBreakdown>
</response>

IMPORTANT: Your response must ONLY contain the <response></response> XML block above. Do not include any text, thinking, or reasoning before or after this XML block. Start your response immediately with <response> and end with </response>.
</output>
`;
      const response = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: evalPrompt,
      });
      logger.debug({ response }, 'Model response for review evaluation');
      const parsedXml = parseXml(response);
      const parsed = asRecord(parsedXml);
      logger.debug({ parsed }, 'Parsed review evaluation XML');

      // Save review results for metacognition
      if (parsed) {
        const grade = toStringSafe(parsed.replyGrade, 'C').toUpperCase();
        const addressed =
          parsed.userRequestFullyAddress === true ||
          parsed.userRequestFullyAddress === 'true';
        const equipped =
          parsed.properlyEquiped === true || parsed.properlyEquiped === 'true';

        // Extract task breakdown steps
        const breakdownNode = asRecord(parsed.taskBreakdown);
        let taskBreakdown: string[] = [];
        if (breakdownNode) {
          const steps = breakdownNode.step;
          if (Array.isArray(steps)) {
            taskBreakdown = steps
              .map((step: unknown) => {
                const s = asRecord(step);
                if (s) {
                  return `${toStringSafe(s.goal)}: providers=${toStringSafe(s.providers)}, actions=${toStringSafe(s.actions)}`;
                }
                return '';
              })
              .filter(Boolean);
          } else if (steps) {
            const s = asRecord(steps);
            if (s) {
              taskBreakdown = [
                `${toStringSafe(s.goal)}: providers=${toStringSafe(s.providers)}, actions=${toStringSafe(s.actions)}`,
              ];
            }
          }
        }

        // Create review memory for metacognition to consume
        const reviewMemory: Memory = {
          id: asUUID(v4()),
          entityId: runtime.agentId,
          agentId: runtime.agentId,
          content: {},
          roomId,
          createdAt: Date.now(),
          metadata: {
            type: 'custom',
            neuroType: 'neuro:review',
            requestText: request.content.text || '',
            replyText: useLast.content.text || '',
            responseText: message.content.text || '',
            grade,
            userRequestFullyAddressed: addressed,
            properlyEquipped: equipped,
            reasoning: toStringSafe(parsed.reasoning),
            taskBreakdown,
            requestMessageId: request.id || '',
            replyMessageId: useLast.id || '',
            responseMessageId: message.id || '',
          },
        };

        await runtime.createMemory(reviewMemory, 'reviews');
        logger.info(
          {
            grade,
            addressed,
            equipped,
            reviewId: reviewMemory.id,
          },
          'Saved review for metacognition'
        );
      }
    } else {
      if (request) {
        if (request.id === message.id) {
          // we'll evaluate this request later?
          // question answer, and some how we already have a reply?
          // we need their response to the reply
        } else {
          // ignore it I guess for now
          logger.debug('Response not relevant to last user request');
        }
      } else {
        //console.log('no request found')
      }
    }
  },
  examples: [],
};
