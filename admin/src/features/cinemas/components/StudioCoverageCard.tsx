'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useStudioCoverage } from '../hooks/useStudioCoverage';
import { Database, AlertTriangle, CheckCircle2, Search, Zap, ShieldCheck, Clock, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
    DialogDescription
} from '@/components/ui/dialog';

function StudioListDialog({ 
    title, 
    description, 
    list, 
    trigger 
}: { 
    title: string, 
    description: string, 
    list: Array<{ theatre_name: string, theatre_id: string, studio_id: string }>,
    trigger: React.ReactNode
}) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 pb-6 mt-2">
                    <div className="space-y-2">
                        {list.length === 0 ? (
                            <p className="text-center py-8 text-muted-foreground text-sm italic">No studios in this category.</p>
                        ) : (
                            [...list].sort((a, b) => a.theatre_name.localeCompare(b.theatre_name)).map((s, idx) => (
                                <div key={`${s.theatre_id}-${s.studio_id}-${idx}`} className="flex items-center justify-between p-2 rounded-md border bg-muted/20 hover:bg-muted/40 transition-colors">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[11px] font-bold truncate leading-tight">{s.theatre_name}</span>
                                        <span className="text-[10px] text-muted-foreground font-mono leading-tight">Studio {s.studio_id}</span>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] font-mono shrink-0 ml-2 px-1.5 py-0 h-4 bg-background">
                                        {s.theatre_id.slice(0, 8)}
                                    </Badge>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function StudioCoverageCard() {
    const { coverage, isLoading, isError } = useStudioCoverage();
    const [searchTerm, setSearchTerm] = useState('');
    const [showMissing, setShowMissing] = useState(false);

    if (isLoading) {
        return (
            <Card className="animate-pulse">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium h-5 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent>
                    <div className="h-8 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-1/4" />
                </CardContent>
            </Card>
        );
    }

    if (isError || !coverage) {
        return (
            <Card className="border-red-200">
                <CardContent className="pt-6 flex flex-col items-center justify-center text-red-500">
                    <AlertTriangle className="w-8 h-8 mb-2" />
                    <p className="text-sm">Failed to load coverage data</p>
                </CardContent>
            </Card>
        );
    }

    const { studio_progress, theatre_progress, missing_list } = coverage;
    const isCompleted = studio_progress.percentage >= 99;

    const filteredMissing = missing_list.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.theatre_id.includes(searchTerm)
    );

    return (
        <Card className="flex flex-col border-primary/20 shadow-md">
            <CardHeader className="pb-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Database className="w-5 h-5 text-primary" />
                            Master Layout Intelligence
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                            Tracking physical seating capacity and layout accuracy
                        </CardDescription>
                    </div>
                    {isCompleted ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Sync Complete
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                            <Clock className="w-3 h-3 mr-1 animate-pulse" />
                            Partial Sync
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-6 flex-1 flex flex-col">
                {/* Main Progress */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">Overall Studio Progress</span>
                            <span className="text-2xl font-black text-primary">{studio_progress.percentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden border">
                            <div 
                                className={`h-full transition-all duration-1000 ${isCompleted ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]'}`} 
                                style={{ width: `${studio_progress.percentage}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {studio_progress.scraped.toLocaleString()} / {studio_progress.total.toLocaleString()} total studios mapped across the network.
                        </p>
                    </div>

                    <div className="space-y-3 text-right md:text-left">
                        <div className="flex items-center justify-between md:flex-row-reverse">
                            <span className="text-sm font-semibold">Theatre Saturation</span>
                            <span className="text-2xl font-black text-primary">{theatre_progress.percentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden border">
                            <div 
                                className="h-full bg-blue-500 transition-all duration-1000" 
                                style={{ width: `${theatre_progress.percentage}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground md:text-right">
                            {theatre_progress.fully_scraped} / {theatre_progress.total} theatres have 100% studio coverage.
                        </p>
                    </div>
                </div>

                {/* Detailed Audit Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <Card className="bg-secondary/5 border-dashed">
                        <CardContent className="p-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-blue-500" />
                                Data Fidelity (V3 vs V2)
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-medium">Ground Truth (V3)</span>
                                        <Badge variant="secondary" className="text-[10px] font-mono h-4">
                                            {((studio_progress.v3_count / studio_progress.scraped) * 100).toFixed(1)}%
                                        </Badge>
                                    </div>
                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-blue-500" 
                                            style={{ width: `${(studio_progress.v3_count / studio_progress.scraped) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1.5">
                                        <span className="font-bold text-foreground">{studio_progress.v3_count}</span> studios derived from raw API layouts.
                                    </p>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <StudioListDialog 
                                           title="Guessed Snapshots (V2)"
                                           description={`${studio_progress.v2_count} studios still using legacy V2 guessed layouts.`}
                                           list={studio_progress.v2_list || []}
                                           trigger={
                                               <span className="text-xs font-medium opacity-70 hover:opacity-100 hover:text-primary cursor-pointer transition-all flex items-center gap-1 group">
                                                   Guessed Snapshots (V2)
                                                   <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                               </span>
                                           }
                                        />
                                        <span className="text-[10px] font-mono">{studio_progress.v2_count}</span>
                                    </div>

                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-amber-500 opacity-50" 
                                            style={{ width: `${(studio_progress.v2_count / studio_progress.scraped) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-secondary/5 border-dashed">
                        <CardContent className="p-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                                Verification Status
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-medium">Manually Confirmed</span>
                                        <Badge variant="secondary" className="text-[10px] font-mono h-4 bg-green-500/10 text-green-600 border-green-500/20">
                                            {((studio_progress.confirmed_count / studio_progress.scraped) * 100).toFixed(1)}%
                                        </Badge>
                                    </div>
                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-green-500" 
                                            style={{ width: `${(studio_progress.confirmed_count / studio_progress.scraped) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1.5">
                                        <span className="font-bold text-foreground">{studio_progress.confirmed_count}</span> layouts verified and locked by admin.
                                    </p>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <StudioListDialog 
                                           title="Pending Verification"
                                           description={`${studio_progress.pending_count} studios with unconfirmed physical layouts.`}
                                           list={studio_progress.pending_list || []}
                                           trigger={
                                               <span className="text-xs font-medium opacity-70 hover:opacity-100 hover:text-primary cursor-pointer transition-all flex items-center gap-1 group">
                                                   Pending Verification
                                                   <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                               </span>
                                           }
                                        />
                                        <span className="text-[10px] font-mono">{studio_progress.pending_count}</span>
                                    </div>

                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-slate-400 opacity-30" 
                                            style={{ width: `${(studio_progress.pending_count / studio_progress.scraped) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {missing_list.length > 0 && (
                    <div className="mt-auto border-t pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="space-y-0.5">
                                <h4 className="text-sm font-bold text-foreground">
                                    Remaining Gaps
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                    {missing_list.length} theatres still have unmapped studios.
                                </p>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs font-medium"
                                onClick={() => setShowMissing(!showMissing)}
                            >
                                {showMissing ? 'Hide Details' : 'View Target List'}
                            </Button>
                        </div>

                        {showMissing && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Search by theatre name or ID..."
                                        className="h-10 pl-10 text-sm"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {filteredMissing.length === 0 ? (
                                        <div className="col-span-full text-center py-12 bg-muted/10 rounded-xl border border-dashed">
                                            <p className="text-sm text-muted-foreground">No matching theatres found.</p>
                                        </div>
                                    ) : (
                                        filteredMissing.map(theatre => (
                                            <div key={theatre.theatre_id} className="bg-secondary/10 border border-border/50 rounded-xl p-3 hover:border-primary/30 transition-all group">
                                                <div className="flex items-start justify-between mb-2">
                                                    <span className="font-bold text-xs truncate mr-2" title={theatre.name}>
                                                        {theatre.name}
                                                    </span>
                                                    <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5 shrink-0">
                                                        {theatre.scraped}/{theatre.total}
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {theatre.missing_studios.map(s => (
                                                        <span key={s} className="bg-red-500/5 text-red-600 border border-red-500/10 rounded-md px-2 py-0.5 text-[10px] font-bold font-mono">
                                                            S-{s}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
