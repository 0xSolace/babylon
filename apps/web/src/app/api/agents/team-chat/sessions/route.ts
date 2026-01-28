/**
 * Team Chat Sessions API
 *
 * @route GET /api/agents/team-chat/sessions - Get response sessions for team chat
 * @access Authenticated
 *
 * @description
 * Fetches response sessions for the user's Command Center team chat.
 * Each session groups agent responses to a single user message.
 *
 * @openapi
 * /api/agents/team-chat/sessions:
 *   get:
 *     tags:
 *       - Agents
 *     summary: Get response sessions
 *     description: |
 *       Returns response sessions for the Command Center with their agent responses.
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of sessions to return
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Sessions fetched successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No team chat exists
 */

import { teamChatService } from '@babylon/agents';
import { authenticateUser } from '@babylon/api';
import { db, desc, eq, messages, responseSessions } from '@babylon/db';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await authenticateUser(req);

  // Get query parameters
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

  // Get user's team chat
  const teamChat = await teamChatService.getTeamChat(user.id);

  if (!teamChat) {
    return NextResponse.json(
      {
        success: false,
        error: 'No team chat exists',
        message: 'Create your first agent to initialize your Command Center.',
      },
      { status: 404 }
    );
  }

  // Fetch recent response sessions for this chat
  const sessions = await db
    .select()
    .from(responseSessions)
    .where(eq(responseSessions.chatId, teamChat.chatId))
    .orderBy(desc(responseSessions.createdAt))
    .limit(limit);

  // Fetch agent responses for each session
  const sessionsWithResponses = await Promise.all(
    sessions.map(async (session) => {
      const responses = await db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          content: messages.content,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.responseSessionId, session.id));

      return {
        id: session.id,
        chatId: session.chatId,
        userMessageId: session.userMessageId,
        expectedAgentIds: session.expectedAgentIds,
        status: session.status,
        summary: session.summary,
        createdAt: session.createdAt?.toISOString() || null,
        completedAt: session.completedAt?.toISOString() || null,
        responses: responses.map((r) => ({
          messageId: r.id,
          agentId: r.senderId,
          content: r.content,
          createdAt: r.createdAt?.toISOString() || null,
        })),
      };
    })
  );

  return NextResponse.json({
    success: true,
    sessions: sessionsWithResponses,
  });
}
