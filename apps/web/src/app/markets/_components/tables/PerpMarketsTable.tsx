'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { PerpMarket } from '@/types/markets';
import { formatPrice, formatVolume } from '../../_lib/formatters';
import { type SortConfig, useTableSort } from '../../_hooks/useTableSort';
import { cn } from '@babylon/shared';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface PerpMarketsTableProps {
    markets: PerpMarket[];
    onMarketClick: (market: PerpMarket) => void;
}

function SortHeader({
    label,
    sortKey,
    currentSort,
    onSort,
    className
}: {
    label: string;
    sortKey: string;
    currentSort: SortConfig<PerpMarket>;
    onSort: (key: string) => void;
    className?: string;
}) {
    return (
        <TableHead
            className={cn('cursor-pointer select-none hover:text-foreground', className)}
            onClick={() => onSort(sortKey)}
        >
            <div className="flex items-center gap-1">
                {label}
                {currentSort.key === sortKey && (
                    currentSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                )}
            </div>
        </TableHead>
    );
}

export function PerpMarketsTable({ markets, onMarketClick }: PerpMarketsTableProps) {
    const { sortedData, sortConfig, handleSort } = useTableSort(markets, {
        key: 'volume24h',
        direction: 'desc',
    });

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow className="h-10 hover:bg-transparent">
                        <SortHeader label="Market" sortKey="ticker" currentSort={sortConfig} onSort={handleSort} />
                        <SortHeader label="Price" sortKey="currentPrice" currentSort={sortConfig} onSort={handleSort} className="text-right" />
                        <SortHeader label="24h Change" sortKey="changePercent24h" currentSort={sortConfig} onSort={handleSort} className="text-right" />
                        <SortHeader label="Volume" sortKey="volume24h" currentSort={sortConfig} onSort={handleSort} className="text-right hidden sm:table-cell" />
                        <SortHeader label="Open Interest" sortKey="openInterest" currentSort={sortConfig} onSort={handleSort} className="text-right hidden md:table-cell" />
                        <SortHeader label="Funding" sortKey="fundingRate.rate" currentSort={sortConfig} onSort={handleSort} className="text-right hidden lg:table-cell" />
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedData.map((market) => (
                        <TableRow
                            key={market.ticker}
                            className="h-10 cursor-pointer"
                            onClick={() => onMarketClick(market)}
                        >
                            <TableCell className="py-2 font-medium">
                                <div className="flex items-center gap-2">
                                    <span>{market.ticker}</span>
                                    <span className="text-xs text-muted-foreground font-normal hidden sm:inline">{market.name}</span>
                                </div>
                            </TableCell>
                            <TableCell className="py-2 text-right">
                                {formatPrice(market.currentPrice)}
                            </TableCell>
                            <TableCell
                                className={cn(
                                    'py-2 text-right font-medium',
                                    market.changePercent24h >= 0 ? 'text-green-500' : 'text-red-500'
                                )}
                            >
                                {market.changePercent24h >= 0 ? '+' : ''}
                                {market.changePercent24h.toFixed(2)}%
                            </TableCell>
                            <TableCell className="py-2 text-right text-muted-foreground hidden sm:table-cell">
                                {formatVolume(market.volume24h)}
                            </TableCell>
                            <TableCell className="py-2 text-right text-muted-foreground hidden md:table-cell">
                                {formatVolume(market.openInterest)}
                            </TableCell>
                            <TableCell
                                className={cn(
                                    'py-2 text-right hidden lg:table-cell',
                                    market.fundingRate.rate >= 0 ? 'text-orange-500' : 'text-blue-500'
                                )}
                            >
                                {(market.fundingRate.rate * 100).toFixed(4)}%
                            </TableCell>
                            <TableCell className="py-2 text-right">
                                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button className="px-2 py-1 text-xs font-medium text-green-500 hover:bg-green-500/10 rounded">Long</button>
                                    <button className="px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded">Short</button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    {sortedData.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                                No markets found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
