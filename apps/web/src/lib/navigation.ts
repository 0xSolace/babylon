/**
 * Navigation utilities for React Router
 *
 * Provides drop-in replacements for Next.js navigation hooks
 */

import {
  useLocation,
  useNavigate,
  useSearchParams as useRouterSearchParams,
} from 'react-router-dom'

/**
 * Drop-in replacement for Next.js useRouter
 */
export function useRouter() {
  const navigate = useNavigate()
  const location = useLocation()

  return {
    push: (url: string) => navigate(url),
    replace: (url: string) => navigate(url, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => navigate(0),
    prefetch: () => {}, // No-op for React Router
    pathname: location.pathname,
  }
}

/**
 * Drop-in replacement for Next.js usePathname
 */
export function usePathname() {
  const location = useLocation()
  return location.pathname
}

/**
 * Drop-in replacement for Next.js useSearchParams
 * Returns just the URLSearchParams object (not a tuple like react-router-dom)
 */
export function useSearchParams() {
  const [searchParams] = useRouterSearchParams()
  return searchParams
}
