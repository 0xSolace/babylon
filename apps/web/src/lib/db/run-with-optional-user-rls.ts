import type { AuthenticatedUser } from '@babylon/api';
import type { DrizzleClient } from '@babylon/db';
import * as engineStorage from '@babylon/db/engine-storage';

/** Run a DB callback under `asUser` when authenticated, otherwise `asPublic`. */
export function runWithOptionalUserRls<T>(
  authUser: AuthenticatedUser | null | undefined,
  fn: (db: DrizzleClient) => Promise<T>
): Promise<T> {
  return authUser?.userId
    ? engineStorage.asUser(authUser, fn)
    : engineStorage.asPublic(fn);
}
