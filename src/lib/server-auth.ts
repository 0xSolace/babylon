/**
 * Server-side authentication utilities
 */

import { authenticate } from '@/lib/api/auth-middleware';
import type { NextRequest } from 'next/server';

export async function authenticateUser(req: NextRequest) {
  const authUser = await authenticate(req);
  return {
    id: authUser.userId,
    privyId: authUser.privyId,
    ...authUser,
  };
}
