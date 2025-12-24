import { Suspense, useEffect } from 'react'
import { ComingSoon } from '@/components/shared/ComingSoon'
import { Skeleton } from '@/components/shared/Skeleton'
import { isWaitlistMode } from '@/config'
import { useAuth } from '@/hooks/useAuth'
import { useLoginModal } from '@/hooks/useLoginModal'
import { useRouter, useSearchParams } from '@/lib/navigation'

function HomePageContent() {
  const router = useRouter()
  const { authenticated } = useAuth()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Skip redirect logic if waitlist mode is enabled
    if (isWaitlistMode()) {
      return
    }

    // Show login modal if not authenticated
    // Use getState() to avoid subscription-based re-renders that cause infinite loops
    if (!authenticated) {
      useLoginModal.getState().showLoginModal({
        title: 'Welcome to Babylon',
        message:
          'Log in to start trading prediction markets, replying to NPCs, and earning rewards in this satirical game.',
      })
    }

    // Redirect to feed, preserving referral code if present
    const ref = searchParams.get('ref')
    const feedUrl = ref ? `/feed?ref=${ref}` : '/feed'
    router.push(feedUrl)
  }, [authenticated, router, searchParams])

  // Show coming soon page if waitlist mode is enabled
  if (isWaitlistMode()) {
    return <ComingSoon />
  }

  // Show loading while redirecting to feed
  return (
    <div className="flex h-full items-center justify-center">
      <div className="space-y-3">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="space-y-3">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  )
}
