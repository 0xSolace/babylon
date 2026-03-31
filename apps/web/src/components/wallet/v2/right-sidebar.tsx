'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import { WalletPreviewWidget } from './wallet-preview-widget';

interface RightSidebarProps {
  userId: string;
}

export function RightSidebar({ userId }: RightSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="hidden w-80 flex-col gap-6 overflow-y-auto p-5 lg:flex">
      {/* Search */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-background py-2.5 pr-4 pl-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Wallet Preview + Latest Positions */}
      <WalletPreviewWidget userId={userId} />
    </div>
  );
}
