/**
 * Showtime Table component with sorting and pagination
 */
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { CHAIN_COLORS, CHAIN_COLORS_LIGHT } from '@/lib/constants';
import type { Showtime, SortField, SortDirection } from '../types';

const ITEMS_PER_PAGE = 20;

interface ShowtimeTableProps {
    showtimes: Showtime[];
    currentPage: number;
    sortField: SortField;
    sortDirection: SortDirection;
    onPageChange: (page: number) => void;
    onToggleSort: (field: SortField) => void;
    onClearFilters: () => void;
}

export function ShowtimeTable({
    showtimes,
    currentPage,
    sortField,
    sortDirection,
    onPageChange,
    onToggleSort,
    onClearFilters,
}: ShowtimeTableProps) {
    const totalPages = Math.ceil(showtimes.length / ITEMS_PER_PAGE);
    const safePage = Math.min(currentPage, Math.max(1, totalPages || 1));
    const paginatedShowtimes = showtimes.slice(
        (safePage - 1) * ITEMS_PER_PAGE,
        safePage * ITEMS_PER_PAGE
    );

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? (
            <ArrowUp className="w-3 h-3" />
        ) : sortDirection === 'desc' ? (
            <ArrowDown className="w-3 h-3" />
        ) : null;
    };

    const SortableHeader = ({
        field,
        children,
    }: {
        field: SortField;
        children: React.ReactNode;
    }) => (
        <TableHead
            className="cursor-pointer hover:bg-muted/50 select-none"
            onClick={() => onToggleSort(field)}
        >
            <span className="inline-flex items-center gap-1">
                {children}
                <SortIcon field={field} />
            </span>
        </TableHead>
    );

    return (
        <Card>
            <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">
                    Showtimes
                    <span className="font-normal text-muted-foreground ml-2">
                        {showtimes.length} results
                    </span>
                </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow className="text-xs">
                                <SortableHeader field="showtime">Showtime</SortableHeader>
                                <SortableHeader field="movie_title">Movie</SortableHeader>
                                <SortableHeader field="city">City</SortableHeader>
                                <SortableHeader field="theatre_name">Theatre</SortableHeader>
                                <SortableHeader field="chain">Chain</SortableHeader>
                                <SortableHeader field="room_type">Room</SortableHeader>
                                <TableHead>Price</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {paginatedShowtimes.length > 0 ? (
                                paginatedShowtimes.map((st, idx) => (
                                    <TableRow
                                        key={`${st.showtime_id}-${idx}`}
                                        className={idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}
                                    >
                                        <TableCell className="font-mono font-medium text-primary">
                                            {st.showtime}
                                        </TableCell>
                                        <TableCell className="max-w-[200px]">
                                            <p className="font-medium truncate" title={st.movie_title}>
                                                {st.movie_title}
                                            </p>
                                        </TableCell>
                                        <TableCell>{st.city}</TableCell>
                                        <TableCell className="max-w-[150px]">
                                            <p className="truncate" title={st.theatre_name}>
                                                {st.theatre_name}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                                style={{
                                                    backgroundColor:
                                                        CHAIN_COLORS_LIGHT[st.chain as keyof typeof CHAIN_COLORS_LIGHT] ||
                                                        'rgba(102, 102, 102, 0.2)',
                                                    color: CHAIN_COLORS[st.chain as keyof typeof CHAIN_COLORS] || '#666',
                                                }}
                                            >
                                                {st.chain}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {st.room_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{st.price}</TableCell>
                                        <TableCell>
                                            {st.is_available ? (
                                                <Badge variant="default" className="text-xs bg-green-600">
                                                    Available
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-xs">
                                                    Past
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12">
                                        <div className="text-muted-foreground">
                                            <p className="text-sm font-medium mb-2">No showtimes found</p>
                                            <p className="text-xs mb-4">Try adjusting your filters</p>
                                            <Button variant="outline" size="sm" onClick={onClearFilters}>
                                                Clear filters
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2 border-t text-xs">
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={safePage === 1}
                            onClick={() => onPageChange(safePage - 1)}
                        >
                            ← Previous
                        </Button>
                        <span className="text-muted-foreground">
                            Page {safePage} of {totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={safePage === totalPages}
                            onClick={() => onPageChange(safePage + 1)}
                        >
                            Next →
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
