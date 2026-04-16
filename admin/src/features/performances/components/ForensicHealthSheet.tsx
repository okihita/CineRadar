'use client';

import React from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    ShieldCheck, 
    XCircle, 
    AlertTriangle, 
    Search,
    Database,
    Calendar,
    Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiagnosticItem {
    id: string;
    title: string;
    has_metadata: boolean;
    has_performance: boolean;
    has_schedule: boolean;
    showtimes_count: number;
}

interface ForensicHealthSheetProps {
    diagnostic: {
        total_discovered: number;
        active_count: number;
        scheduled_count: number;
        items: DiagnosticItem[];
    };
}

/**
 * Data Integrity Audit Panel
 * 
 * Uses Dialog as a functional replacement for Sheet.
 */
export function ForensicHealthSheet({ diagnostic }: ForensicHealthSheetProps) {
    const [search, setSearch] = React.useState('');

    const filteredItems = React.useMemo(() => {
        if (!search) return diagnostic.items;
        return diagnostic.items.filter(item => 
            item.title.toLowerCase().includes(search.toLowerCase()) || 
            item.id.includes(search)
        );
    }, [diagnostic.items, search]);

    const mismatches = diagnostic.scheduled_count - diagnostic.active_count;

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 gap-1.5 text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
                >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Audit Health</span>
                    {mismatches > 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-hidden flex flex-col p-0 border-primary/20 shadow-2xl">
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <DialogHeader className="mb-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-primary/10 rounded-2xl shadow-sm border border-primary/10">
                                <ShieldCheck className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Data Integrity Audit</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
                                    Real-time Firestore Sync Status
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="p-4 bg-muted/30 rounded-2xl border border-border/50 shadow-inner">
                            <p className="text-[8px] font-black text-muted-foreground uppercase mb-1.5 tracking-wider">Scheduled</p>
                            <p className="text-2xl font-black font-mono leading-none">{diagnostic.scheduled_count}</p>
                        </div>
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 shadow-inner">
                            <p className="text-[8px] font-black text-primary/60 uppercase mb-1.5 tracking-wider">In Dashboard</p>
                            <p className="text-2xl font-black font-mono leading-none text-primary">{diagnostic.active_count}</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-2xl border border-border/50 shadow-inner">
                            <p className="text-[8px] font-black text-muted-foreground uppercase mb-1.5 tracking-wider">Mismatches</p>
                            <p className={cn(
                                "text-2xl font-black font-mono leading-none",
                                mismatches > 0 ? "text-amber-500" : "text-green-500"
                            )}>
                                {mismatches}
                            </p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative mb-6">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <input 
                            type="text"
                            placeholder="Search by title or ID..."
                            className="w-full h-11 pl-11 pr-4 bg-muted/20 border border-border/50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold placeholder:font-medium"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Audit List */}
                    <div className="space-y-3">
                        {filteredItems.map((item) => {
                            const isSynced = item.has_metadata && (item.has_performance || item.showtimes_count > 0);

                            return (
                                <div 
                                    key={item.id}
                                    className={cn(
                                        "p-4 rounded-2xl border transition-all flex flex-col gap-3",
                                        isSynced ? "bg-background border-border/40 shadow-sm" : "bg-muted/5 border-dashed"
                                    )}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-black uppercase truncate pr-2 tracking-tight leading-none mb-1.5" title={item.title}>
                                                {item.title}
                                            </h4>
                                            <p className="text-[10px] font-mono font-bold text-muted-foreground/40 tracking-tighter">{item.id}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {isSynced ? (
                                                <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-[9px] font-black uppercase border-green-500/20 px-2">Synced</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-amber-600 text-[9px] font-black uppercase border-amber-500/20 animate-pulse px-2">Pending</Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <StatusPill 
                                            label="Schedule" 
                                            active={item.has_schedule} 
                                            icon={<Calendar className="w-3 h-3" />} 
                                        />
                                        <StatusPill 
                                            label="Metadata" 
                                            active={item.has_metadata} 
                                            icon={<Database className="w-3 h-3" />} 
                                        />
                                        <StatusPill 
                                            label="Perform." 
                                            active={item.has_performance} 
                                            icon={<Clock className="w-3 h-3" />} 
                                        />
                                    </div>

                                    {item.has_schedule && !item.has_metadata && (
                                        <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">Awaiting Movie Scraper Enrichment</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function StatusPill({ label, active, icon }: { label: string, active: boolean, icon: React.ReactNode }) {
    return (
        <div className={cn(
            "flex items-center justify-center gap-2 py-1.5 rounded-xl border transition-all",
            active ? "bg-background border-border/60 text-foreground" : "bg-muted/10 border-dashed border-border/30 text-muted-foreground/40 grayscale"
        )}>
            {active ? <div className="text-green-500">{icon}</div> : <XCircle className="w-3 h-3" />}
            <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
        </div>
    );
}
