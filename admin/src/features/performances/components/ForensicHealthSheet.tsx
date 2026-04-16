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

/**
 * Data Integrity Audit Hub (Wide Edition)
 * 
 * Optimized for 10/10 clarity with explicit labels and maximum horizontal real estate.
 */
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
            <DialogContent className="sm:max-w-[1100px] max-h-[85vh] overflow-hidden flex flex-col p-0 border-primary/20 shadow-2xl">
                <div className="p-8 overflow-y-auto custom-scrollbar bg-background/95">
                    
                    {/* HEADER HUB */}
                    <DialogHeader className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-border/40 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl shadow-sm border border-primary/10">
                                <ShieldCheck className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-3xl font-black uppercase tracking-tighter">Forensic Sync Audit</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
                                    Full Market Registry • Firestore V2 Verification
                                </DialogDescription>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-6">
                            <div className="flex items-center gap-6 pr-6 border-r border-border/30">
                                <StatItem label="Scheduled" value={diagnostic.scheduled_count} color="text-foreground" />
                                <StatItem label="Dashboard" value={diagnostic.active_count} color="text-primary" />
                                <StatItem label="Mismatch" value={mismatches} color={mismatches > 0 ? "text-amber-500" : "text-green-500"} />
                            </div>

                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer group bg-muted/20 px-3 py-2 rounded-xl border border-border/40 hover:border-primary/30 transition-all">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground group-hover:text-primary transition-colors">Scheduled Only</span>
                                    <input 
                                        type="checkbox" 
                                        checked={showScheduledOnly} 
                                        onChange={(e) => setShowScheduledOnly(e.target.checked)}
                                        className="w-4 h-4 rounded border-border/60 text-primary focus:ring-primary/20 bg-background"
                                    />
                                </label>
                                <div className="relative w-[280px]">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                                    <input 
                                        type="text"
                                        placeholder="Search Registry..."
                                        className="w-full h-10 pl-11 pr-4 bg-muted/20 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* TABLE HEADERS (Only visible on wide screens) */}
                    <div className="grid grid-cols-[50px_1fr_180px_180px_220px_180px] gap-4 px-4 mb-3 uppercase text-[9px] font-black tracking-[0.2em] text-muted-foreground/40">
                        <div>#</div>
                        <div>Movie Identity</div>
                        <div className="text-center">Pipeline Status</div>
                        <div className="text-center">Integrity Issues</div>
                        <div>Internal Application Links</div>
                        <div className="text-right">Firestore Registry</div>
                    </div>

                    {/* Audit List - The Wide Strips */}
                    <div className="space-y-1.5">
                        {filteredItems.map((item, idx) => {
                            const isSynced = item.has_metadata && (item.has_performance || item.showtimes_count > 0);
                            const isScheduledButMissing = item.has_schedule && !isSynced;

                            return (
                                <div 
                                    key={item.id}
                                    className={cn(
                                        "px-4 py-3 rounded-2xl border transition-all flex items-center gap-4 group",
                                        isSynced ? "bg-background border-border/40 hover:border-primary/40 shadow-sm" : "bg-muted/5 border-dashed border-border/30",
                                        isScheduledButMissing && "border-amber-500/40 bg-amber-500/[0.03]"
                                    )}
                                >
                                    {/* 1. Index */}
                                    <span className="text-xs font-black font-mono text-muted-foreground/20 w-8">{idx + 1}.</span>

                                    {/* 2. Identity Block */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-xs font-black uppercase truncate tracking-tight group-hover:text-primary transition-colors leading-none" title={item.title}>
                                                {item.title}
                                            </h4>
                                            {item.has_schedule && (
                                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 text-blue-600 rounded text-[7px] font-black uppercase tracking-widest border border-blue-500/10">
                                                    Live Today
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[9px] font-mono font-bold text-muted-foreground/30 tracking-tighter">{item.id}</p>
                                    </div>

                                    {/* 3. Status Matrix */}
                                    <div className="flex items-center gap-1.5 w-[180px] justify-center">
                                        <StatusPillWide active={item.has_schedule} label="Schedule" />
                                        <StatusPillWide active={item.has_metadata} label="Metadata" />
                                        <StatusPillWide active={item.has_performance} label="Perform." />
                                    </div>

                                    {/* 4. Reason (If Mismatch) */}
                                    <div className="w-[180px] px-2">
                                        {isScheduledButMissing && (
                                            <div className="flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                                <span className="text-[9px] font-black text-amber-600 uppercase leading-tight tracking-tighter">
                                                    {!item.has_metadata ? "Wait: Scraper" : "Wait: Aggregator"}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 5. APP NAVIGATION */}
                                    <div className="flex items-center gap-2 w-[220px] border-l border-border/30 pl-4">
                                        <Button variant="outline" size="sm" className="h-8 gap-2 text-[9px] font-black uppercase px-3 border-border/60 hover:border-blue-500 hover:text-blue-500 bg-background shadow-sm" asChild>
                                            <Link href={`/schedules/${today}`}>
                                                <Calendar className="w-3 h-3" />
                                                Daily Sched
                                            </Link>
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className={cn(
                                                "h-8 gap-2 text-[9px] font-black uppercase px-3 border-border/60 bg-background shadow-sm",
                                                isSynced ? "hover:border-primary hover:text-primary" : "opacity-20 pointer-events-none"
                                            )} 
                                            asChild
                                        >
                                            <Link href={`/performances/${item.id}`}>
                                                <BarChart3 className="w-3 h-3" />
                                                Box Office
                                            </Link>
                                        </Button>
                                    </div>

                                    {/* 6. CLOUD CONSOLE LINKS */}
                                    <div className="flex items-center gap-2 w-[180px] border-l border-border/30 pl-4 justify-end">
                                        <a 
                                            href={`https://console.firebase.google.com/project/cineradar-481014/firestore/databases/-default-/data/~2Fschedules_v2~2F${today}~2Fmovies~2F${item.id}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="p-2 bg-muted/30 hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600 rounded-lg transition-all border border-transparent hover:border-amber-500/20"
                                            title="Firestore: Schedule"
                                        >
                                            <Database className="w-4 h-4" />
                                        </a>
                                        <a 
                                            href={`https://console.firebase.google.com/project/cineradar-481014/firestore/databases/-default-/data/~2Fmovie_performance_v2~2F${item.id}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="p-2 bg-muted/30 hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600 rounded-lg transition-all border border-transparent hover:border-amber-500/20"
                                            title="Firestore: Performance"
                                        >
                                            <Layers className="w-4 h-4" />
                                        </a>
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

function StatItem({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">{label}</span>
            <span className={cn("text-xl font-black font-mono leading-none", color)}>{value}</span>
        </div>
    );
}

function StatusPillWide({ active, label }: { active: boolean, label: string }) {
    return (
        <div className={cn(
            "flex items-center gap-2 px-2.5 py-1 rounded-lg border text-[8px] font-black uppercase tracking-tighter transition-all",
            active ? "bg-green-500/10 border-green-500/20 text-green-600" : "bg-muted/10 border-border/30 text-muted-foreground/30 grayscale"
        )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-green-500 animate-pulse" : "bg-muted-foreground/20")} />
            {label}
        </div>
    );
}
