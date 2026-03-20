/**
 * Theatre Table component with pagination and sorting
 */
'use client';

import { useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, X, Download, Users, Monitor, Search } from 'lucide-react';
import { CHAIN_COLORS, CHAIN_COLORS_LIGHT, ITEMS_PER_PAGE } from '@/lib/constants';
import { getRegion } from '@/lib/regions';
import { highlightText } from '@/lib/mapUtils';
import { Badge } from '@/components/ui/badge';
import type { Theatre } from '../types';

interface TheatreTableProps {
    theatres: Theatre[];
    totalCount: number;
    currentPage: number;
    searchTerm: string;
    sortByName: 'asc' | 'desc' | null;
    sortByCity: 'asc' | 'desc' | null;
    sortByCapacity: 'asc' | 'desc' | null;
    selectedTheatre: Theatre | null;
    onPageChange: (page: number) => void;
    onSearchChange: (term: string) => void;
    onToggleNameSort: () => void;
    onToggleCitySort: () => void;
    onToggleCapacitySort: () => void;
    onTheatreSelect: (theatre: Theatre) => void;
    onClearFilters: () => void;
}

export function TheatreTable({
    theatres,
    totalCount,
    currentPage,
    searchTerm,
    sortByName,
    sortByCity,
    sortByCapacity,
    selectedTheatre,
    onPageChange,
    onSearchChange,
    onToggleNameSort,
    onToggleCitySort,
    onToggleCapacitySort,
    onTheatreSelect,
    onClearFilters,
}: TheatreTableProps) {
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Pagination
    const totalPages = Math.ceil(theatres.length / ITEMS_PER_PAGE);
    const safePage = Math.min(currentPage, Math.max(1, totalPages));
    const paginatedTheatres = theatres.slice(
        (safePage - 1) * ITEMS_PER_PAGE,
        safePage * ITEMS_PER_PAGE
    );

    // Scroll to selected theatre row
    useEffect(() => {
        if (selectedTheatre && tableContainerRef.current) {
            const row = tableContainerRef.current.querySelector(
                `[data-theatre-id="${selectedTheatre.theatre_id}"]`
            );
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [selectedTheatre]);

    // Export to CSV
    const exportToCSV = useCallback(() => {
        const headers = ['Name', 'Chain', 'City', 'Region', 'Studios', 'Capacity', 'Address'];
        const rows = theatres.map((t) => [
            t.name,
            t.merchant,
            t.city,
            getRegion(t.city),
            t.studio_count?.toString() || '0',
            t.total_capacity?.toString() || '0',
            t.address || '',
        ]);
        const csv = [headers, ...rows]
            .map((row) => row.map((cell) => `"${cell}"`).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `theatres-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [theatres]);

    // Keyboard navigation
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (!paginatedTheatres.length) return;

            const currentIndex = selectedTheatre
                ? paginatedTheatres.findIndex((t) => t.theatre_id === selectedTheatre.theatre_id)
                : -1;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = currentIndex < paginatedTheatres.length - 1 ? currentIndex + 1 : 0;
                onTheatreSelect(paginatedTheatres[nextIndex]);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : paginatedTheatres.length - 1;
                onTheatreSelect(paginatedTheatres[prevIndex]);
            }
        },
        [paginatedTheatres, selectedTheatre, onTheatreSelect]
    );

    return (
        <Card>
            <CardHeader className="py-3 px-4 border-b bg-muted/10">
                <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-sm flex-shrink-0 flex items-center gap-2">
                        Theatres
                        <Badge variant="secondary" className="font-normal text-[10px] h-4 px-1.5">
                            {totalCount}
                        </Badge>
                    </CardTitle>

                    {/* Search */}
                    <div className="relative max-w-xs flex-1">
                        <Input
                            placeholder="Search theatre, city..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="h-8 text-sm pr-8"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => onSearchChange('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={exportToCSV}
                        title="Export filtered results to CSV"
                    >
                        <Download className="w-3 h-3" />
                        Export
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                <div
                    ref={tableContainerRef}
                    className="overflow-x-auto max-h-[600px] overflow-y-auto focus:outline-none custom-scrollbar"
                    tabIndex={0}
                    onKeyDown={handleKeyDown}
                >
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                            <TableRow className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted/5">
                                <TableHead
                                    className="pl-4 py-3 cursor-pointer hover:bg-muted/50 select-none w-[35%]"
                                    onClick={onToggleNameSort}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        Theatre
                                        {sortByName === 'asc' && <ArrowUp className="w-3 h-3 text-primary" />}
                                        {sortByName === 'desc' && <ArrowDown className="w-3 h-3 text-primary" />}
                                    </span>
                                </TableHead>
                                <TableHead className="py-3 w-[15%]">Chain</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50 select-none py-3 w-[20%]"
                                    onClick={onToggleCitySort}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        Location
                                        {sortByCity === 'asc' && <ArrowUp className="w-3 h-3 text-primary" />}
                                        {sortByCity === 'desc' && <ArrowDown className="w-3 h-3 text-primary" />}
                                    </span>
                                </TableHead>
                                <TableHead className="py-3 w-[10%] text-center hidden md:table-cell">
                                    <span className="inline-flex items-center gap-1">
                                        <Monitor className="w-3 h-3" />
                                        Studios
                                    </span>
                                </TableHead>
                                <TableHead 
                                    className="py-3 w-[15%] text-right cursor-pointer hover:bg-muted/50 select-none hidden md:table-cell pr-4"
                                    onClick={onToggleCapacitySort}
                                >
                                    <span className="inline-flex items-center gap-1 justify-end w-full">
                                        <Users className="w-3 h-3" />
                                        Capacity
                                        {sortByCapacity === 'asc' && <ArrowUp className="w-3 h-3 text-primary" />}
                                        {sortByCapacity === 'desc' && <ArrowDown className="w-3 h-3 text-primary" />}
                                    </span>
                                </TableHead>
                                <TableHead className="w-10 md:hidden"></TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {paginatedTheatres.length > 0 ? (
                                paginatedTheatres.map((theatre) => (
                                    <TableRow
                                        key={theatre.theatre_id}
                                        data-theatre-id={theatre.theatre_id}
                                        className={`cursor-pointer text-sm transition-colors border-l-2 ${selectedTheatre?.theatre_id === theatre.theatre_id
                                                ? 'bg-primary/10 border-l-primary'
                                                : 'border-l-transparent hover:bg-muted/50'
                                            }`}
                                        onClick={() => onTheatreSelect(theatre)}
                                    >
                                        <TableCell className="pl-4 py-3">
                                            <p className="font-semibold text-sm leading-tight">
                                                {highlightText(theatre.name, searchTerm)}
                                            </p>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <span
                                                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight"
                                                style={{
                                                    backgroundColor:
                                                        CHAIN_COLORS_LIGHT[theatre.merchant as keyof typeof CHAIN_COLORS_LIGHT] ||
                                                        'rgba(102, 102, 102, 0.2)',
                                                    color:
                                                        CHAIN_COLORS[theatre.merchant as keyof typeof CHAIN_COLORS] || '#666',
                                                }}
                                            >
                                                {theatre.merchant}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <p className="text-sm font-medium">{highlightText(theatre.city, searchTerm)}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{getRegion(theatre.city)}</p>
                                        </TableCell>
                                        <TableCell className="py-3 text-center hidden md:table-cell">
                                            <span className="text-sm font-mono font-medium">
                                                {theatre.studio_count || 0}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-3 text-right hidden md:table-cell pr-4">
                                            {theatre.total_capacity && theatre.total_capacity > 0 ? (
                                                <span className="text-sm font-mono font-bold text-primary">
                                                    {theatre.total_capacity.toLocaleString()}
                                                </span>
                                            ) : (
                                                <Badge variant="outline" className="text-[9px] font-normal h-4 text-muted-foreground/60 border-muted/30">
                                                    Indexing
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-4 py-3 md:hidden">
                                            <span className="text-xs text-muted-foreground">→</span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-20">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <Search className="w-10 h-10 mb-4 opacity-20" />
                                            <p className="text-sm font-medium mb-1">No theatres found</p>
                                            <p className="text-xs mb-6">Try adjusting your filters or search term</p>
                                            <Button variant="outline" size="sm" className="text-xs" onClick={onClearFilters}>
                                                Clear all filters
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
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/5">
                        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                            Page {safePage} of {totalPages}
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={currentPage === 1}
                                onClick={() => onPageChange(currentPage - 1)}
                            >
                                ←
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={currentPage === totalPages}
                                onClick={() => onPageChange(currentPage + 1)}
                            >
                                →
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
