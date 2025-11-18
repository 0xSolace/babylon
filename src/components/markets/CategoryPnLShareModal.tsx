'use client';

import type { User } from '@/stores/authStore';
import { PnLShareModal } from './PnLShareModal';

type MarketCategory = 'perps' | 'predictions';

type CategoryPnLData = {
  unrealizedPnL: number;
  positionCount: number;
  totalValue?: number;
  categorySpecific?: {
    openInterest?: number;
    totalShares?: number;
    totalInvested?: number;
  };
};

type CategoryPnLShareModalProps = {
  isOpen: boolean;
  onClose: () => void;
  category: MarketCategory;
  data: CategoryPnLData | null | undefined;
  user: User | null;
  lastUpdated?: Date | null | number;
};

export function CategoryPnLShareModal({
  isOpen,
  onClose,
  category,
  data,
  user,
}: CategoryPnLShareModalProps) {
  return (
    <PnLShareModal
      isOpen={isOpen}
      onClose={onClose}
      type="category"
      category={category}
      categoryData={data ?? null}
      user={user}
    />
  );
}
