'use client';

import { Film, Users, TrendingUp, BarChart3, Trophy } from 'lucide-react';
import { formatAdm } from '@/lib/cinepoint';
import type { OverviewStats } from '@/lib/cinepoint';

interface KpiRowProps {
  overview: OverviewStats;
}

export function KpiRow({ overview }: KpiRowProps) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {[
        { label: 'Total Movies', value: overview.total_movies.toLocaleString(), color: 'indigo', icon: Film },
        { label: 'Total Admissions', value: formatAdm(overview.total_admissions), color: 'emerald', icon: Users },
        { label: 'Avg per Movie', value: formatAdm(overview.avg_admission), color: 'amber', icon: TrendingUp },
        { label: 'Median', value: formatAdm(overview.median_admission), color: 'purple', icon: BarChart3 },
        { label: 'Mega Hits (≥1M)', value: String(overview.tiers.mega_hit), color: 'rose', icon: Trophy },
      ].map(({ label, value, color, icon: Icon }) => (
        <div key={label} className="px-4 py-3 rounded-xl border border-border/30 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-3.5 h-3.5 text-${color}-500`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{label}</span>
          </div>
          <p className="text-xl font-black tracking-tight">{value}</p>
        </div>
      ))}
    </div>
  );
}
