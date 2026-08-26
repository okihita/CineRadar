'use client';

import Link from 'next/link';
import { Swords, CalendarDays, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DashboardHeader({ today }: { today: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <Swords className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-black uppercase tracking-tighter">Competitor Intelligence</h1>
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold opacity-60">
            CinePoint Benchmark Dashboard
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link href={`/competitors/${today}`}>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 px-4 text-sm font-black uppercase tracking-wider rounded-xl border-border/60 hover:bg-muted transition-all"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Today&apos;s Detail
          </Button>
        </Link>
        <Link href="/competitors/archive">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 px-4 text-sm font-black uppercase tracking-wider rounded-xl border-border/60 hover:bg-muted transition-all"
          >
            <Archive className="w-3.5 h-3.5" />
            Tweet Archive
          </Button>
        </Link>
      </div>
    </div>
  );
}
