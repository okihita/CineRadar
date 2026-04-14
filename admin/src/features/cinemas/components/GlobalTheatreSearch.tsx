'use client';

import React from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GlobalTheatreSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    isLoading?: boolean;
    resultsCount?: number;
}

export function GlobalTheatreSearch({
    value,
    onChange,
    placeholder = "Search 502 national assets by name, city, or ID...",
    isLoading = false,
    resultsCount
}: GlobalTheatreSearchProps) {
    return (
        <div className="relative group w-full">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                {isLoading ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : (
                    <Search className="h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                )}
            </div>
            
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={cn(
                    "block w-full pl-11 pr-24 py-3 bg-card border-border shadow-sm rounded-xl text-sm transition-all focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none",
                    value && "border-primary/30 bg-primary/[0.01]"
                )}
            />

            <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-2">
                {value && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onChange('')}
                        className="h-7 w-7 p-0 rounded-full hover:bg-muted"
                    >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                )}
                
                {resultsCount !== undefined && (
                    <div className="px-2 py-1 rounded bg-muted/50 border border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-tighter tabular-nums">
                        {resultsCount} Matches
                    </div>
                )}
            </div>
        </div>
    );
}
