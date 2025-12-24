import { useEffect } from 'react'
import { getApiBaseUrl, isBrowser, isStaticBuild } from '@/config'
import { setupGlobalFetch } from '@/lib/api-fetch'

/**
 * Patches window.fetch to rewrite /api/ URLs for static deployments
 */
export function ApiFetchProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only setup global fetch if we're in a static build or have a different API base URL
    if (
      isStaticBuild() ||
      (isBrowser() && getApiBaseUrl() !== window.location.origin)
    ) {
      setupGlobalFetch()
    }
  }, [])

  return <>{children}</>
}
