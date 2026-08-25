'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  ExternalLink,
  Building2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MerchantBadge } from '@/components/MerchantBadge';
import type { Theatre } from '../';

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
  onToggleNameSort: () => void;
  onToggleCitySort: () => void;
  onToggleCapacitySort: () => void;
  onTheatreSelect: (theatre: Theatre) => void;
  onClearFilters: () => void;
}

const ITEMS_PER_PAGE = 10;

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
  onToggleNameSort,
  onToggleCitySort,
  onToggleCapacitySort,
  onTheatreSelect,
  onClearFilters,
}: TheatreTableProps) {
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentTheatres = theatres.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-primary/20 text-primary-foreground rounded-sm px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  if (totalCount === 0 && searchTerm) {
    return (
      <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-muted/10">
        <Building2 className="w-10 h-10 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium">No theatres found for &quot;{searchTerm}&quot;</h3>
        <p className="text-muted-foreground mb-6">Try adjusting your search or filters</p>
        <Button variant="outline" onClick={onClearFilters}>
          Clear All Filters
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[30%]">
                <button
                  onClick={onToggleNameSort}
                  className="flex items-center gap-1 hover:text-primary transition-colors font-bold uppercase tracking-wider text-[10px]"
                >
                  <Building2 className="w-3 h-3" />
                  Theatre Name
                  <span className="text-[8px] opacity-50 ml-1">
                    {sortByName === 'asc' ? '↑' : '↓'}
                  </span>
                </button>
              </TableHead>
              <TableHead className="w-[20%]">
                <button
                  onClick={onToggleCitySort}
                  className="flex items-center gap-1 hover:text-primary transition-colors font-bold uppercase tracking-wider text-[10px]"
                >
                  <MapPin className="w-3 h-3" />
                  Location
                  <span className="text-[8px] opacity-50 ml-1">
                    {sortByCity === 'asc' ? '↑' : '↓'}
                  </span>
                </button>
              </TableHead>
              <TableHead className="w-[15%] font-bold uppercase tracking-wider text-[10px]">Merchant</TableHead>
              <TableHead className="w-[15%]">
                <button
                  onClick={onToggleCapacitySort}
                  className="flex items-center gap-1 hover:text-primary transition-colors font-bold uppercase tracking-wider text-[10px]"
                >
                  <Users className="w-3 h-3" />
                  Capacity
                  <span className="text-[8px] opacity-50 ml-1">
                    {sortByCapacity === 'asc' ? '↑' : '↓'}
                  </span>
                </button>
              </TableHead>
              <TableHead className="text-right font-bold uppercase tracking-wider text-[10px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentTheatres.map((theatre) => {
              const isSelected = selectedTheatre?.theatre_id === theatre.theatre_id;
              const hasCapacity = theatre.total_capacity && theatre.total_capacity > 0;

              return (
                <TableRow
                  key={theatre.theatre_id}
                  className={cn(
                    'group cursor-pointer transition-colors',
                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/20'
                  )}
                  onClick={() => onTheatreSelect(theatre)}
                >
                  <TableCell className="py-4">
                    <div className="flex flex-col">
                      <p className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors uppercase">
                        {highlightText(theatre.name, searchTerm)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {theatre.theatre_id}
                        </span>
                        {theatre.version && (
                          <Badge variant="outline" className="text-[8px] h-4 px-1 bg-primary/5 text-primary border-primary/20">
                            V{theatre.version}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="text-xs font-medium">{highlightText(theatre.city, searchTerm)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <MerchantBadge merchant={theatre.merchant} />
                  </TableCell>
                  <TableCell>
                    {hasCapacity ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-bold font-mono">
                          {theatre.total_capacity?.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">
                          Across {theatre.studio_count || 0} Studios
                        </span>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-[9px] font-bold uppercase opacity-40 animate-pulse">
                        Indexing...
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <a 
                        href={`/cinemas/${theatre.theatre_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 h-8 px-3 text-[10px] font-bold uppercase tracking-tight border border-primary/20 bg-background hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all shadow-sm rounded-md no-underline"
                      >
                        Intelligence
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-xs text-muted-foreground">
          Showing <span className="font-bold text-foreground">{startIndex + 1}</span> to{' '}
          <span className="font-bold text-foreground">
            {Math.min(startIndex + ITEMS_PER_PAGE, totalCount)}
          </span>{' '}
          of <span className="font-bold text-foreground">{totalCount}</span> theatres
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && currentPage > 3) {
                pageNum = currentPage - 3 + i;
              }
              if (pageNum > totalPages) return null;

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className="h-8 w-8 p-0 text-xs"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
