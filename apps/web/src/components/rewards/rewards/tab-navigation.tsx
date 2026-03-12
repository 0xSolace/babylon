'use client';

import { cn } from '@babylon/shared/utils';

type Tab = 'overview' | 'achievements' | 'challenges';

interface TabNavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'achievements', label: 'Achievements' },
    { id: 'challenges', label: 'Challenges' },
  ];

  return (
    <div className="flex border-gray-200 border-b">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex-1 py-4 text-center font-medium text-base transition-colors',
            activeTab === tab.id
              ? 'border-indigo-500 border-b-2 text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
