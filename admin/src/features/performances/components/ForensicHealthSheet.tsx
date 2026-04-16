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
    Clock,
    BarChart3
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
            <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-hidden flex flex-col p-0 border-primary/20 shadow-2xl">
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <DialogHeader className="mb-6 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-2xl shadow-sm border border-primary/10">
                                <ShieldCheck className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Data Integrity Audit</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
                                    National Forensic Pipeline Sync
                                </DialogDescription>
                            </div>
                        </div>

                        {/* Search & Filter - Inlined in Header for vertical space */}
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <span className="text-[10px] font-black uppercase text-muted-foreground group-hover:text-primary transition-colors">Scheduled Only</span>
                                <input 
                                    type="checkbox" 
                                    checked={showScheduledOnly} 
                                    onChange={(e) => setShowScheduledOnly(e.target.checked)}
                                    className="w-4 h-4 rounded border-border/60 text-primary focus:ring-primary/20 bg-muted/20"
                                />
                            </label>
                            <div className="relative w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                                <input 
                                    type="text"
                                    placeholder="Find ID or Title..."
                                    className="w-full h-8 pl-9 pr-3 bg-muted/20 border border-border/50 rounded-lg text-[10px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Summary Stats - Compressed */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Scheduled Today</span>
                            <span className="text-xl font-black font-mono leading-none">{diagnostic.scheduled_count}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/10">
                            <span className="text-[9px] font-black text-primary/60 uppercase tracking-wider">Dashboard Active</span>
                            <span className="text-xl font-black font-mono leading-none text-primary">{diagnostic.active_count}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Sync Mismatches</span>
                            <span className={cn(
                                "text-xl font-black font-mono leading-none",
                                mismatches > 0 ? "text-amber-500" : "text-green-500"
                            )}>{mismatches}</span>
                        </div>
                    </div>

                    {/* Audit List - Horizontal Density */}
                    <div className="space-y-1.5">
                        {filteredItems.map((item, idx) => {
                            const isSynced = item.has_metadata && (item.has_performance || item.showtimes_count > 0);
                            const isScheduledButMissing = item.has_schedule && !isSynced;

                            return (
                                <div 
                                    key={item.id}
                                    className={cn(
                                        "px-4 py-2 rounded-xl border transition-all flex items-center gap-4 group",
                                        isSynced ? "bg-background border-border/40" : "bg-muted/5 border-dashed",
                                        isScheduledButMissing && "border-amber-500/30 bg-amber-500/[0.02]"
                                    )}
                                >
                                    {/* Numbering */}
                                    <span className="text-[10px] font-black font-mono text-muted-foreground/30 w-5">{idx + 1}.</span>

                                    {/* Identity */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-[11px] font-black uppercase truncate tracking-tight group-hover:text-primary transition-colors" title={item.title}>
                                                {item.title}
                                            </h4>
                                            {item.has_schedule && (
                                                <Badge className="h-3.5 px-1 bg-blue-500/10 text-blue-600 border-blue-500/20 text-[7px] font-black uppercase">Today</Badge>
                                            )}
                                        </div>
                                        <p className="text-[9px] font-mono font-bold text-muted-foreground/30 tracking-tighter">{item.id}</p>
                                    </div>

                                    {/* Status Pills - Horizontal */}
                                    <div className="flex items-center gap-1.5">
                                        <StatusPillCompact active={item.has_schedule} icon={<Calendar className="w-2.5 h-2.5" />} />
                                        <StatusPillCompact active={item.has_metadata} icon={<Database className="w-2.5 h-2.5" />} />
                                        <StatusPillCompact active={item.has_performance} icon={<Clock className="w-2.5 h-2.5" />} />
                                    </div>

                                    {/* Action Links */}
                                    <div className="flex items-center gap-1.5 border-l border-border/40 pl-4">
                                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-[9px] font-black uppercase text-muted-foreground hover:text-primary" asChild>
                                            <Link href={`/schedules/${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" })}`}>
                                                <Calendar className="w-3 h-3" />
                                                Sched.
                                            </Link>
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className={cn(
                                                "h-7 gap-1 text-[9px] font-black uppercase text-muted-foreground",
                                                isSynced ? "hover:text-primary" : "opacity-30 pointer-events-none"
                                            )} 
                                            asChild
                                        >
                                            <Link href={`/performances/${item.id}`}>
                                                <BarChart3 className="w-3 h-3" />
                                                Perf.
                                            </Link>
                                        </Button>
                                    </div>

                                    {/* Reason for Mismatch */}
                                    {isScheduledButMissing && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded-lg animate-in fade-in duration-500">
                                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                                            <span className="text-[8px] font-black text-amber-700 uppercase tracking-tighter">
                                                {!item.has_metadata ? "Awaiting Metadata" : "Awaiting Aggregator"}
                                            </span>
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

function StatusPillCompact({ active, icon }: { active: boolean, icon: React.ReactNode }) {
    return (
        <div className={cn(
            "p-1 rounded-md border transition-all",
            active ? "bg-green-500/10 border-green-500/20 text-green-600" : "bg-muted/10 border-dashed border-border/30 text-muted-foreground/30 grayscale"
        )}>
            {active ? icon : <XCircle className="w-2.5 h-2.5" />}
        </div>
    );
}
