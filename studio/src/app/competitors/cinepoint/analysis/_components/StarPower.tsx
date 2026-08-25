'use client';

import Link from 'next/link';
import { Star, Clapperboard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatAdm } from '@/lib/cinepoint';
import type { FactorState, PersonRanking } from '@/lib/cinepoint';

interface StarPowerProps {
  factors: FactorState;
  directorRankings: PersonRanking[];
  actorRankings: PersonRanking[];
}

export function StarPower({ factors, directorRankings, actorRankings }: StarPowerProps) {
  if (!factors.director && !factors.actor) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {factors.director && (
        <Card>
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-amber-500" /> Top Directors
              <Link href="/competitors/cinepoint/analysis/directors" className="ml-auto text-sm font-bold text-primary hover:underline normal-case tracking-normal">
                View all →
              </Link>
            </CardTitle>
            <CardDescription className="text-sm">Min 3 movies, by avg admissions</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <PersonTable rankings={directorRankings} />
          </CardContent>
        </Card>
      )}
      {factors.actor && (
        <Card>
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Star className="w-4 h-4 text-indigo-500" /> Top Actors
              <Link href="/competitors/cinepoint/analysis/actors" className="ml-auto text-sm font-bold text-primary hover:underline normal-case tracking-normal">
                View all →
              </Link>
            </CardTitle>
            <CardDescription className="text-sm">Min 5 movies, by avg admissions</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <PersonTable rankings={actorRankings} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PersonTable({ rankings }: { rankings: PersonRanking[] }) {
  return (
    <div className="overflow-auto max-h-[500px]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-background z-10">
          <tr className="border-b text-sm font-black uppercase tracking-widest text-muted-foreground/50">
            <th className="p-2 text-left w-8">#</th>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-right">Movies</th>
            <th className="p-2 text-right">Avg</th>
            <th className="p-2 text-left">Best Movie</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((p, i) => (
            <tr key={p.name} className="border-b last:border-0 hover:bg-muted/20">
              <td className="p-2 text-muted-foreground/30 font-mono">{i + 1}</td>
              <td className="p-2">
                <button onClick={() => { window.location.href = `/competitors/cinepoint/analysis/person/${encodeURIComponent(p.name)}`; }}
                  className="font-bold hover:text-primary transition-colors text-left cursor-pointer">
                  {p.name}
                </button>
              </td>
              <td className="p-2 text-right font-mono text-muted-foreground">{p.movie_count}</td>
              <td className="p-2 text-right font-mono font-bold">{formatAdm(p.avg_admission)}</td>
              <td className="p-2">
                {p.best_movie && (
                  <Link href={`/competitors/cinepoint/movies/${p.best_movie.id}`} className="text-sm text-primary hover:underline">
                    {p.best_movie.title}
                    <span className="text-muted-foreground ml-1 font-mono">({formatAdm(p.best_movie.total_admission)})</span>
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
