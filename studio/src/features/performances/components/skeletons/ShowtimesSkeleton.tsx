'use client';

import { useEffect } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Zap } from "lucide-react";
import { useTelemetryStore } from '../../stores/useTelemetryStore';

export function ShowtimesSkeleton() {
  const { setElapsed, setStatus, reset, elapsed } = useTelemetryStore();

  useEffect(() => {
    reset();
    setStatus('crunching');
    
    let currentSeconds = 0;
    const interval = setInterval(() => {
      currentSeconds += 1;
      setElapsed(currentSeconds);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [setElapsed, setStatus, reset]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 mt-6">
      
      {/* MAIN VISUAL SKELETON */}
      <Card className="mb-6 border-dashed bg-muted/5">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4 text-center">
            <div className="relative">
                <Zap className="w-12 h-12 text-primary/20 animate-pulse" />
                <Loader2 className="w-6 h-6 animate-spin text-primary absolute -bottom-1 -right-1" />
            </div>
            <div className="space-y-1">
                <p className="text-sm font-black uppercase tracking-widest text-foreground">
                    Assembling Forensic Market Data
                </p>
                <p className="text-xs opacity-60 max-w-[300px]">
                    CineRadar is aggregating seating snapshots from all cinema chains nationwide.
                </p>
            </div>
            
            {elapsed > 15 && (
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-tight animate-in slide-in-from-bottom-2">
                    ⚡ This is a massive blockbuster dataset. Hang tight.
                </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. TABLE STRUCTURE SKELETON */}
      <div className="rounded-xl border border-dashed border-border/60 overflow-hidden">
        <div className="bg-muted/30 p-4 border-b border-dashed flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
        </div>
        <div className="divide-y divide-dashed">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="p-4 flex items-center justify-between opacity-40" style={{ opacity: 1 - (i * 0.1) }}>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
