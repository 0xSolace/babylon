/**
 * Admin Dashboard Page
 *
 * @description Main admin dashboard providing access to various administrative tabs for managing
 * system statistics, game control, fees, users, groups, notifications, reports, AI models,
 * training data, agents, and escrow. Requires admin authentication.
 *
 * @page /admin
 * @access Admin only
 *
 * @features
 * - Admin authentication check
 * - Tabbed interface for different admin functions
 * - System statistics and monitoring
 * - Game engine control
 * - User management
 * - Moderation tools (reports, human review)
 * - AI model configuration
 * - Training data management
 * - Agent management
 * - Escrow management
 *
 * @example
 * ```tsx
 * // Accessible at /admin
 * // Requires admin privileges
 * <AdminDashboard />
 * ```
 */

import { cn } from '@jejunetwork/shared'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  BarChart,
  Bell,
  Bot,
  ChevronDown,
  Coins,
  Database,
  DollarSign,
  Eye,
  Flag,
  Gamepad2,
  Layers,
  LineChart,
  type LucideIcon,
  MessageSquare,
  Scale,
  ScrollText,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AdminManagementTab } from '@/components/admin/AdminManagementTab'
import { AgentsTab } from '@/components/admin/AgentsTab'
import { AIModelsTab } from '@/components/admin/AIModelsTab'

// Lazy load AnalyticsTab (contains heavy recharts dependency)
const AnalyticsTab = lazy(() =>
  import('@/components/admin/AnalyticsTab').then((m) => ({
    default: m.AnalyticsTab,
  })),
)

import { AuditLogsTab } from '@/components/admin/AuditLogsTab'
import { ContentModerationTab } from '@/components/admin/ContentModerationTab'
import { EscrowManagementTab } from '@/components/admin/EscrowManagementTab'
import { FeesTab } from '@/components/admin/FeesTab'
import { GameControlTab } from '@/components/admin/GameControlTab'
import { GroupsTab } from '@/components/admin/GroupsTab'
import { HumanReviewTab } from '@/components/admin/HumanReviewTab'
import { MarketOversightTab } from '@/components/admin/MarketOversightTab'
import { NotificationsTab } from '@/components/admin/NotificationsTab'
import { RegistryTab } from '@/components/admin/RegistryTab'
import { ReportsTab } from '@/components/admin/ReportsTab'
import { StatsTab } from '@/components/admin/StatsTab'
import { SystemHealthTab } from '@/components/admin/SystemHealthTab'
import { TradingFeedTab } from '@/components/admin/TradingFeedTab'
import { TrainingDataTab } from '@/components/admin/TrainingDataTab'
import { UserManagementTab } from '@/components/admin/UserManagementTab'
import { PageContainer } from '@/components/shared/PageContainer'
import { Skeleton } from '@/components/shared/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from '@/lib/navigation'

/**
 * Available admin dashboard tabs
 */
type Tab =
  | 'stats'
  | 'analytics'
  | 'system-health'
  | 'game-control'
  | 'fees'
  | 'trades'
  | 'markets'
  | 'users'
  | 'content-moderation'
  | 'registry'
  | 'groups'
  | 'notifications'
  | 'admins'
  | 'reports'
  | 'human-review'
  | 'ai-models'
  | 'training-data'
  | 'agents'
  | 'escrow'
  | 'audit-logs'
  | 'ico'

/**
 * Admin Dashboard Component
 *
 * @description Main admin dashboard with tabbed interface for system management
 *
 * @returns {JSX.Element} Admin dashboard page
 */
export default function AdminDashboard() {
  const router = useRouter()
  const { authenticated, ready } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('stats')

  // Dropdown state - must be before any early returns
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Check if running on localhost to allow dev access
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1')

  const { data: isAuthorized, isLoading: loading } = useQuery({
    queryKey: ['admin', 'access'],
    queryFn: async (): Promise<boolean> => {
      if (!authenticated) {
        if (!isLocalhost) {
          router.push('/')
        }
        return false
      }

      // Check if user is admin by trying to fetch admin stats
      const response = await fetch('/api/admin/stats')

      if (!response.ok) {
        return false
      }

      return true
    },
    enabled: ready,
    staleTime: 5 * 60 * 1000, // 5 minutes - admin status doesn't change often
  })

  if (loading) {
    return (
      <PageContainer>
        <div className="flex h-full items-center justify-center">
          <div className="w-full max-w-md space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </PageContainer>
    )
  }

  if (!isAuthorized) {
    return (
      <PageContainer>
        <div className="flex h-full flex-col items-center justify-center">
          <Shield className="mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="mb-2 font-bold text-2xl">Access Denied</h1>
          <p className="text-muted-foreground">
            You don&apos;t have permission to access the admin dashboard.
          </p>
        </div>
      </PageContainer>
    )
  }

  // Navigation items organized by category
  interface NavItem {
    id: Tab
    label: string
    icon: LucideIcon
    href?: string
  }
  interface NavCategory {
    name: string
    items: NavItem[]
  }
  const navCategories: NavCategory[] = [
    {
      name: 'Overview',
      items: [
        { id: 'stats', label: 'Dashboard', icon: BarChart },
        { id: 'analytics', label: 'Analytics', icon: LineChart },
        { id: 'system-health', label: 'System Health', icon: Server },
      ],
    },
    {
      name: 'Game & Markets',
      items: [
        { id: 'game-control', label: 'Game Control', icon: Gamepad2 },
        { id: 'markets', label: 'Markets', icon: TrendingUp },
        { id: 'fees', label: 'Fees', icon: DollarSign },
        { id: 'trades', label: 'Trades', icon: Activity },
        { id: 'escrow', label: 'Escrow', icon: DollarSign },
      ],
    },
    {
      name: 'Users & Moderation',
      items: [
        { id: 'users', label: 'Users', icon: Users },
        { id: 'admins', label: 'Admin Management', icon: ShieldCheck },
        { id: 'content-moderation', label: 'Content Moderation', icon: Eye },
        { id: 'reports', label: 'Reports', icon: Flag },
        { id: 'human-review', label: 'Human Review', icon: Scale },
      ],
    },
    {
      name: 'Platform',
      items: [
        { id: 'registry', label: 'Registry', icon: Layers },
        { id: 'groups', label: 'Groups', icon: MessageSquare },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'ico', label: 'ICO', icon: Coins, href: '/admin/ico' },
      ],
    },
    {
      name: 'AI & Agents',
      items: [
        { id: 'agents', label: 'Agents', icon: Bot },
        { id: 'ai-models', label: 'AI Models', icon: Sparkles },
        { id: 'training-data', label: 'Training Data', icon: Database },
      ],
    },
    {
      name: 'Audit',
      items: [{ id: 'audit-logs', label: 'Audit Logs', icon: ScrollText }],
    },
  ]

  // Get current tab info by searching through categories
  const currentTab = navCategories
    .flatMap((c) => c.items)
    .find((item) => item.id === activeTab)
  const CurrentIcon = currentTab?.icon || BarChart

  return (
    <PageContainer className="flex flex-col">
      {/* Header with Dropdown Navigation */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-bold text-xl sm:text-2xl">Admin Dashboard</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              System management and monitoring
            </p>
          </div>
        </div>

        {/* Navigation Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 font-medium transition-all sm:w-auto sm:min-w-[220px]',
              'hover:border-primary/50 hover:bg-card/80',
              isDropdownOpen && 'border-primary ring-2 ring-primary/20',
            )}
          >
            <div className="flex items-center gap-2">
              <CurrentIcon className="h-4 w-4 text-primary" />
              <span>{currentTab?.label || 'Dashboard'}</span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                isDropdownOpen && 'rotate-180',
              )}
            />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-full min-w-[280px] overflow-y-auto rounded-xl border border-border bg-card shadow-xl sm:w-auto">
              {navCategories.map((category, categoryIndex) => (
                <div key={category.name}>
                  {categoryIndex > 0 && (
                    <div className="mx-3 border-border border-t" />
                  )}
                  <div className="px-3 py-2">
                    <div className="mb-1 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      {category.name}
                    </div>
                    {category.items.map((item) => {
                      const Icon = item.icon
                      const isActive = activeTab === item.id
                      const hasHref = 'href' in item && item.href

                      if (hasHref) {
                        return (
                          <a
                            key={item.id}
                            href={item.href}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                              'text-foreground hover:bg-muted',
                            )}
                          >
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            {item.label}
                          </a>
                        )
                      }

                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id)
                            setIsDropdownOpen(false)
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                            isActive
                              ? 'bg-primary/10 font-medium text-primary'
                              : 'text-foreground hover:bg-muted',
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-4 w-4',
                              isActive
                                ? 'text-primary'
                                : 'text-muted-foreground',
                            )}
                          />
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'analytics' && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-8">
                Loading analytics...
              </div>
            }
          >
            <AnalyticsTab />
          </Suspense>
        )}
        {activeTab === 'system-health' && <SystemHealthTab />}
        {activeTab === 'game-control' && <GameControlTab />}
        {activeTab === 'markets' && <MarketOversightTab />}
        {activeTab === 'fees' && <FeesTab />}
        {activeTab === 'trades' && <TradingFeedTab />}
        {activeTab === 'users' && <UserManagementTab />}
        {activeTab === 'content-moderation' && <ContentModerationTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'human-review' && <HumanReviewTab />}
        {activeTab === 'admins' && <AdminManagementTab />}
        {activeTab === 'registry' && <RegistryTab />}
        {activeTab === 'groups' && <GroupsTab />}
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'ai-models' && <AIModelsTab />}
        {activeTab === 'training-data' && <TrainingDataTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'escrow' && <EscrowManagementTab />}
        {activeTab === 'audit-logs' && <AuditLogsTab />}
      </div>
    </PageContainer>
  )
}
