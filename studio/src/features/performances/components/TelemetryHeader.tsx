'use client';

import { useTelemetryStore } from '../stores/useTelemetryStore';
import { HardDrive, Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TelemetryHeader() {
    const { latency, payloadSize, elapsed, status } = useTelemetryStore();

    if (status === 'idle') return null;

    return (
        <div className="flex flex-col items-end justify-center px-6 py-3">
            <div className="flex items-center gap-3">
                {/* 1. Status / Latency */}
                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5">
                        {status === 'crunching' ? (
                            <>
                                <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
                                <span className="text-sm font-black uppercase tracking-widest text-amber-600/80">Crunching</span>
                            </>
                        ) : (
                            <>
                                <Zap className="w-3 h-3 text-primary fill-primary/20" />
                                <span className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">Verified</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black font-mono tracking-tighter leading-none">
                            {status === 'crunching' ? elapsed : (latency?.toFixed(2) || '0.00')}
                        </span>
                        <span className="text-sm font-bold opacity-40 uppercase">sec</span>
                    </div>
                </div>

                {/* 2. Payload (Only if completed) */}
                {status === 'completed' && payloadSize && (
                    <div className="flex flex-col items-end border-l border-border/30 pl-3">
                        <div className="flex items-center gap-1 text-muted-foreground/60">
                            <HardDrive className="w-2.5 h-2.5" />
                            <span className="text-sm font-black uppercase tracking-widest">Payload</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black font-mono tracking-tighter leading-none">
                                {payloadSize.toFixed(1)}
                            </span>
                            <span className="text-sm font-bold opacity-40 uppercase">kB</span>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Optimization Tag */}
            <div className="mt-1 flex items-center gap-1">
                <div className={cn(
                    "w-1 h-1 rounded-full",
                    status === 'crunching' ? "bg-amber-500 animate-pulse" : "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]"
                )} />
                <span className="text-sm font-black uppercase tracking-tighter text-muted-foreground/40">
                    National Forensic Masking {status === 'completed' ? 'Active' : 'Running'}
                </span>
            </div>
        </div>
    );
}
