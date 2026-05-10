'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import {
  Loader2, Film, TrendingUp, Trophy, Users, BarChart3,
  ArrowDownRight,
  Star, ChevronRight, Crown, Popcorn,
  Calendar, Sparkles, Flame, Languages,
  Clock, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { CinePointMovie } from '@/features/competitors/types';
import {
  formatAdm, LOCAL_COLOR, INTL_COLOR, CHART_COLORS,
  type BoxOfficeData, type MovieRanking, type YearSummary,
} from '@/lib/cinepoint';
import {
  extractCrew, MovieSynopsis, MovieCastCrew, MovieAudienceRating,
  MovieWhereToWatch, MovieTrailerCard,
} from '@/components/cinepoint/MovieDetailSections';

// ─── Constants ──────────────────────────────────────────────

type RangePreset = '7d' | '14d' | '30d' | '90d';

const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '14d', label: '14D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
];

function getPresetRange(preset: RangePreset) {
  const today = new Date();
  const to = format(today, 'yyyy-MM-dd');
  const days = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[preset];
  return { from: format(subDays(today, days), 'yyyy-MM-dd'), to };
}

// ─── Page ───────────────────────────────────────────────────

export default function CinePointInsightsPage() {
  const [data, setData] = useState<BoxOfficeData | null>(null);
  const [yearsData, setYearsData] = useState<{ success: boolean; years: YearSummary[]; total_years: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [range, setRange] = useState<RangePreset>('30d');
  const [selectedMovie, setSelectedMovie] = useState<number | null>(null);
  const [enrichedMovie, setEnrichedMovie] = useState<CinePointMovie | null>(null);
  const [enrichedLoading, setEnrichedLoading] = useState(false);

  // Load date-range analytics
  const loadData = useCallback(async (preset: RangePreset) => {
    setLoading(true);
    try {
      const { from, to } = getPresetRange(preset);
      const res = await fetch(`/api/competitors/cinepoint/boxoffice?from=${from}&to=${to}`);
      const json = await res.json();
      setData(json);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // Load yearly summaries
  const loadYears = useCallback(async () => {
    setYearsLoading(true);
    try {
      const res = await fetch('/api/competitors/cinepoint/boxoffice/years');
      const json = await res.json();
      setYearsData(json);
    } catch { /* ignore */ }
    setYearsLoading(false);
  }, []);

  useEffect(() => { loadData(range); }, [range, loadData]);

  // Fetch enriched detail when movie is selected
  useEffect(() => {
    if (selectedMovie === null) {
      setEnrichedMovie(null);
      return;
    }
    setEnrichedLoading(true);
    fetch(`/api/competitors/cinepoint/movies/${selectedMovie}/detail`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.details_fetched_at) {
          setEnrichedMovie(json.data);
        } else {
          setEnrichedMovie(null);
        }
      })
      .catch(() => setEnrichedMovie(null))
      .finally(() => setEnrichedLoading(false));
  }, [selectedMovie]);

  const meta = data?.meta;
  const localTotal = data?.movie_rankings.filter((m) => m.type === 'local').reduce((s, m) => s + m.total_period_admissions, 0) ?? 0;
  const intlTotal = data?.movie_rankings.filter((m) => m.type === 'international').reduce((s, m) => s + m.total_period_admissions, 0) ?? 0;
  const marketTotal = localTotal + intlTotal || 1;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Box Office Intelligence"
        description="Historical box office analytics from CinePoint data"
        icon={
          <div className="p-2 bg-primary/10 rounded-xl">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
        }
      />

      <Tabs defaultValue="dashboard" onValueChange={(v) => { if (v === 'hall-of-fame' && !yearsData) loadYears(); }}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="hall-of-fame">Hall of Fame</TabsTrigger>
        </TabsList>

        {/* ── DASHBOARD TAB ── */}
        <TabsContent value="dashboard" className="space-y-6 mt-6">
          {/* Date range selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Period</span>
            </div>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => { setRange(p.value); setSelectedMovie(null); }}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                    range === p.value
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {!loading && (!data || !data.has_data) && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed rounded-xl bg-muted/5">
              <Film className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-muted-foreground font-medium">No box office data yet</p>
              {data?.sync_meta && (
                <p className="text-xs text-muted-foreground">
                  Backfill: {data.sync_meta.status} · {data.sync_meta.dates_scraped} dates · {data.sync_meta.docs_written?.toLocaleString()} docs
                </p>
              )}
            </div>
          )}

          {!loading && data && data.has_data && meta && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/10 rounded-lg"><Users className="w-5 h-5 text-indigo-500" /></div>
                      <div>
                        <p className="text-2xl font-black">{meta.grand_total_admissions.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground font-medium">Total Admissions</p>
                        <p className="text-[10px] text-muted-foreground/60">{meta.avg_daily_admissions.toLocaleString()}/day avg</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg"><Film className="w-5 h-5 text-purple-500" /></div>
                      <div>
                        <p className="text-2xl font-black">{meta.unique_movies}</p>
                        <p className="text-xs text-muted-foreground font-medium">Unique Movies</p>
                        <p className="text-[10px] text-muted-foreground/60">{meta.days_with_data} days tracked</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg"><Trophy className="w-5 h-5 text-amber-500" /></div>
                      <div>
                        <p className="text-2xl font-black">{meta.peak_day?.admissions?.toLocaleString() ?? '-'}</p>
                        <p className="text-xs text-muted-foreground font-medium">Peak Day</p>
                        <p className="text-[10px] text-muted-foreground/60">{meta.peak_day?.date ? format(parseISO(meta.peak_day.date), 'EEE, MMM d') : '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg"><Crown className="w-5 h-5 text-emerald-500" /></div>
                      <div>
                        <p className="text-2xl font-black">{meta.top_movie?.total_period_admissions?.toLocaleString() ?? '-'}</p>
                        <p className="text-xs text-muted-foreground font-medium">Top Movie</p>
                        <p className="text-[10px] text-muted-foreground/60 truncate max-w-[140px]">{meta.top_movie?.title ?? '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Daily trend + Market share */}
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
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Market Share</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Local', value: localTotal },
                              { name: 'International', value: intlTotal },
                            ]}
                            cx="50%" cy="50%" outerRadius={70} innerRadius={45} dataKey="value"
                            label={({ name, percent }: { name?: string; percent?: number }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                          >
                            <Cell fill={LOCAL_COLOR} />
                            <Cell fill={INTL_COLOR} />
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

              {/* Genre breakdown + Day-of-week */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {data.genre_breakdown.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-500" /> Genre Breakdown
                      </CardTitle>
                    </CardHeader>
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
                      <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-500" /> Day-of-Week
                      </CardTitle>
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

              {/* Top 10 */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Top 10 Movies</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={data.movie_rankings.slice(0, 10).map((m) => ({
                        title: m.title.length > 22 ? m.title.slice(0, 22) + '…' : m.title,
                        admissions: m.total_period_admissions,
                        type: m.type,
                      }))}
                      layout="vertical" margin={{ left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatAdm(Number(v))} />
                      <YAxis type="category" dataKey="title" width={160} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                      <Bar dataKey="admissions" name="Admissions" radius={[0, 4, 4, 0]}>
                        {data.movie_rankings.slice(0, 10).map((m, i) => (
                          <Cell key={i} fill={m.type === 'local' ? LOCAL_COLOR : INTL_COLOR} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Selected movie drill-down */}
              {selectedMovie && (() => {
                const movie = data.movie_rankings.find((m) => m.id === selectedMovie);
                if (!movie) return null;

                const weekBuckets = new Map<number, { total: number }>();
                for (const d of movie.daily) {
                  const weekNum = Math.floor((new Date(d.date).getTime() - new Date(movie.daily[0].date).getTime()) / (7 * 86400000));
                  const existing = weekBuckets.get(weekNum);
                  if (existing) existing.total += d.admission;
                  else weekBuckets.set(weekNum, { total: d.admission });
                }
                const weeklyTotals = [...weekBuckets.entries()].sort(([a], [b]) => a - b).map(([w, { total }]) => ({ week: `W${w + 1}`, admissions: total }));
                const wowDrop = weeklyTotals.length >= 2
                  ? (((weeklyTotals[0].admissions - weeklyTotals[1].admissions) / weeklyTotals[0].admissions) * 100).toFixed(1)
                  : null;

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
                            <MetaChip
                              icon={Number(wowDrop) > 0 ? <TrendingUp className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              value={`W1→W2: ${wowDrop}%`}
                              className={Number(wowDrop) > 0 ? 'text-green-600' : 'text-red-600'}
                            />
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

                    {/* Enriched Movie Detail Panel */}
                    {enrichedLoading && (
                      <Card>
                        <CardContent className="flex items-center justify-center py-12 gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Loading movie details…</span>
                        </CardContent>
                      </Card>
                    )}
                    {!enrichedLoading && enrichedMovie && (
                      <MovieDetailPanel movie={enrichedMovie} />
                    )}
                  </>
                );
              })()}

              {/* Full rankings */}
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
                          <tr
                            key={m.id}
                            className={cn(
                              'border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer',
                              selectedMovie === m.id && 'bg-indigo-500/5',
                            )}
                            onClick={() => setSelectedMovie(selectedMovie === m.id ? null : m.id)}
                          >
                            <td className="p-4 font-mono font-bold">{m.latest_rank ?? '-'}</td>
                            <td className="p-4">
                              <p className="font-medium">{m.title}</p>
                              <p className="text-[10px] text-muted-foreground/60">{m.movie_genre.join(', ')}</p>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline" className={cn(
                                'text-[10px]',
                                m.type === 'local' ? 'border-indigo-500/20 text-indigo-600' : 'border-amber-500/20 text-amber-600',
                              )}>
                                {m.type === 'local' ? 'Local' : 'Intl'}
                              </Badge>
                            </td>
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
            </>
          )}
        </TabsContent>

        {/* ── HALL OF FAME TAB ── */}
        <TabsContent value="hall-of-fame" className="space-y-6 mt-6">
          <div className="flex items-center gap-3">
            <div className="h-4 w-1 bg-primary rounded-full" />
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">
              Best Movies by Year
            </h2>
            <span className="text-[10px] font-mono text-muted-foreground/40">
              {yearsData ? `${yearsData.total_years} years with data` : ''}
            </span>
          </div>

          {yearsLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {!yearsLoading && yearsData && yearsData.years.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed rounded-xl bg-muted/5">
              <Flame className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-muted-foreground font-medium">No yearly data yet</p>
            </div>
          )}

          {!yearsLoading && yearsData && yearsData.years.length > 0 && (
            <>
              {/* Year cards — grouped in half-decade rows */}
              {(() => {
                const reversed = [...yearsData.years].reverse();
                const groupMap = new Map<number, YearSummary[]>();
                for (const y of reversed) {
                  const mod10 = y.year % 10;
                  const decade = Math.floor(y.year / 10) * 10;
                  // Half-decades: 1-5 and 6-0 (year ending 0 is the LAST year of 6-0 group)
                  const groupStart = mod10 === 0
                    ? decade - 4    // 2000→1996, 2010→2006, 2020→2016
                    : mod10 >= 1 && mod10 <= 5
                      ? decade + 1  // 2021→2021, 2001→2001
                      : decade + 6; // 2006→2006, 2016→2016
                  if (!groupMap.has(groupStart)) groupMap.set(groupStart, []);
                  groupMap.get(groupStart)!.push(y);
                }
                const groups = [...groupMap.entries()]
                  .sort(([a], [b]) => b - a)
                  .map(([start, years]) => ({ start, end: start + 4, label: `${start}–${start + 4}`, years }));

                return (
                  <div className="space-y-6">
                    {groups.map((group) => (
                      <div key={group.start}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{group.label}</span>
                          <div className="flex-1 h-px bg-border/40" />
                        </div>
                        <div className="grid grid-cols-5 gap-4">
                          {group.years.map((y) => {
                            const isChampionLocal = y.top_movie?.type === 'local';
                            return (
                              <Card key={y.year} className="relative overflow-hidden">
                                <div className={cn('absolute top-0 left-0 right-0 h-1', isChampionLocal ? 'bg-indigo-500' : 'bg-amber-500')} />
                                <CardHeader className="pb-2">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-2xl font-black tracking-tight">{y.year}</CardTitle>
                                    <Badge variant="outline" className="text-[10px]">{y.dates_with_data}d</Badge>
                                  </div>
                                  <div className="flex gap-3 text-[10px] text-muted-foreground/60">
                                    <span>{formatAdm(y.total_admissions)}</span>
                                    <span>{y.unique_movies} movies</span>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  {y.top_movie && (
                                    <div className="flex items-start gap-2">
                                      <Crown className={cn('w-4 h-4 mt-0.5 shrink-0', isChampionLocal ? 'text-indigo-500' : 'text-amber-500')} />
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold truncate">{y.top_movie.title}</p>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                          <span className="font-mono">{y.top_movie.total_admissions.toLocaleString()}</span>
                                          <Badge variant="outline" className={cn('text-[9px] px-1 py-0', isChampionLocal ? 'border-indigo-500/20 text-indigo-600' : 'border-amber-500/20 text-amber-600')}>
                                            {y.top_movie.type === 'local' ? 'Local' : 'Intl'}
                                          </Badge>
                                        </div>
                                        {y.top_movie.movie_genre.length > 0 && (
                                          <p className="text-[10px] text-muted-foreground/40 truncate">{y.top_movie.movie_genre.join(', ')}</p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  <div className="space-y-1">
                                    <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                                      <div className="bg-indigo-500 rounded-l-full" style={{ width: `${(y.local_admissions / (y.total_admissions || 1)) * 100}%` }} />
                                      <div className="bg-amber-500 rounded-r-full" style={{ width: `${(y.international_admissions / (y.total_admissions || 1)) * 100}%` }} />
                                    </div>
                                    <div className="flex justify-between text-[9px] text-muted-foreground/50 font-mono">
                                      <span>{((y.local_admissions / (y.total_admissions || 1)) * 100).toFixed(0)}%</span>
                                      <span>{((y.international_admissions / (y.total_admissions || 1)) * 100).toFixed(0)}%</span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                                    {y.top_local && (
                                      <div className="min-w-0">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500/60">Local</p>
                                        <p className="text-[11px] font-medium truncate">{y.top_local.title}</p>
                                        <p className="text-[10px] text-muted-foreground font-mono">{formatAdm(y.top_local.total_admissions)}</p>
                                      </div>
                                    )}
                                    {y.top_international && (
                                      <div className="min-w-0">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-500/60">Intl</p>
                                        <p className="text-[11px] font-medium truncate">{y.top_international.title}</p>
                                        <p className="text-[10px] text-muted-foreground font-mono">{formatAdm(y.top_international.total_admissions)}</p>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Yearly totals table */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Yearly Overview</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                          <th className="p-4 text-left">Year</th>
                          <th className="p-4 text-left">Champion</th>
                          <th className="p-4 text-right">Total Admissions</th>
                          <th className="p-4 text-right">Local</th>
                          <th className="p-4 text-right">International</th>
                          <th className="p-4 text-right">Movies</th>
                          <th className="p-4 text-right">Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...yearsData.years].reverse().map((y) => (
                          <tr key={y.year} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="p-4 font-black">{y.year}</td>
                            <td className="p-4">
                              <p className="font-medium">{y.top_movie?.title ?? '-'}</p>
                              {y.top_movie && (
                                <Badge variant="outline" className={cn(
                                  'text-[9px] px-1 py-0 mt-1',
                                  y.top_movie.type === 'local' ? 'border-indigo-500/20 text-indigo-600' : 'border-amber-500/20 text-amber-600',
                                )}>
                                  {y.top_movie.type === 'local' ? 'Local' : 'Intl'}
                                </Badge>
                              )}
                            </td>
                            <td className="p-4 text-right font-mono font-bold">{y.total_admissions.toLocaleString()}</td>
                            <td className="p-4 text-right font-mono text-indigo-600">{y.local_admissions.toLocaleString()}</td>
                            <td className="p-4 text-right font-mono text-amber-600">{y.international_admissions.toLocaleString()}</td>
                            <td className="p-4 text-right font-mono">{y.unique_movies}</td>
                            <td className="p-4 text-right font-mono text-muted-foreground">{y.dates_with_data}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function MetaChip({ icon, value, className }: { icon: React.ReactNode; value: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1 text-[10px] text-muted-foreground', className)}>
      {icon}
      <span className="font-medium">{value}</span>
    </div>
  );
}

/** Enriched movie detail panel — shows when a movie with details_fetched_at is selected */
function MovieDetailPanel({ movie }: { movie: CinePointMovie }) {
  const { casts, directors, producers, writers, userRatings, topRating } = extractCrew(movie);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Left: Synopsis + Cast & Crew + Trailer ── */}
      <div className="lg:col-span-2 space-y-4">
        <MovieSynopsis description={movie.description} />
        <MovieCastCrew casts={casts} directors={directors} writers={writers} producers={producers} />
        {movie.trailer_url && <MovieTrailerCard url={movie.trailer_url} />}
      </div>

      {/* ── Right: Meta + Ratings + Cinema + Similar ── */}
      <div className="space-y-4">
        {/* Meta card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Movie Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {movie.language && (
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-muted-foreground/60" />
                <span className="text-xs text-muted-foreground">Language</span>
                <span className="text-sm font-medium ml-auto">{movie.language}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground/60" />
              <span className="text-xs text-muted-foreground">Duration</span>
              <span className="text-sm font-medium ml-auto">{movie.duration || '?'} min</span>
            </div>
            {movie.rating_category && movie.rating_category.length > 0 && (
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground/60" />
                <span className="text-xs text-muted-foreground">Rating</span>
                <Badge variant="outline" className="ml-auto text-xs border-red-500/30 text-red-600">
                  {movie.rating_category[0]}
                </Badge>
              </div>
            )}
            {movie.movie_rating && (movie.movie_rating.imdb || movie.movie_rating.rotten_tomatoes) && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <span className="text-xs font-bold text-amber-600">IMDb</span>
                <span className="text-sm font-mono ml-1">{movie.movie_rating.imdb ?? '—'}</span>
                <span className="text-xs font-bold text-red-600 ml-auto">RT</span>
                <span className="text-sm font-mono ml-1">{movie.movie_rating.rotten_tomatoes != null ? `${movie.movie_rating.rotten_tomatoes}%` : '—'}</span>
              </div>
            )}
            {movie.movie_genre && movie.movie_genre.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                {movie.movie_genre.map((g) => (
                  <Badge key={g} variant="secondary" className="text-[10px]">{g}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <MovieAudienceRating score={movie.score} userRatings={userRatings} topRating={topRating} />
        <MovieWhereToWatch playingAt={movie.playing_at ?? []} />

        {/* Similar movies */}
        {movie.similar_movies && movie.similar_movies.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Similar Movies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {movie.similar_movies.map((sm) => (
                <div key={sm.id} className="space-y-1">
                  <p className="text-sm font-medium">{sm.title}</p>
                  <p className="text-[11px] text-muted-foreground/60 line-clamp-2">{sm.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
