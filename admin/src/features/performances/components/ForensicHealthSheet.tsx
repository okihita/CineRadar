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
import { 
    ShieldCheck, 
    AlertTriangle, 
    Search,
    Database,
    Calendar,
    BarChart3,
    Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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

export function ForensicHealthSheet({ diagnostic }: ForensicHealthSheetProps) {
    const [search, setSearch] = React.useState('');
    const [showScheduledOnly, setShowScheduledOnly] = React.useState(true);
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

    const filteredItems = React.useMemo(() => {
        let items = diagnostic.items;
        if (showScheduledOnly) {
            items = items.filter(item => item.has_schedule);
        }
        if (search) {
            const lowSearch = search.toLowerCase();
            items = items.filter(item => 
                item.title.toLowerCase().includes(lowSearch) || 
                item.id.includes(lowSearch)
            );
        }
        return items;
    }, [diagnostic.items, search, showScheduledOnly]);

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
            <DialogContent className="sm:max-w-[950px] max-h-[90vh] overflow-hidden flex flex-col p-0 border-primary/20 shadow-2xl">
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <DialogHeader className="mb-6 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-2xl shadow-sm border border-primary/10">
                                <ShieldCheck className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Data Integrity Audit</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
                                    Forensic Command Center • Firestore V2 Registry
                                </DialogDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 bg-muted/20 p-1 rounded-xl border border-border/40">
                            <label className="flex items-center gap-2 cursor-pointer group px-3 py-1">
                                <span className="text-[9px] font-black uppercase text-muted-foreground group-hover:text-primary transition-colors">Active Only</span>
                                <input 
                                    type="checkbox" 
                                    checked={showScheduledOnly} 
                                    onChange={(e) => setShowScheduledOnly(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-border/60 text-primary focus:ring-primary/20 bg-muted/20"
                                />
                            </label>
                            <div className="relative w-[240px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                                <input 
                                    type="text"
                                    placeholder="Filter by ID or Movie Title..."
                                    className="w-full h-8 pl-9 pr-3 bg-background border border-border/50 rounded-lg text-[10px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Summary Stats - High Density */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="flex items-center justify-between p-3 bg-zinc-900/5 dark:bg-white/5 rounded-xl border border-border/40">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Scheduled Today</span>
                                <span className="text-xl font-black font-mono leading-none mt-1">{diagnostic.scheduled_count}</span>
                            </div>
                            <Calendar className="w-8 h-8 text-blue-500/20" />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/10 shadow-sm">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest">Dashboard Sync</span>
                                <span className="text-xl font-black font-mono leading-none mt-1 text-primary">{diagnostic.active_count}</span>
                            </div>
                            <ShieldCheck className="w-8 h-8 text-primary/20" />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-zinc-900/5 dark:bg-white/5 rounded-xl border border-border/40">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Missing Records</span>
                                <span className={cn(
                                    "text-xl font-black font-mono leading-none mt-1",
                                    mismatches > 0 ? "text-amber-500" : "text-green-500"
                                )}>{mismatches}</span>
                            </div>
                            <AlertTriangle className={cn("w-8 h-8", mismatches > 0 ? "text-amber-500/20" : "text-green-500/20")} />
                        </div>
                    </div>

                    {/* Audit List - Ultra High Density Strip */}
                    <div className="space-y-1">
                        {filteredItems.map((item, idx) => {
                            const isSynced = item.has_metadata && (item.has_performance || item.showtimes_count > 0);
                            const isScheduledButMissing = item.has_schedule && !isSynced;

                            return (
                                <div 
                                    key={item.id}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg border transition-all flex items-center gap-4 group",
                                        isSynced ? "bg-background border-border/30 hover:border-primary/30 shadow-sm" : "bg-muted/5 border-dashed",
                                        isScheduledButMissing && "border-amber-500/40 bg-amber-500/[0.01]"
                                    )}
                                >
                                    {/* 1. Index & Today Badge */}
                                    <div className="flex items-center gap-3 w-[70px] flex-shrink-0">
                                        <span className="text-[10px] font-black font-mono text-muted-foreground/30 w-6">{idx + 1}.</span>
                                        {item.has_schedule ? (
                                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" title="Active in today's schedule" />
                                        ) : (
                                            <div className="w-2 h-2 rounded-full bg-muted border border-border" />
                                        )}
                                    </div>

                                    {/* 2. Identity Block */}
                                    <div className="w-1/3 min-w-0">
                                        <h4 className="text-[11px] font-black uppercase truncate tracking-tight group-hover:text-primary transition-colors leading-none mb-0.5" title={item.title}>
                                            {item.title}
                                        </h4>
                                        <p className="text-[8px] font-mono font-bold text-muted-foreground/30 tracking-tighter">{item.id}</p>
                                    </div>

                                    {/* 3. Status Matrix */}
                                    <div className="flex items-center gap-1 w-[120px] justify-center">
                                        <StatusDot active={item.has_schedule} label="SCH" />
                                        <StatusDot active={item.has_metadata} label="MET" />
                                        <StatusDot active={item.has_performance} label="PER" />
                                    </div>

                                    {/* 4. Reason (If Mismatch) */}
                                    <div className="flex-1 px-4 min-w-[150px]">
                                        {isScheduledButMissing && (
                                            <div className="flex items-center gap-1.5 opacity-80">
                                                <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                                <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter truncate">
                                                    {!item.has_metadata ? "Wait: Metadata Scraper" : "Wait: Perf. Aggregator"}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 5. APP NAVIGATION */}
                                    <div className="flex items-center gap-1 border-l border-border/40 pl-4 w-[160px] justify-end">
                                        <Button variant="ghost" size="sm" className="h-7 w-8 p-0 text-muted-foreground hover:text-blue-500" title="Internal Schedule" asChild>
                                            <Link href={`/schedules/${today}`}><Calendar className="w-3.5 h-3.5" /></Link>
                                        </Button>
                                        <Button variant="ghost" size="sm" className={cn("h-7 w-8 p-0 text-muted-foreground", isSynced ? "hover:text-primary" : "opacity-20 pointer-events-none")} title="Internal Performance" asChild>
                                            <Link href={`/performances/${item.id}`}><BarChart3 className="w-3.5 h-3.5" /></Link>
                                        </Button>
                                    </div>

                                    {/* 6. CLOUD CONSOLE LINKS */}
                                    <div className="flex items-center gap-1 border-l border-border/40 pl-4 w-[100px] justify-end">
                                        <Button variant="ghost" size="sm" className="h-7 w-8 p-0 text-muted-foreground hover:text-amber-600" title="Firestore: Schedule" asChild>
                                            <a href={`https://console.firebase.google.com/project/cineradar-481014/firestore/databases/-default-/data/~2Fschedules_v2~2F${today}~2Fmovies~2F${item.id}`} target="_blank" rel="noopener noreferrer">
                                                <Database className="w-3.5 h-3.5" />
                                            </a>
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 w-8 p-0 text-muted-foreground hover:text-amber-600" title="Firestore: Performance" asChild>
                                            <a href={`https://console.firebase.google.com/project/cineradar-481014/firestore/databases/-default-/data/~2Fmovie_performance_v2~2F${item.id}`} target="_blank" rel="noopener noreferrer">
                                                <Layers className="w-3.5 h-3.5" />
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function StatusDot({ active, label }: { active: boolean, label: string }) {
    return (
        <div 
            className={cn(
                "flex flex-col items-center justify-center w-8 h-7 rounded border transition-all",
                active ? "bg-green-500/10 border-green-500/20 text-green-600" : "bg-muted/10 border-border/30 text-muted-foreground/20"
            )}
            title={active ? `${label}: Synced` : `${label}: Pending`}
        >
            <span className="text-[7px] font-black">{label}</span>
            <div className={cn("w-1 h-1 rounded-full mt-0.5", active ? "bg-green-500" : "bg-muted-foreground/30")} />
        </div>
    );
}
