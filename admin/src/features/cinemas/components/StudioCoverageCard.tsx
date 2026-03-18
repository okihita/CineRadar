'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useStudioCoverage } from '../hooks/useStudioCoverage';
import { Database, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
        <Card className="flex flex-col">
            <CardHeader className="pb-2 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Database className="w-4 h-4 text-primary" />
                            Master Layout Coverage
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                            Physical seating capacity mapped via API
                        </CardDescription>
                    </div>
                    {isCompleted ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Complete
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Indexing
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col">
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Studios</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold">{studio_progress.percentage.toFixed(1)}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {studio_progress.scraped} / {studio_progress.total} mapped
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Theatres</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold">{theatre_progress.percentage.toFixed(1)}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {theatre_progress.fully_scraped} fully mapped
                        </p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4">
                    <div 
                        className={`h-full ${isCompleted ? 'bg-green-500' : 'bg-primary'}`} 
                        style={{ width: `${studio_progress.percentage}%` }}
                    />
                </div>

                {missing_list.length > 0 && (
                    <div className="mt-auto border-t pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-semibold text-muted-foreground">
                                Missing Studios ({missing_list.length} Theatres)
                            </h4>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-[10px] px-2"
                                onClick={() => setShowMissing(!showMissing)}
                            >
                                {showMissing ? 'Hide' : 'View Details'}
                            </Button>
                        </div>

                        {showMissing && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Search missing theatres..."
                                        className="h-8 pl-8 text-xs"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {filteredMissing.length === 0 ? (
                                        <p className="text-xs text-center text-muted-foreground py-4">No missing theatres found.</p>
                                    ) : (
                                        filteredMissing.map(theatre => (
                                            <div key={theatre.theatre_id} className="bg-secondary/20 border rounded-md p-2 text-xs">
                                                <div className="flex items-start justify-between">
                                                    <span className="font-medium truncate max-w-[150px]" title={theatre.name}>
                                                        {theatre.name}
                                                    </span>
                                                    <Badge variant="secondary" className="text-[9px] h-4 font-mono px-1">
                                                        {theatre.scraped}/{theatre.total}
                                                    </Badge>
                                                </div>
                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                    {theatre.missing_studios.map(s => (
                                                        <span key={s} className="bg-red-500/10 text-red-600 border border-red-500/20 rounded px-1.5 py-0.5 text-[9px] font-mono">
                                                            {s}
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
