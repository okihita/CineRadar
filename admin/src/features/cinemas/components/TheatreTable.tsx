/**
 * Theatre Table component with pagination and sorting
 */
'use client';

import { useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, X, Download } from 'lucide-react';
import { CHAIN_COLORS, CHAIN_COLORS_LIGHT, ITEMS_PER_PAGE } from '@/lib/constants';
import { getRegion } from '@/lib/regions';
import { highlightText } from '@/lib/mapUtils';
import type { Theatre } from '../types';

interface TheatreTableProps {
    theatres: Theatre[];
    totalCount: number;
    currentPage: number;
    searchTerm: string;
    sortByName: 'asc' | 'desc' | null;
    sortByCity: 'asc' | 'desc' | null;
    selectedTheatre: Theatre | null;
    onPageChange: (page: number) => void;
    onSearchChange: (term: string) => void;
    onToggleNameSort: () => void;
    onToggleCitySort: () => void;
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
    selectedTheatre,
    onPageChange,
    onSearchChange,
    onToggleNameSort,
    onToggleCitySort,
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
        const headers = ['Name', 'Chain', 'City', 'Region', 'Address'];
        const rows = theatres.map((t) => [
            t.name,
            t.merchant,
            t.city,
            getRegion(t.city),
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
            <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-sm flex-shrink-0">
                        Theatres
                        <span className="font-normal text-muted-foreground ml-2">
                            {totalCount} results
                        </span>
                    </CardTitle>

                    {/* Search */}
                    <div className="relative max-w-xs">
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
                    className="overflow-x-auto max-h-[500px] overflow-y-auto focus:outline-none"
                    tabIndex={0}
                    onKeyDown={handleKeyDown}
                >
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow className="text-xs">
                                <TableHead
                                    className="pl-4 py-2 cursor-pointer hover:bg-muted/50 select-none"
                                    onClick={onToggleNameSort}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        Theatre
                                        {sortByName === 'asc' && <ArrowUp className="w-3 h-3" />}
                                        {sortByName === 'desc' && <ArrowDown className="w-3 h-3" />}
                                    </span>
                                </TableHead>
                                <TableHead className="py-2">Chain</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50 select-none py-2"
                                    onClick={onToggleCitySort}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        City
                                        {sortByCity === 'asc' && <ArrowUp className="w-3 h-3" />}
                                        {sortByCity === 'desc' && <ArrowDown className="w-3 h-3" />}
                                    </span>
                                </TableHead>
                                <TableHead className="text-right pr-4 py-2"></TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {paginatedTheatres.length > 0 ? (
                                paginatedTheatres.map((theatre, index) => (
                                    <TableRow
                                        key={theatre.theatre_id}
                                        data-theatre-id={theatre.theatre_id}
                                        className={`cursor-pointer text-sm transition-colors ${selectedTheatre?.theatre_id === theatre.theatre_id
                                                ? 'bg-primary/10 border-l-2 border-l-primary'
                                                : index % 2 === 0
                                                    ? 'bg-transparent hover:bg-muted/50'
                                                    : 'bg-muted/20 hover:bg-muted/50'
                                            }`}
                                        onClick={() => onTheatreSelect(theatre)}
                                    >
                                        <TableCell className="pl-4 py-2">
                                            <p className="font-medium text-sm">
                                                {highlightText(theatre.name, searchTerm)}
                                            </p>
                                        </TableCell>
                                        <TableCell className="py-2">
                                            <span
                                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
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
                                        <TableCell className="py-2">
                                            <p className="text-sm">{highlightText(theatre.city, searchTerm)}</p>
                                            <p className="text-xs text-muted-foreground">{getRegion(theatre.city)}</p>
                                        </TableCell>
                                        <TableCell className="text-right pr-4 py-2">
                                            <span className="text-xs text-muted-foreground">→</span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-12">
                                        <div className="text-muted-foreground">
                                            <p className="text-sm font-medium mb-2">No theatres found</p>
                                            <p className="text-xs mb-4">Try adjusting your filters or search term</p>
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
                    <div className="flex items-center justify-between px-4 py-2 border-t text-xs">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={currentPage === 1}
                            onClick={() => onPageChange(currentPage - 1)}
                        >
                            ←
                        </Button>
                        <span className="text-muted-foreground">
                            {safePage} / {totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={currentPage === totalPages}
                            onClick={() => onPageChange(currentPage + 1)}
                        >
                            →
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
