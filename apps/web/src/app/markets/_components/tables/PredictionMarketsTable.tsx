'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { PredictionMarketWithPosition } from '@/types/markets';
import { calculateSharePercentages, getDaysLeft } from '../../_lib/formatters';
import { type SortConfig, useTableSort } from '../../_hooks/useTableSort';
import { cn, formatNumberWithSeparators } from '@babylon/shared';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface PredictionMarketsTableProps {
    predictions: PredictionMarketWithPosition[];
    onPredictionClick: (prediction: PredictionMarketWithPosition) => void;
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
    currentSort: SortConfig<PredictionMarketWithPosition>;
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

export function PredictionMarketsTable({ predictions, onPredictionClick }: PredictionMarketsTableProps) {
    // Custom sorters needed for derived values like liqudity/shares
    const customSorters = {
        shares: (a: PredictionMarketWithPosition, b: PredictionMarketWithPosition) => {
            const aTotal = calculateSharePercentages(a.yesShares, a.noShares).totalShares;
            const bTotal = calculateSharePercentages(b.yesShares, b.noShares).totalShares;
            return aTotal - bTotal;
        },
        ends: (a: PredictionMarketWithPosition, b: PredictionMarketWithPosition) => {
            return new Date(a.resolutionDate).getTime() - new Date(b.resolutionDate).getTime();
        }
    };

    const { sortedData, sortConfig, handleSort } = useTableSort(predictions, {
        key: 'shares',
        direction: 'desc',
    }, customSorters);

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow className="h-10 hover:bg-transparent">
                        <SortHeader label="Question" sortKey="text" currentSort={sortConfig} onSort={handleSort} className="w-[40%]" />
                        <TableHead>Probabilities</TableHead>
                        <SortHeader label="Shares" sortKey="shares" currentSort={sortConfig} onSort={handleSort} className="text-right hidden sm:table-cell" />
                        <SortHeader label="Ends" sortKey="ends" currentSort={sortConfig} onSort={handleSort} className="text-right hidden md:table-cell" />
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedData.map((market) => {
                        const { yesPercent, noPercent, totalShares } = calculateSharePercentages(
                            market.yesShares,
                            market.noShares
                        );
                        const daysLeft = getDaysLeft(market.resolutionDate);

                        return (
                            <TableRow
                                key={market.id}
                                className="h-10 cursor-pointer"
                                onClick={() => onPredictionClick(market)}
                            >
                                <TableCell className="py-2 font-medium max-w-[200px] sm:max-w-none truncate" title={market.text}>
                                    {market.text}
                                </TableCell>
                                <TableCell className="py-2">
                                    <div className="flex gap-2 text-xs font-medium">
                                        <span className="text-green-600">{yesPercent.toFixed(0)}% YES</span>
                                        <span className="text-red-600">{noPercent.toFixed(0)}% NO</span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-2 text-right hidden sm:table-cell text-muted-foreground">
                                    {formatNumberWithSeparators(totalShares)}
                                </TableCell>
                                <TableCell className="py-2 text-right hidden md:table-cell text-muted-foreground">
                                    {daysLeft !== null ? `${daysLeft}d` : 'Soon'}
                                </TableCell>
                                <TableCell className="py-2 text-right">
                                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                        <button className="px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-600/10 rounded">Buy YES</button>
                                        <button className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-600/10 rounded">Buy NO</button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                    {sortedData.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                No prediction markets found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
