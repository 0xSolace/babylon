'use client';

import { cn } from '@babylon/shared';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type TeamWidgetTab = 'activity' | 'wallet' | 'pnl' | 'registry' | 'logs';
export type EntityType = 'user' | 'agent' | 'team';

interface EntityOption {
  id: string;
  name: string;
  type: EntityType;
}

const TEAM_ENTITY_ID = 'team';

interface TeamWidgetsRailProps {
  activeTab: TeamWidgetTab;
  onTabChange: (tab: TeamWidgetTab) => void;
  selectedEntityId: string | null;
  selectedEntityType: EntityType | null;
  onEntityChange: (id: string, type: EntityType) => void;
  userId?: string;
  userName?: string;
  agents: { id: string; name: string }[];
  controlsOnly?: boolean;
  children: React.ReactNode;
}

/**
 * Persistent widget rail for the team page desktop sidebar.
 *
 * Reuses the former bottom-panel tab and entity selection behavior in a
 * sidebar-friendly layout.
 */
export function TeamWidgetsRail({
  activeTab,
  onTabChange,
  selectedEntityId,
  selectedEntityType,
  onEntityChange,
  userId,
  userName,
  agents,
  controlsOnly = false,
  children,
}: TeamWidgetsRailProps) {
  const entities: EntityOption[] = [
    ...(userId
      ? [{ id: TEAM_ENTITY_ID, name: 'Team', type: 'team' as const }]
      : []),
    ...(userId
      ? [{ id: userId, name: userName || 'You', type: 'user' as const }]
      : []),
    ...agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      type: 'agent' as const,
    })),
  ];

  const selectedEntity = entities.find(
    (entity) =>
      entity.id === selectedEntityId && entity.type === selectedEntityType
  );

  const isUserSelected = selectedEntityType === 'user';
  const isTeamSelected = selectedEntityType === 'team';
  const allTabs: Array<{ id: TeamWidgetTab; label: string }> = [
    { id: 'activity', label: 'Activity' },
    { id: 'wallet', label: 'Wallet' },
    { id: 'pnl', label: 'PnL' },
    { id: 'registry', label: 'Agent Registry' },
    { id: 'logs', label: 'Logs' },
  ];

  const tabs = isTeamSelected
    ? allTabs.filter(
        (tab) =>
          tab.id === 'wallet' || tab.id === 'pnl' || tab.id === 'registry'
      )
    : isUserSelected
      ? allTabs.filter((tab) => tab.id !== 'logs')
      : allTabs;

  return (
    <div
      data-tour="agents-bottom-panel"
      className={cn(
        'flex flex-col bg-background',
        controlsOnly ? 'h-auto min-h-0' : 'h-full min-h-0'
      )}
    >
      <div className="shrink-0 border-border border-b px-4 py-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-foreground text-sm">
              Team widgets
            </p>
            <p className="text-muted-foreground text-xs">
              Activity, portfolio, PnL, and agent tools
            </p>
          </div>

          {entities.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs transition-colors',
                    'hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary'
                  )}
                >
                  <span className="max-w-[120px] truncate">
                    {selectedEntity?.name || 'Select...'}
                  </span>
                  <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-60 w-48 overflow-y-auto"
              >
                {userId && (
                  <>
                    <DropdownMenuItem
                      onClick={() => onEntityChange(TEAM_ENTITY_ID, 'team')}
                      className="flex items-center justify-between"
                    >
                      <span className="truncate font-medium">Team</span>
                      {selectedEntityId === TEAM_ENTITY_ID &&
                        selectedEntityType === 'team' && (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {userId && (
                  <>
                    <DropdownMenuItem
                      onClick={() => onEntityChange(userId, 'user')}
                      className="flex items-center justify-between"
                    >
                      <span className="truncate font-medium">
                        {userName || 'You'}
                      </span>
                      {selectedEntityId === userId &&
                        selectedEntityType === 'user' && (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        )}
                    </DropdownMenuItem>
                    {agents.length > 0 && <DropdownMenuSeparator />}
                  </>
                )}

                {agents.map((agent) => (
                  <DropdownMenuItem
                    key={agent.id}
                    onClick={() => onEntityChange(agent.id, 'agent')}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{agent.name}</span>
                    {selectedEntityId === agent.id &&
                      selectedEntityType === 'agent' && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 font-medium text-xs transition-colors',
                activeTab === tab.id
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {!controlsOnly && (
        <div className="min-h-0 flex-1 overflow-auto">
          {selectedEntityId ? (
            children
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-muted-foreground text-sm">
              Select a team member to view details.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
