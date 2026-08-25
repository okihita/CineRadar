'use client';

import { Clock } from 'lucide-react';

interface UpdateTimerProps {
    lastSweptAt: string;
    variant?: 'pill' | 'minimal';
    showNextUpdate?: boolean;
}

export function UpdateTimer({ lastSweptAt, variant = 'pill', showNextUpdate = true }: UpdateTimerProps) {
    if (!lastSweptAt) return null;

    const lastUpdate = new Date(lastSweptAt);
    const nextUpdate = new Date(lastUpdate.getTime() + 30 * 60 * 1000);

    const formatToWIB = (date: Date) => {
        try {
            return new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Jakarta',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).format(date);
        } catch {
            return date.toLocaleTimeString('en-GB', { hour12: false });
        }
    };

    if (variant === 'minimal') {
        return (
            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 border-l border-border/40 pl-3 ml-1">
                <div className="flex items-center gap-1.5">
                    <Clock className="w-2.5 h-2.5 text-primary opacity-50" />
                    <span>Updated</span>
                    <span className="font-mono text-foreground tracking-tighter">{formatToWIB(lastUpdate)}</span>
                </div>
                {showNextUpdate && (
                    <>
                        <div className="w-1 h-1 rounded-full bg-border/40" />
                        <div className="flex items-center gap-1.5">
                            <span>Next</span>
                            <span className="font-mono text-primary tracking-tighter">{formatToWIB(nextUpdate)}</span>
                        </div>
                    </>
                )}
                <span className="text-[7px] opacity-30">WIB</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4 bg-muted/30 px-3 py-1.5 rounded-full border border-border/40 shadow-sm animate-in fade-in slide-in-from-top-2 duration-700">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                <Clock className="w-3 h-3 text-primary animate-pulse" />
                <span>Last Updated</span>
                <div className="flex items-baseline gap-1">
                    <span className="font-mono text-[11px] text-foreground font-bold tracking-tighter">
                        {formatToWIB(lastUpdate)}
                    </span>
                    <span className="text-[8px] opacity-40 font-bold">WIB</span>
                </div>
            </div>
            
            {showNextUpdate && (
                <>
                    <div className="w-px h-2.5 bg-border/60" />
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                        <span>Next Update</span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono text-[11px] text-primary font-bold tracking-tighter">
                                {formatToWIB(nextUpdate)}
                            </span>
                            <span className="text-[8px] opacity-40 font-bold">WIB</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
