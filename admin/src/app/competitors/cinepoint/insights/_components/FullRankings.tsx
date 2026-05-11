'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

export function FullRankings({ data, selectedMovie, setSelectedMovie }: {
  data: NonNullable<ReturnType<typeof import('./useBoxOfficeData')['useBoxOfficeData']>['data']>;
  selectedMovie: number | null;
  setSelectedMovie: (id: number | null) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">
          Full Rankings
          <span className="text-muted-foreground/60 font-normal normal-case tracking-normal ml-2">{data.movie_rankings.length} movies</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                <th className="p-4 text-left w-12">#</th>
                <th className="p-4 text-left">Movie</th>
                <th className="p-4 text-left w-20">Type</th>
                <th className="p-4 text-right">Period</th>
                <th className="p-4 text-right">Lifetime</th>
                <th className="p-4 text-right w-14">Score</th>
                <th className="p-4 text-center w-14">Days</th>
                <th className="p-4 w-6" />
              </tr>
            </thead>
            <tbody>
              {data.movie_rankings.map((m) => (
                <tr key={m.id}
                  className={cn('border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer', selectedMovie === m.id && 'bg-indigo-500/5')}
                  onClick={() => setSelectedMovie(selectedMovie === m.id ? null : m.id)}>
                  <td className="p-4 font-mono font-bold">{m.latest_rank ?? '-'}</td>
                  <td className="p-4"><p className="font-medium">{m.title}</p><p className="text-[10px] text-muted-foreground/60">{m.movie_genre.join(', ')}</p></td>
                  <td className="p-4"><Badge variant="outline" className={cn('text-[10px]', m.type === 'local' ? 'border-indigo-500/20 text-indigo-600' : 'border-amber-500/20 text-amber-600')}>{m.type === 'local' ? 'Local' : 'Intl'}</Badge></td>
                  <td className="p-4 text-right font-mono">{m.total_period_admissions.toLocaleString()}</td>
                  <td className="p-4 text-right font-mono text-muted-foreground">{m.latest_total_admission.toLocaleString()}</td>
                  <td className="p-4 text-right font-mono">{m.latest_score.toFixed(1)}</td>
                  <td className="p-4 text-center text-muted-foreground">{m.daily.length}</td>
                  <td className="p-4"><ChevronRight className="w-3 h-3 text-muted-foreground/40" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
