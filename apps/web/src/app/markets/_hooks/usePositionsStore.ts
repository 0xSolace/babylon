import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PositionsState {
    // Column visibility
    showPnl: boolean;
    showSize: boolean;
    showEntry: boolean;
    showLiquidation: boolean;
    showFunding: boolean;

    // Actions
    toggleColumn: (column: keyof Omit<PositionsState, 'toggleColumn'>) => void;
}

export const usePositionsStore = create<PositionsState>()(
    persist(
        (set) => ({
            showPnl: true,
            showSize: true,
            showEntry: true,
            showLiquidation: true,
            showFunding: true,
            toggleColumn: (column) =>
                set((state) => ({ [column]: !state[column] })),
        }),
        {
            name: 'babylon-positions-settings',
        }
    )
);
