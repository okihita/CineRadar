'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Sliders, Layers, TrendingUp, Check } from 'lucide-react';

interface StreamSettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    showCircuits: boolean;
    onToggleShowCircuits: (value: boolean) => void;
    extrapolateData: boolean;
    onToggleExtrapolateData: (value: boolean) => void;
}

export function StreamSettingsModal({
    open,
    onOpenChange,
    showCircuits,
    onToggleShowCircuits,
    extrapolateData,
    onToggleExtrapolateData,
}: StreamSettingsModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <Sliders className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-lg font-bold tracking-tight">
                            Broadcast Presentation Settings
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-sm text-muted-foreground">
                        Configure display overlays and data extrapolation for live streaming.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* OPTION 1: Show/Hide Bottom Left Circuits */}
                    <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-muted/40 border border-border/60">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-background border border-border/80 text-muted-foreground mt-0.5">
                                <Layers className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-foreground">
                                    Bottom Circuit Breakdown
                                </h4>
                                <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                                    Show cinema circuit share badges (XXI, CGV, Cinépolis, FLIX) at the bottom left footer.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => onToggleShowCircuits(!showCircuits)}
                            aria-checked={showCircuits}
                            role="switch"
                            className={`
                                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                                ${showCircuits ? 'bg-primary' : 'bg-muted-foreground/30'}
                            `}
                        >
                            <span
                                className={`
                                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center
                                    ${showCircuits ? 'translate-x-5' : 'translate-x-0'}
                                `}
                            >
                                {showCircuits && <Check className="w-3 h-3 text-primary stroke-[3]" />}
                            </span>
                        </button>
                    </div>

                    {/* OPTION 2: 5-15% Extrapolation for 80% National Footprint */}
                    <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-muted/40 border border-border/60">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-background border border-border/80 text-muted-foreground mt-0.5">
                                <TrendingUp className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-sm text-foreground">
                                        National Coverage Extrapolation
                                    </h4>
                                    <span className="px-1.5 py-0.5 rounded text-sm font-mono font-black uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                        +5% - 15%
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                                    Interpolates showtimes and audience admissions with a randomized 5-15% uplift per title to account for non-TIX.ID regional and independent theaters (~80% footprint).
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => onToggleExtrapolateData(!extrapolateData)}
                            aria-checked={extrapolateData}
                            role="switch"
                            className={`
                                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                                ${extrapolateData ? 'bg-primary' : 'bg-muted-foreground/30'}
                            `}
                        >
                            <span
                                className={`
                                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center
                                    ${extrapolateData ? 'translate-x-5' : 'translate-x-0'}
                                `}
                            >
                                {extrapolateData && <Check className="w-3 h-3 text-primary stroke-[3]" />}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <span className="text-sm font-mono text-muted-foreground">
                        Press Esc to close
                    </span>
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="px-4 py-1.5 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        Done
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
