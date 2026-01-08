'use client';

import { useEffect, useRef, useState } from 'react';
import { EntitySearchAutocomplete } from '@/components/explore/EntitySearchAutocomplete';
import { LatestNewsPanel } from '@/components/feed/LatestNewsPanel';
import { MarketsPanel } from '@/components/feed/MarketsPanel';
import { TrendingPanel } from '@/components/feed/TrendingPanel';
import { NFT_BANNER_DISMISSED_KEY, NFT_BANNER_HEIGHT } from '@/lib/constants/nft';

export function WidgetSidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  // Cache banner dismissed state to avoid localStorage reads per frame
  const bannerDismissedRef = useRef<boolean>(false);

  useEffect(() => {
    // Read once on mount
    bannerDismissedRef.current =
      localStorage.getItem(NFT_BANNER_DISMISSED_KEY) !== null;

    // Listen for changes from other tabs/components
    const handleStorage = (e: StorageEvent) => {
      if (e.key === NFT_BANNER_DISMISSED_KEY) {
        bannerDismissedRef.current = e.newValue !== null;
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    // Only run on xl+ screens
    if (window.innerWidth < 1280) return;

    let translateY = 0;
    let ticking = false;

    const updateSidebar = () => {
      const scrollTop = document.scrollingElement?.scrollTop || 0;
      const viewportHeight = window.innerHeight;
      const sidebarHeight = inner.offsetHeight;

      // Check if sidebar fits in viewport
      const fitsInViewport = sidebarHeight <= viewportHeight;

      // Use cached banner state (no localStorage read per frame)
      const bannerOffset = bannerDismissedRef.current ? 0 : NFT_BANNER_HEIGHT;

      if (fitsInViewport) {
        // Sidebar fits - simple sticky to top (below banner)
        inner.style.position = 'fixed';
        inner.style.top = `${bannerOffset}px`;
        inner.style.transform = '';
      } else {
        // Sidebar is taller than viewport - translate based on scroll position
        const effectiveViewportHeight = viewportHeight - bannerOffset;
        const maxTranslate = sidebarHeight - effectiveViewportHeight;
        translateY = Math.min(scrollTop, maxTranslate);

        inner.style.position = 'fixed';
        inner.style.top = `${bannerOffset}px`;
        inner.style.transform = `translateY(-${translateY}px)`;
      }

      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateSidebar);
        ticking = true;
      }
    };

    const handleResize = () => {
      if (window.innerWidth < 1280) {
        // Reset styles below breakpoint
        if (inner) {
          inner.style.position = '';
          inner.style.top = '';
          inner.style.transform = '';
        }
        return;
      }
      updateSidebar();
    };

    // Initialize
    updateSidebar();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="hidden w-96 flex-shrink-0 flex-col xl:flex"
    >
      <div ref={innerRef} className="mr-28 flex flex-col gap-6 px-4 py-6">
        <div className="flex-shrink-0">
          <EntitySearchAutocomplete
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search users..."
            searchType="users"
          />
        </div>

        <div className="flex-shrink-0">
          <LatestNewsPanel />
        </div>

        <div className="flex-shrink-0">
          <TrendingPanel />
        </div>

        <div className="flex-shrink-0">
          <MarketsPanel />
        </div>
      </div>
    </div>
  );
}
