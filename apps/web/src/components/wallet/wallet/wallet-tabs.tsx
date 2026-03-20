'use client';

import { cn } from '@babylon/shared/utils';

interface WalletTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = ['Balance', 'P&L', 'Positions', 'History'];

export function WalletTabs({ activeTab, onTabChange }: WalletTabsProps) {
  return (
    <div className="flex border-border border-b">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={cn(
            'relative flex-1 px-4 py-3 font-medium text-sm transition-colors',
            activeTab === tab
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab}
          {activeTab === tab && (
            <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-sky-500" />
          )}
        </button>
      ))}
    </div>
  );
}
