/**
 * Response Session API
 *
 * @route PATCH /api/agents/team-chat/sessions/[sessionId] - Update session status
 * @access Authenticated (owner only)
 */

import { teamChatService } from '@babylon/agents';
import { authenticateUser } from '@babylon/api';
import { db, eq, responseSessions } from '@babylon/db';
import { logger } from '@babylon/shared';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Update a response session's status
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Authenticate request
  const user = await authenticateUser(req);

  try {
    const body = await req.json();
    const { status } = body as { status?: string };

    if (status !== 'complete') {
      return NextResponse.json(
        { error: 'Only status "complete" is supported' },
        { status: 400 }
      );
    }

    // Get user's team chat to verify ownership
    const teamChat = await teamChatService.getTeamChat(user.id);
    if (!teamChat) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the session
    const [session] = await db
      .select()
      .from(responseSessions)
      .where(eq(responseSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verify session belongs to user's team chat
    if (session.chatId !== teamChat.chatId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only update if currently processing
    if (session.status !== 'processing') {
      return NextResponse.json({ success: true, status: session.status });
    }

    // Update session status to complete
    await db
      .update(responseSessions)
      .set({
        status: 'complete',
        completedAt: new Date(),
      })
      .where(eq(responseSessions.id, sessionId));

    logger.info(
      'Response session marked complete',
      { sessionId, userId: user.id },
      'TeamChat'
    );

    return NextResponse.json({ success: true, status: 'complete' });
  } catch (err) {
    logger.error(
      'Failed to update response session',
      { sessionId, error: String(err) },
      'TeamChat'
    );
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
