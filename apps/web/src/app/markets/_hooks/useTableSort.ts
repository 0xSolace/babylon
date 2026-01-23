'use client';

import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig<T> {
  key: keyof T | string;
  direction: SortDirection;
}

/**
 * Hook for handling client-side table sorting
 */
export function useTableSort<T>(
  data: T[],
  defaultConfig: SortConfig<T> = { key: '', direction: 'desc' },
  // Optional custom sorters
  customSorters: Record<string, (a: T, b: T) => number> = {}
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(defaultConfig);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      // Use custom sorter if available
      if (customSorters[sortConfig.key]) {
        const result = customSorters[sortConfig.key](a, b);
        return sortConfig.direction === 'asc' ? result : -result;
      }

      // Default sorting
      // @ts-ignore - Dynamic key access
      const aValue = a[sortConfig.key];
      // @ts-ignore - Dynamic key access
      const bValue = b[sortConfig.key];

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [data, sortConfig, customSorters]);

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  return { sortedData, sortConfig, handleSort };
}
