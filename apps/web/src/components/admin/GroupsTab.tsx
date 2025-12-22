'use client';

import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Skeleton } from '@/components/shared/Skeleton';

/**
 * Groups tab component for managing user groups.
 *
 * @returns Groups tab element
 */
export function GroupsTab() {
  const {
    data: groups,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: async () => {
      const res = await fetch('/api/admin/groups');
      if (!res.ok) throw new Error('Failed to fetch groups');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500">
        Failed to load groups data: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="flex items-center gap-2 font-bold text-2xl">
        <Users className="h-6 w-6" />
        Groups Management
      </h2>

      <div className="rounded-lg border bg-card p-6">
        <p className="text-muted-foreground">
          {groups?.length ?? 0} groups found. Group management features coming
          soon.
        </p>
      </div>
    </div>
  );
}
