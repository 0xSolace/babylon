'use client';

import { useEffect } from 'react';
import { setupGlobalFetch } from '@/lib/api-fetch';

/**
 * Patches window.fetch to rewrite /api/ URLs for static deployments
 */
export function ApiFetchProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (
      process.env.NEXT_PUBLIC_STATIC_BUILD === 'true' ||
      process.env.NEXT_PUBLIC_API_BASE_URL
    ) {
      setupGlobalFetch();
    }
  }, []);

  return <>{children}</>;
}
