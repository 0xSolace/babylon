import { PageContainer } from '@/components/shared/PageContainer';
import { NotificationItemSkeleton, Skeleton } from '@/components/shared/Skeleton';

export default function NotificationsLoading() {
  const desktopSkeletonKeys = [
    'desktop-skel-1',
    'desktop-skel-2',
    'desktop-skel-3',
    'desktop-skel-4',
    'desktop-skel-5',
    'desktop-skel-6',
    'desktop-skel-7',
    'desktop-skel-8',
    'desktop-skel-9',
    'desktop-skel-10',
  ];
  const mobileSkeletonKeys = [
    'mobile-skel-1',
    'mobile-skel-2',
    'mobile-skel-3',
    'mobile-skel-4',
    'mobile-skel-5',
    'mobile-skel-6',
    'mobile-skel-7',
    'mobile-skel-8',
  ];

  return (
    <PageContainer noPadding className="flex flex-col">
      {/* Desktop */}
      <div className="hidden flex-1 flex-col overflow-hidden lg:flex">
        {/* Header */}
        <div className="sticky top-0 z-10 border-border/5 border-b bg-background p-4 shadow-sm sm:p-6">
          <Skeleton className="h-7 w-40 max-w-full" />
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl px-4 sm:px-0">
            {desktopSkeletonKeys.map((key) => (
              <NotificationItemSkeleton key={key} />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile/Tablet */}
      <div className="flex flex-1 flex-col overflow-hidden lg:hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 border-border/5 border-b bg-background p-4 shadow-sm">
          <Skeleton className="h-6 w-32 max-w-full" />
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {mobileSkeletonKeys.map((key) => (
            <NotificationItemSkeleton key={key} />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
