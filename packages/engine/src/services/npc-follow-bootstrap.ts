/**
 * NPC Follow Graph Bootstrap
 *
 * Seeds follow relationships between NPCs based on shared affiliations.
 * NPCs follow actors they share organizations with + actors they have
 * relationship records with. This ensures the relevance-filtered feed
 * shows posts from actors they'd actually care about.
 *
 * Run once during game bootstrap or on demand.
 */

import { actorFollows, db } from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';
import { StaticDataRegistry } from './static-data-registry';

export async function bootstrapNpcFollows(): Promise<number> {
  const allActors = StaticDataRegistry.getAllActors();
  const followPairs = new Set<string>();

  // Build follow pairs from shared affiliations
  for (const actor of allActors) {
    if (!actor.affiliations?.length) continue;

    for (const other of allActors) {
      if (other.id === actor.id) continue;
      if (!other.affiliations?.length) continue;

      const shared = actor.affiliations.some((a) =>
        other.affiliations!.includes(a)
      );
      if (shared) {
        // Canonical ordering to avoid duplicates
        const key =
          actor.id < other.id
            ? `${actor.id}:${other.id}`
            : `${other.id}:${actor.id}`;
        followPairs.add(key);
      }
    }
  }

  // Check existing follows to avoid duplicates
  const existing = await db
    .select({
      followerId: actorFollows.followerId,
      followingId: actorFollows.followingId,
    })
    .from(actorFollows);
  const existingSet = new Set(
    existing.map((f) => `${f.followerId}:${f.followingId}`)
  );

  // Insert new follows
  let created = 0;
  for (const pair of followPairs) {
    const [actor1, actor2] = pair.split(':');
    if (!actor1 || !actor2) continue;

    // Create mutual follows (A follows B + B follows A)
    for (const [follower, following] of [
      [actor1, actor2],
      [actor2, actor1],
    ]) {
      const key = `${follower}:${following}`;
      if (existingSet.has(key)) continue;

      try {
        await db.insert(actorFollows).values({
          id: await generateSnowflakeId(),
          followerId: follower!,
          followingId: following!,
          isMutual: true,
        });
        created++;
      } catch (_err) {
        // Ignore duplicate key errors
      }
    }
  }

  logger.info(
    'NPC follow graph bootstrapped',
    { totalPairs: followPairs.size, followsCreated: created },
    'NpcFollowBootstrap'
  );

  return created;
}
