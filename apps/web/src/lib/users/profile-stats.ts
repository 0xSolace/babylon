import { cachedDb } from '@babylon/api';
import { logger } from '@babylon/shared';

export type OptionalProfileStats =
  | Awaited<ReturnType<typeof cachedDb.getUserProfileStats>>
  | undefined;

export async function getOptionalProfileStats(
  userId: string,
  context: string
): Promise<OptionalProfileStats> {
  try {
    const stats = await cachedDb.getUserProfileStats(userId);
    if (!stats) {
      logger.warn(
        'Profile stats unavailable; returning partial profile response',
        { userId },
        context
      );
      return undefined;
    }

    return stats;
  } catch (error) {
    logger.error(
      'Failed to fetch profile stats; returning partial profile response',
      {
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      context
    );
    return undefined;
  }
}
