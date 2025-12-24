/**
 * Main App component for Babylon Web
 *
 * React Router based SPA with lazy loaded routes.
 */

import { lazy, Suspense } from 'react'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { FeedAuthBanner } from '@/components/auth/FeedAuthBanner'
import { GlobalLoginModal } from '@/components/auth/GlobalLoginModal'
// Core providers and layout components (not lazy - needed immediately)
import { Providers } from '@/components/providers/Providers'
import { BottomNav } from '@/components/shared/BottomNav'
import { MobileHeader } from '@/components/shared/MobileHeader'
import { Sidebar } from '@/components/shared/Sidebar'

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-primary border-t-2 border-b-2" />
    </div>
  )
}

// Lazy load all page components
const HomePage = lazy(() => import('@/app/page'))
const FeedPage = lazy(() => import('@/app/feed/page'))
const NotificationsPage = lazy(() => import('@/app/notifications/page'))
const LeaderboardPage = lazy(() => import('@/app/leaderboard/page'))
const MarketsPage = lazy(() => import('@/app/markets/page'))
const PredictionDetailPage = lazy(
  () => import('@/app/markets/predictions/[[...id]]/page'),
)
const PerpsDetailPage = lazy(
  () => import('@/app/markets/perps/[[...ticker]]/page'),
)
const ChatsPage = lazy(() => import('@/app/chats/page'))
const AgentsPage = lazy(() => import('@/app/agents/page'))
const AgentCreatePage = lazy(() => import('@/app/agents/create/page'))
const AgentDetailPage = lazy(() => import('@/app/agents/[agentId]/page'))
const ProfilePage = lazy(() => import('@/app/profile/page'))
const ProfileDetailPage = lazy(() => import('@/app/profile/[id]/page'))
const DaoPage = lazy(() => import('@/app/dao/page'))
const RewardsPage = lazy(() => import('@/app/rewards/page'))
const AdminPage = lazy(() => import('@/app/admin/page'))
const AdminGroupsPage = lazy(() => import('@/app/admin/groups/page'))
const AdminIcoPage = lazy(() => import('@/app/admin/ico/page'))
const AdminPerformancePage = lazy(() => import('@/app/admin/performance/page'))
const AdminRlTrainingPage = lazy(() => import('@/app/admin/rl-training/page'))
const AdminTrainingPage = lazy(
  () => import('@/app/(authenticated)/admin/training/page'),
)
const SettingsPage = lazy(() => import('@/app/settings/page'))
const SettingsModerationPage = lazy(
  () => import('@/app/settings/moderation/page'),
)
const AuthCallbackPage = lazy(() => import('@/app/auth/callback/page'))
const BettingPage = lazy(() => import('@/app/betting/page'))
const CommentPage = lazy(() => import('@/app/comment/[id]/page'))
const GamePage = lazy(() => import('@/app/game/page'))
const LaunchPage = lazy(() => import('@/app/launch/page'))
const RegistryPage = lazy(() => import('@/app/registry/page'))
const ReputationPage = lazy(() => import('@/app/reputation/page'))
const PostDetailPage = lazy(() => import('@/app/post/[[...id]]/page'))
const ArticleDetailPage = lazy(() => import('@/app/article/[[...id]]/page'))
const TrendingGroupPage = lazy(() => import('@/app/trending/group/page'))
const TrendingTagPage = lazy(() => import('@/app/trending/[[...tag]]/page'))
const SharePnLPage = lazy(() => import('@/app/share/pnl/[[...userId]]/page'))
const ShareReferralPage = lazy(
  () => import('@/app/share/referral/[[...userId]]/page'),
)
const NotFoundPage = lazy(() => import('@/app/not-found'))

/**
 * Main layout component that wraps all routes
 */
function Layout() {
  return (
    <>
      <Suspense fallback={null}>
        <MobileHeader />
      </Suspense>

      <div className="mx-auto flex min-h-screen max-w-screen-xl bg-sidebar">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>

        <main className="min-h-screen min-w-0 flex-1 bg-background pt-14 pb-14 md:pt-0 md:pb-0">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>

        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <FeedAuthBanner />
      </Suspense>
    </>
  )
}

/**
 * Main App component
 */
export function App() {
  return (
    <BrowserRouter>
      <Providers>
        <Toaster position="top-center" richColors />
        <Suspense fallback={null}>
          <GlobalLoginModal />
        </Suspense>

        <Routes>
          <Route element={<Layout />}>
            {/* Home and Feed */}
            <Route path="/" element={<HomePage />} />
            <Route path="/feed" element={<FeedPage />} />

            {/* Core pages */}
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/chats" element={<ChatsPage />} />
            <Route path="/dao" element={<DaoPage />} />
            <Route path="/rewards" element={<RewardsPage />} />
            <Route path="/betting" element={<BettingPage />} />
            <Route path="/game" element={<GamePage />} />
            <Route path="/launch" element={<LaunchPage />} />
            <Route path="/registry" element={<RegistryPage />} />
            <Route path="/reputation" element={<ReputationPage />} />

            {/* Markets */}
            <Route path="/markets" element={<MarketsPage />} />
            <Route
              path="/markets/predictions"
              element={<PredictionDetailPage />}
            />
            <Route
              path="/markets/predictions/:id"
              element={<PredictionDetailPage />}
            />
            <Route path="/markets/perps" element={<PerpsDetailPage />} />
            <Route
              path="/markets/perps/:ticker"
              element={<PerpsDetailPage />}
            />

            {/* Agents */}
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agents/create" element={<AgentCreatePage />} />
            <Route path="/agents/:agentId" element={<AgentDetailPage />} />

            {/* Profile */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:id" element={<ProfileDetailPage />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/groups" element={<AdminGroupsPage />} />
            <Route path="/admin/ico" element={<AdminIcoPage />} />
            <Route
              path="/admin/performance"
              element={<AdminPerformancePage />}
            />
            <Route
              path="/admin/rl-training"
              element={<AdminRlTrainingPage />}
            />
            <Route path="/admin/training" element={<AdminTrainingPage />} />

            {/* Settings */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="/settings/moderation"
              element={<SettingsModerationPage />}
            />

            {/* Auth */}
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

            {/* Content detail pages */}
            <Route path="/post" element={<PostDetailPage />} />
            <Route path="/post/:id" element={<PostDetailPage />} />
            <Route path="/article" element={<ArticleDetailPage />} />
            <Route path="/article/:id" element={<ArticleDetailPage />} />
            <Route path="/comment/:id" element={<CommentPage />} />

            {/* Trending */}
            <Route path="/trending/group" element={<TrendingGroupPage />} />
            <Route path="/trending" element={<TrendingTagPage />} />
            <Route path="/trending/:tag" element={<TrendingTagPage />} />

            {/* Share pages */}
            <Route path="/share/pnl" element={<SharePnLPage />} />
            <Route path="/share/pnl/:userId" element={<SharePnLPage />} />
            <Route path="/share/referral" element={<ShareReferralPage />} />
            <Route
              path="/share/referral/:userId"
              element={<ShareReferralPage />}
            />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Providers>
    </BrowserRouter>
  )
}

export default App
