'use client';

import { format, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Swords,
  ChevronLeft,
  ChevronRight,
  Archive,
  CheckCircle2,
  Target,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { confidenceColor, confidenceIcon } from '@/lib/cinepoint';
import type { ConfidenceResult } from '@/features/competitors/types';

const ICON_MAP: Record<string, typeof CheckCircle2> = {
  CheckCircle2,
  Target,
  AlertTriangle,
};

interface DateDetailHeaderProps {
  date: string;
  confidence: ConfidenceResult | null;
  onNavigateDate: (offset: number) => void;
}

export function DateDetailHeader({ date, confidence, onNavigateDate }: DateDetailHeaderProps) {
  const router = useRouter();

  let displayDate = date;
  try {
    displayDate = format(parseISO(date), 'EEE, d MMM yyyy', { locale: enUS });
  } catch {
    /* keep raw */
  }

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link
          href="/competitors"
          className="w-9 h-9 rounded-xl border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <Swords className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black uppercase tracking-tighter">CinePoint Benchmark</h1>
            {confidence && (
              <Badge variant="outline" className={cn('text-sm h-5 px-2 gap-1 border font-bold uppercase tracking-wider', confidenceColor(confidence.level))}>
                <ConfidenceIcon level={confidence.level} />
                {confidence.score}/100
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold opacity-60">
            {displayDate}
          </p>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigateDate(-1)}
          className="h-8 w-8 p-0 rounded-xl"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigateDate(1)}
          className="h-8 w-8 p-0 rounded-xl"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/competitors/${today}`)}
          className="h-8 gap-2 px-4 text-sm font-black uppercase tracking-wider rounded-xl border-border/60 hover:bg-muted transition-all"
        >
          Today
        </Button>
        <Link href="/competitors/archive">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 px-4 text-sm font-black uppercase tracking-wider rounded-xl border-border/60 hover:bg-muted transition-all"
          >
            <Archive className="w-3.5 h-3.5" />
            Archive
          </Button>
        </Link>
      </div>
    </div>
  );
}

function ConfidenceIcon({ level }: { level: string }) {
  const iconName = confidenceIcon(level);
  if (!iconName) return null;
  const Icon = ICON_MAP[iconName];
  return Icon ? <Icon className="w-3 h-3" /> : null;
}
