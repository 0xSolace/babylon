import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Suspense } from 'react';
import { Toaster } from 'sonner';
import { AchievementToastListener } from '@/components/achievements';
import { FeedAuthBanner } from '@/components/auth/FeedAuthBanner';
import { GlobalLoginModal } from '@/components/auth/GlobalLoginModal';
import { NftPromoBanner } from '@/components/nft';
import { Providers } from '@/components/providers/Providers';
import { BottomNav } from '@/components/shared/BottomNav';
import { MobileHeader } from '@/components/shared/MobileHeader';
import { Sidebar } from '@/components/shared/Sidebar';

export function FullAppShellClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <Toaster position="top-center" richColors />
      <AchievementToastListener />
      <Suspense fallback={null}>
        <GlobalLoginModal />
      </Suspense>

      <Suspense fallback={null}>
        <NftPromoBanner />
      </Suspense>

      <Suspense fallback={null}>
        <MobileHeader />
      </Suspense>

      <div className="mark mx-auto flex min-h-dvh max-w-7xl bg-sidebar md:min-h-screen">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>

        <main className="min-h-dvh min-w-0 flex-1 bg-background pb-[--bottom-nav-height] md:min-h-screen md:pb-0">
          {children}
        </main>

        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <FeedAuthBanner />
      </Suspense>
      <Analytics />
      <SpeedInsights />
    </Providers>
  );
}
