'use client';

import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  Loader2, Film, TrendingUp, Trophy, Users, BarChart3,
  ArrowDownRight, Star, ChevronRight, Crown, Popcorn,
  Calendar, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  formatAdm, LOCAL_COLOR, INTL_COLOR, CHART_COLORS,
} from '@/lib/cinepoint';
import { PageLoader } from '@/components/cinepoint/PageShell';
import { useBoxOfficeData, RANGE_PRESETS } from './_components/useBoxOfficeData';
import type { RangePreset } from './_components/useBoxOfficeData';
import { MovieDetailPanel, MetaChip } from './_components/MovieDetailPanel';
import { HallOfFameTab } from './_components/HallOfFameTab';

// ─── Page (Thin Orchestrator) ────────────────────────────────

export default function CinePointInsightsPage() {
  const {
    data, yearsData, loading, yearsLoading, range, setRange,
    selectedMovie, setSelectedMovie, enrichedMovie, enrichedLoading,
    loadData, loadYears,
  } = useBoxOfficeData();

  const localTotal = data?.movie_rankings.filter((m) => m.type === 'local').reduce((s, m) => s + m.total_period_admissions, 0) ?? 0;
  const intlTotal = data?.movie_rankings.filter((m) => m.type === 'international').reduce((s, m) => s + m.total_period_admissions, 0) ?? 0;

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tighter">Box Office Intelligence</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">Historical box office analytics from CinePoint data</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="dashboard" onValueChange={(v) => { if (v === 'hall-of-fame' && !yearsData) loadYears(); }}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="hall-of-fame">Hall of Fame</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-6">
          <DashboardContent
            data={data} loading={loading} range={range} setRange={setRange}
            localTotal={localTotal} intlTotal={intlTotal}
            selectedMovie={selectedMovie} setSelectedMovie={setSelectedMovie}
            enrichedMovie={enrichedMovie} enrichedLoading={enrichedLoading}
          />
        </TabsContent>

        <TabsContent value="hall-of-fame" className="space-y-6 mt-6">
          <HallOfFameTab yearsLoading={yearsLoading} yearsData={yearsData} loadYears={loadYears} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Dashboard Content ──────────────────────────────────────

interface DashboardContentProps {
  data: ReturnType<typeof useBoxOfficeData>['data'];
  loading: boolean;
  range: RangePreset;
  setRange: (r: RangePreset) => void;
  localTotal: number;
  intlTotal: number;
  selectedMovie: number | null;
  setSelectedMovie: (id: number | null) => void;
  enrichedMovie: ReturnType<typeof useBoxOfficeData>['enrichedMovie'];
  enrichedLoading: boolean;
}

function DashboardContent({
  data, loading, range, setRange,
  localTotal, intlTotal, selectedMovie, setSelectedMovie,
  enrichedMovie, enrichedLoading,
}: DashboardContentProps) {
  const meta = data?.meta;
  return (
    <>
      {/* Date range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Period</span>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {RANGE_PRESETS.map((p) => (
            <button key={p.value} onClick={() => { setRange(p.value); setSelectedMovie(null); }}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                range === p.value ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}>{p.label}</button>
          ))}
        </div>
      </div>

      {loading && <PageLoader />}

      {!loading && (!data || !data.has_data) && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed rounded-xl bg-muted/5">
          <Film className="w-12 h-12 text-muted-foreground/20" />
          <p className="text-muted-foreground font-medium">No box office data yet</p>
          {data?.sync_meta && (
            <p className="text-xs text-muted-foreground">Backfill: {data.sync_meta.status} · {data.sync_meta.dates_scraped} dates · {data.sync_meta.docs_written?.toLocaleString()} docs</p>
          )}
        </div>
      )}

      {!loading && data && data.has_data && meta && (
        <>
          <KpiCards meta={meta} />
          <ChartsRow data={data} localTotal={localTotal} intlTotal={intlTotal} />
          <GenreAndDay data={data} />
          <Top10Chart data={data} />
          <MovieDrillDown
            data={data} selectedMovie={selectedMovie} setSelectedMovie={setSelectedMovie}
            enrichedMovie={enrichedMovie} enrichedLoading={enrichedLoading}
          />
          <FullRankings data={data} selectedMovie={selectedMovie} setSelectedMovie={setSelectedMovie} />
        </>
      )}
    </>
  );
}

// ─── Sub-sections ────────────────────────────────────────────

function KpiCards({ meta }: { meta: NonNullable<ReturnType<typeof useBoxOfficeData>['data']>['meta'] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-500/10 rounded-lg"><Users className="w-5 h-5 text-indigo-500" /></div>
        <div><p className="text-2xl font-black">{meta.grand_total_admissions.toLocaleString()}</p><p className="text-xs text-muted-foreground font-medium">Total Admissions</p><p className="text-[10px] text-muted-foreground/60">{meta.avg_daily_admissions.toLocaleString()}/day avg</p></div>
      </div></CardContent></Card>
      <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/10 rounded-lg"><Film className="w-5 h-5 text-purple-500" /></div>
        <div><p className="text-2xl font-black">{meta.unique_movies}</p><p className="text-xs text-muted-foreground font-medium">Unique Movies</p><p className="text-[10px] text-muted-foreground/60">{meta.days_with_data} days tracked</p></div>
      </div></CardContent></Card>
      <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500/10 rounded-lg"><Trophy className="w-5 h-5 text-amber-500" /></div>
        <div><p className="text-2xl font-black">{meta.peak_day?.admissions?.toLocaleString() ?? '-'}</p><p className="text-xs text-muted-foreground font-medium">Peak Day</p><p className="text-[10px] text-muted-foreground/60">{meta.peak_day?.date ? format(parseISO(meta.peak_day.date), 'EEE, MMM d') : '-'}</p></div>
      </div></CardContent></Card>
      <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-500/10 rounded-lg"><Crown className="w-5 h-5 text-emerald-500" /></div>
        <div><p className="text-2xl font-black">{meta.top_movie?.total_period_admissions?.toLocaleString() ?? '-'}</p><p className="text-xs text-muted-foreground font-medium">Top Movie</p><p className="text-[10px] text-muted-foreground/60 truncate max-w-[140px]">{meta.top_movie?.title ?? '-'}</p></div>
      </div></CardContent></Card>
    </div>
  );
}

function ChartsRow({ data, localTotal, intlTotal }: { data: NonNullable<ReturnType<typeof useBoxOfficeData>['data']>; localTotal: number; intlTotal: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Daily Admissions</CardTitle>
          <CardDescription>Local vs International</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.daily_totals}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
              <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(String(v)), 'MMM d')} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatAdm(Number(v))} />
              <Tooltip labelFormatter={(v) => format(parseISO(String(v)), 'EEE, MMM d, yyyy')} formatter={(v) => Number(v).toLocaleString()} />
              <Area type="monotone" dataKey="local_admissions" stackId="1" stroke={LOCAL_COLOR} fill={LOCAL_COLOR} fillOpacity={0.5} name="Local" />
              <Area type="monotone" dataKey="international_admissions" stackId="1" stroke={INTL_COLOR} fill={INTL_COLOR} fillOpacity={0.5} name="International" />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Market Share</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={[{ name: 'Local', value: localTotal }, { name: 'International', value: intlTotal }]}
                  cx="50%" cy="50%" outerRadius={70} innerRadius={45} dataKey="value"
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  <Cell fill={LOCAL_COLOR} /><Cell fill={INTL_COLOR} />
                </Pie>
                <Tooltip formatter={(v) => Number(v).toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LOCAL_COLOR }} /> Local</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: INTL_COLOR }} /> Intl</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GenreAndDay({ data }: { data: NonNullable<ReturnType<typeof useBoxOfficeData>['data']> }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {data.genre_breakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-500" /> Genre Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.genre_breakdown.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatAdm(Number(v))} />
                <YAxis type="category" dataKey="genre" width={90} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                <Bar dataKey="admissions" name="Admissions" radius={[0, 4, 4, 0]}>
                  {data.genre_breakdown.slice(0, 8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
      {data.day_of_week.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-500" /> Day-of-Week</CardTitle>
            <CardDescription>Average daily admissions by weekday</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.day_of_week}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatAdm(Number(v))} />
                <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                <Bar dataKey="avg_admissions" name="Avg Admissions" radius={[4, 4, 0, 0]} fill="#6366f1" fillOpacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Top10Chart({ data }: { data: NonNullable<ReturnType<typeof useBoxOfficeData>['data']> }) {
  return (
    <Card>
      <CardHeader className="pb-3 border-b"><CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Top 10 Movies</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data.movie_rankings.slice(0, 10).map((m) => ({ title: m.title.length > 22 ? m.title.slice(0, 22) + '…' : m.title, admissions: m.total_period_admissions, type: m.type }))} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatAdm(Number(v))} />
            <YAxis type="category" dataKey="title" width={160} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => Number(v).toLocaleString()} />
            <Bar dataKey="admissions" name="Admissions" radius={[0, 4, 4, 0]}>
              {data.movie_rankings.slice(0, 10).map((m, i) => <Cell key={i} fill={m.type === 'local' ? LOCAL_COLOR : INTL_COLOR} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function MovieDrillDown({
  data, selectedMovie, setSelectedMovie, enrichedMovie, enrichedLoading,
}: {
  data: NonNullable<ReturnType<typeof useBoxOfficeData>['data']>;
  selectedMovie: number | null;
  setSelectedMovie: (id: number | null) => void;
  enrichedMovie: ReturnType<typeof useBoxOfficeData>['enrichedMovie'];
  enrichedLoading: boolean;
}) {
  if (!selectedMovie) return null;
  const movie = data.movie_rankings.find((m) => m.id === selectedMovie);
  if (!movie) return null;

  // Week bucket computation
  const weekBuckets = new Map<number, { total: number }>();
  for (const d of movie.daily) {
    const weekNum = Math.floor((new Date(d.date).getTime() - new Date(movie.daily[0].date).getTime()) / (7 * 86400000));
    const existing = weekBuckets.get(weekNum);
    if (existing) existing.total += d.admission;
    else weekBuckets.set(weekNum, { total: d.admission });
  }
  const weeklyTotals = [...weekBuckets.entries()].sort(([a], [b]) => a - b).map(([w, { total }]) => ({ week: `W${w + 1}`, admissions: total }));
  const wowDrop = weeklyTotals.length >= 2 ? (((weeklyTotals[0].admissions - weeklyTotals[1].admissions) / weeklyTotals[0].admissions) * 100).toFixed(1) : null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">{movie.title}</CardTitle>
            <button onClick={() => setSelectedMovie(null)} className="text-xs text-muted-foreground hover:text-foreground">✕ Close</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="outline" className={movie.type === 'local' ? 'border-indigo-500/30 text-indigo-600' : 'border-amber-500/30 text-amber-600'}>
              {movie.type === 'local' ? 'Local' : 'International'}
            </Badge>
            <MetaChip icon={<Star className="w-3 h-3" />} value={`${movie.latest_score.toFixed(1)} score`} />
            <MetaChip icon={<Users className="w-3 h-3" />} value={`${movie.latest_total_admission.toLocaleString()} lifetime`} />
            <MetaChip icon={<Popcorn className="w-3 h-3" />} value={`${movie.peak_admission.toLocaleString()} peak`} />
            {wowDrop !== null && (
              <MetaChip icon={Number(wowDrop) > 0 ? <TrendingUp className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                value={`W1→W2: ${wowDrop}%`} className={Number(wowDrop) > 0 ? 'text-green-600' : 'text-red-600'} />
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={movie.daily}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(String(v)), 'MMM d')} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => formatAdm(Number(v))} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} reversed domain={[1, 'auto']} />
                <Tooltip labelFormatter={(v) => format(parseISO(String(v)), 'EEE, MMM d')} formatter={(v, name) => name === 'Rank' ? `#${v}` : Number(v).toLocaleString()} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="admission" stroke="#6366f1" strokeWidth={2} name="Admissions" dot={{ r: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="rank" stroke="#f59e0b" strokeWidth={1.5} name="Rank" strokeDasharray="4 4" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {movie.daily.length > 1 && (
            <div className="border-t px-6 pb-6 pt-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Cumulative Admissions</p>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={movie.daily}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(String(v)), 'MMM d')} tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => formatAdm(Number(v))} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                  <Area type="monotone" dataKey="total_admission" stroke="#10b981" fill="#10b981" fillOpacity={0.12} name="Cumulative" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      {enrichedLoading && (
        <Card><CardContent className="flex items-center justify-center py-12 gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading movie details…</span>
        </CardContent></Card>
      )}
      {!enrichedLoading && enrichedMovie && <MovieDetailPanel movie={enrichedMovie} />}
    </>
  );
}

function FullRankings({ data, selectedMovie, setSelectedMovie }: {
  data: NonNullable<ReturnType<typeof useBoxOfficeData>['data']>;
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
