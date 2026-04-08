/**
 * `GameOnboarding` CRUD / optimistic updates.
 *
 * **Why here:** Tutorial progress SQL stays under `asSystem` in one place; engine
 * owns step ordering, validation, and bonus-point side effects.
 */

import type { GameOnboardingStep } from '@babylon/shared';
import { and, eq } from 'drizzle-orm';
import { asSystem } from './db';
import type {
  GameOnboardingRow,
  GameOnboardingState,
} from './tables/game-onboarding';
import { gameOnboarding } from './tables/game-onboarding';

export async function getOrCreateGameOnboardingRow(params: {
  newRowId: string;
  userId: string;
  now: Date;
  initialState: GameOnboardingState;
}): Promise<{ row: GameOnboardingRow; wasCreated: boolean }> {
  const { newRowId, userId, now, initialState } = params;

  return asSystem(async (c) => {
    const insertResult = await c
      .insert(gameOnboarding)
      .values({
        id: newRowId,
        userId,
        currentStep: 'welcome',
        state: initialState,
        isComplete: false,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: gameOnboarding.userId })
      .returning({ insertedId: gameOnboarding.id });

    const [selected] = await c
      .select()
      .from(gameOnboarding)
      .where(eq(gameOnboarding.userId, userId))
      .limit(1);

    if (!selected) {
      throw new Error(`Failed to get or create onboarding for user ${userId}`);
    }

    return {
      row: selected,
      wasCreated: insertResult.length > 0,
    };
  }, 'game-onboarding-get-or-create');
}

export async function updateGameOnboardingIfUpdatedAtUnchanged(params: {
  userId: string;
  expectedUpdatedAt: Date;
  currentStep: GameOnboardingStep;
  state: GameOnboardingState;
  isComplete: boolean;
}): Promise<GameOnboardingRow[]> {
  const { userId, expectedUpdatedAt, currentStep, state, isComplete } = params;

  return asSystem(
    async (c) =>
      c
        .update(gameOnboarding)
        .set({
          currentStep,
          state,
          isComplete,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(gameOnboarding.userId, userId),
            eq(gameOnboarding.updatedAt, expectedUpdatedAt)
          )
        )
        .returning(),
    'game-onboarding-complete-step'
  );
}

export async function fetchGameOnboardingRowByUserId(
  userId: string
): Promise<GameOnboardingRow | null> {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(gameOnboarding)
      .where(eq(gameOnboarding.userId, userId))
      .limit(1);
    return row ?? null;
  }, 'game-onboarding-status');
}

export async function markGameOnboardingSkipped(userId: string): Promise<void> {
  await asSystem(
    async (c) =>
      c
        .update(gameOnboarding)
        .set({
          isComplete: true,
          skippedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(gameOnboarding.userId, userId)),
    'game-onboarding-skip'
  );
}

export type GameOnboardingNeedsSlice = {
  isComplete: boolean;
  skippedAt: Date | null;
};

export async function fetchGameOnboardingNeedsSlice(
  userId: string
): Promise<GameOnboardingNeedsSlice | null> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        isComplete: gameOnboarding.isComplete,
        skippedAt: gameOnboarding.skippedAt,
      })
      .from(gameOnboarding)
      .where(eq(gameOnboarding.userId, userId))
      .limit(1);
    return row ?? null;
  }, 'game-onboarding-needs-check');
}
