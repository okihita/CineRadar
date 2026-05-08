'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import {
  Loader2, Film, TrendingUp, Trophy, Users, BarChart3,
  ArrowUpRight, ArrowDownRight, Minus, Sparkles, CalendarDays,
  Globe, Popcorn, Calendar, Star, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────

interface DailyTotal {
  date: string;
  total_admissions: number;
  total_showtimes: number;
  movie_count: number;
  local_admissions: number;
  international_admissions: number;
}

interface MovieDaily {
  date: string;
  admission: number;
  rank: number;
  change: number;
  total_admission: number;
  showtimes: number;
  score: number;
}

interface MovieRanking {
  id: number;
  title: string;
  type: string;
  image_title: string | null;
  movie_genre: string[];
  release_date: string;
  daily: MovieDaily[];
  total_period_admissions: number;
  latest_total_admission: number;
  latest_score: number;
  latest_rank: number | null;
  peak_admission: number;
  opening_admission: number | null;
}

interface TopMover extends MovieRanking {
  rank_change: number;
  first_rank: number;
  last_rank: number;
}

interface BoxOfficeData {
  success: boolean;
  has_data: boolean;
  meta: {
    date_range: { start: string; end: string };
    days_with_data: number;
    unique_movies: number;
    grand_total_admissions: number;
    avg_daily_admissions: number;
    peak_day: { date: string; admissions: number } | null;
    top_movie: { title: string; total_period_admissions: number; latest_total_admission: number } | null;
  };
  daily_totals: DailyTotal[];
  movie_rankings: MovieRanking[];
  top_movers: TopMover[];
  genre_breakdown: { genre: string; admissions: number }[];
  day_of_week: { day: string; avg_admissions: number; total_admissions: number; days_count: number }[];
  new_releases: MovieRanking[];
  sync_meta?: {
    status: string;
    date_start: string;
    date_end: string;
    last_scraped_date: string | null;
    docs_written: number;
    dates_scraped: number;
  } | null;
}

// ─── Colors ─────────────────────────────────────────────────

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#f59e0b', '#10b981',
  '#f87171', '#38bdf8', '#fb923c', '#e879f9', '#34d399',
  '#f472b6', '#22d3ee', '#a3e635', '#fbbf24', '#6ee7b7',
];
const LOCAL_COLOR = '#6366f1';
const INTL_COLOR = '#f59e0b';
const GENRE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#f87171', '#38bdf8', '#e879f9', '#fb923c', '#34d399', '#f472b6', '#a3e635'];

// ─── Date Range Presets ─────────────────────────────────────

type RangePreset = '7d' | '14d' | '30d' | '90d' | 'all';

const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '14d', label: '14D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All' },
];

function getPresetRange(preset: RangePreset): { from: string; to: string } {
  const today = new Date();
  const to = format(today, 'yyyy-MM-dd');
  switch (preset) {
    case '7d': return { from: format(subDays(today, 7), 'yyyy-MM-dd'), to };
    case '14d': return { from: format(subDays(today, 14), 'yyyy-MM-dd'), to };
    case '30d': return { from: format(subDays(today, 30), 'yyyy-MM-dd'), to };
    case '90d': return { from: format(subDays(today, 90), 'yyyy-MM-dd'), to };
    case 'all': return { from: '2024-01-01', to };
  }
}

// ─── Component ──────────────────────────────────────────────

export default function CinePointInsightsPage() {
  const [data, setData] = useState<BoxOfficeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangePreset>('30d');
  const [selectedMovie, setSelectedMovie] = useState<number | null>(null);

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

  useEffect(() => { loadData(range); }, [range, loadData]);

  const handleRangeChange = (preset: RangePreset) => {
    setRange(preset);
    setSelectedMovie(null);
  };

  const meta = data?.meta;

  // Computed: market share percentages
  const localTotal = data?.movie_rankings
    .filter((m) => m.type === 'local')
    .reduce((s, m) => s + m.total_period_admissions, 0) ?? 0;
  const intlTotal = data?.movie_rankings
    .filter((m) => m.type === 'international')
    .reduce((s, m) => s + m.total_period_admissions, 0) ?? 0;
  const marketTotal = localTotal + intlTotal || 1;
  const localPct = ((localTotal / marketTotal) * 100).toFixed(1);
  const intlPct = ((intlTotal / marketTotal) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-500" />
            Box Office Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daily box office insights from CinePoint data stored in Firestore
          </p>
        </div>
        <div className="flex items-center gap-2">
          {meta && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {meta.date_range.start} → {meta.date_range.end} ({meta.days_with_data} days)
            </span>
          )}
          {/* Date range selector */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => handleRangeChange(p.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
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
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* No data state */}
      {!loading && (!data || !data.has_data) && (
        <div className="text-center py-20 text-muted-foreground">
          <Film className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No box office data yet</p>
          {data?.sync_meta ? (
            <>
              <p className="text-sm mt-2">
                Backfill status: <span className="font-medium">{data.sync_meta.status}</span>
                {' · '}{data.sync_meta.dates_scraped} dates scraped
                {' · '}{data.sync_meta.docs_written?.toLocaleString()} docs written
              </p>
              <p className="text-sm mt-1">
                Last scraped: {data.sync_meta.last_scraped_date ?? 'N/A'}
                {' · '}Range: {data.sync_meta.date_start} → {data.sync_meta.date_end}
              </p>
            </>
          ) : (
            <p className="text-sm mt-2">Run the backfill script to populate Firestore.</p>
          )}
        </div>
      )}

      {/* Data available */}
      {data && data.has_data && meta && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              icon={<Users className="h-5 w-5" />}
              label="Total Admissions"
              value={meta.grand_total_admissions.toLocaleString()}
              sub={`${meta.avg_daily_admissions.toLocaleString()}/day avg`}
              color="indigo"
            />
            <KPICard
              icon={<Film className="h-5 w-5" />}
              label="Unique Movies"
              value={meta.unique_movies.toString()}
              sub={`${meta.days_with_data} days tracked`}
              color="purple"
            />
            <KPICard
              icon={<Trophy className="h-5 w-5" />}
              label="Peak Day"
              value={meta.peak_day?.admissions?.toLocaleString() ?? '-'}
              sub={meta.peak_day?.date ? format(parseISO(meta.peak_day.date), 'EEE, MMM d') : '-'}
              color="amber"
            />
            <KPICard
              icon={<BarChart3 className="h-5 w-5" />}
              label="Top Movie"
              value={meta.top_movie?.total_period_admissions?.toLocaleString() ?? '-'}
              sub={meta.top_movie?.title ?? '-'}
              color="emerald"
            />
          </div>

          {/* Market share + Daily trend row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily admissions trend */}
            <div className="lg:col-span-2">
              <ChartCard title="Daily Admissions Trend" subtitle="Local vs International">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.daily_totals}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => format(parseISO(String(v)), 'MMM d')}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                    <Tooltip
                      labelFormatter={(v) => format(parseISO(String(v)), 'EEEE, MMM d, yyyy')}
                      formatter={(v) => Number(v).toLocaleString()}
                    />
                    <Area
                      type="monotone" dataKey="local_admissions" stackId="1"
                      stroke={LOCAL_COLOR} fill={LOCAL_COLOR} fillOpacity={0.6} name="Local"
                    />
                    <Area
                      type="monotone" dataKey="international_admissions" stackId="1"
                      stroke={INTL_COLOR} fill={INTL_COLOR} fillOpacity={0.6} name="International"
                    />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Market share donut */}
            <ChartCard title="Market Share">
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Local', value: localTotal },
                        { name: 'International', value: intlTotal },
                      ]}
                      cx="50%" cy="50%"
                      outerRadius={80} innerRadius={50}
                      dataKey="value"
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      <Cell fill={LOCAL_COLOR} />
                      <Cell fill={INTL_COLOR} />
                    </Pie>
                    <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-6 mt-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LOCAL_COLOR }} />
                    <span>Local {localPct}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: INTL_COLOR }} />
                    <span>Intl {intlPct}%</span>
                  </div>
                </div>
              </div>
            </ChartCard>
          </div>

          {/* Genre breakdown + Day-of-week pattern row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Genre breakdown */}
            {data.genre_breakdown.length > 0 && (
              <ChartCard title="Genre Breakdown" subtitle="Admissions by genre across all movies">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.genre_breakdown.slice(0, 10)} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="genre" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                    <Bar dataKey="admissions" name="Admissions" radius={[0, 4, 4, 0]}>
                      {data.genre_breakdown.slice(0, 10).map((_, i) => (
                        <Cell key={i} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Day-of-week pattern */}
            {data.day_of_week.length > 0 && (
              <ChartCard title="Day-of-Week Pattern" subtitle="Average daily admissions by weekday">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={data.day_of_week}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                    <Radar
                      name="Avg Admissions" dataKey="avg_admissions"
                      stroke="#6366f1" fill="#6366f1" fillOpacity={0.3}
                    />
                    <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                  </RadarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* Top 10 bar chart */}
          <ChartCard title="Top 10 Movies by Admissions" subtitle="Period total for selected date range">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={data.movie_rankings.slice(0, 10).map((m) => ({
                  title: m.title.length > 25 ? m.title.slice(0, 25) + '…' : m.title,
                  admissions: m.total_period_admissions,
                  type: m.type,
                }))}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="title" width={180} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                <Bar dataKey="admissions" name="Admissions" radius={[0, 4, 4, 0]}>
                  {data.movie_rankings.slice(0, 10).map((m, i) => (
                    <Cell key={i} fill={m.type === 'local' ? LOCAL_COLOR : INTL_COLOR} />
                  ))}
                </Bar>
                <Legend formatter={(v) => v} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* New Releases */}
          {data.new_releases.length > 0 && (
            <ChartCard title="New Releases" subtitle={`Movies released in this period (${data.new_releases.length} titles)`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Movie</th>
                      <th className="py-2 px-3">Release</th>
                      <th className="py-2 px-3 text-right">Period Adm.</th>
                      <th className="py-2 px-3 text-right">Opening</th>
                      <th className="py-2 px-3 text-right">Peak</th>
                      <th className="py-2 px-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.new_releases.map((m, i) => (
                      <tr
                        key={m.id}
                        className="border-b hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedMovie(selectedMovie === m.id ? null : m.id)}
                      >
                        <td className="py-2 px-3 font-medium">{i + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-medium">{m.title}</div>
                          <div className="text-xs text-muted-foreground">{m.movie_genre.join(', ')}</div>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground text-xs">
                          {m.release_date ? format(parseISO(m.release_date.slice(0, 10)), 'MMM d') : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{m.total_period_admissions.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                          {m.opening_admission?.toLocaleString() ?? '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                          {m.peak_admission?.toLocaleString() ?? '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{m.latest_score.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}

          {/* Rank movers */}
          {data.top_movers.length > 0 && (
            <ChartCard title="Rank Movers" subtitle="Biggest rank improvements in this period">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Movie</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3 text-right">Period Admissions</th>
                      <th className="py-2 px-3 text-center">Rank Change</th>
                      <th className="py-2 px-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_movers.map((m, i) => (
                      <tr
                        key={m.id}
                        className="border-b hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedMovie(selectedMovie === m.id ? null : m.id)}
                      >
                        <td className="py-2 px-3 font-medium">{i + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-medium">{m.title}</div>
                          <div className="text-xs text-muted-foreground">{m.movie_genre.join(', ')}</div>
                        </td>
                        <td className="py-2 px-3">
                          <TypeBadge type={m.type} />
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{m.total_period_admissions.toLocaleString()}</td>
                        <td className="py-2 px-3 text-center">
                          <RankChange change={m.rank_change} first={m.first_rank} last={m.last_rank} />
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{m.latest_score.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}

          {/* Selected movie drill-down */}
          {selectedMovie && (() => {
            const movie = data.movie_rankings.find((m) => m.id === selectedMovie);
            if (!movie) return null;

            // Compute week-over-week drops
            const weekBuckets = new Map<number, { total: number; count: number }>();
            for (const d of movie.daily) {
              const weekNum = Math.floor(
                (new Date(d.date).getTime() - new Date(movie.daily[0].date).getTime()) / (7 * 86400000)
              );
              if (!weekBuckets.has(weekNum)) weekBuckets.set(weekNum, { total: 0, count: 0 });
              const bucket = weekBuckets.get(weekNum)!;
              bucket.total += d.admission;
              bucket.count += 1;
            }
            const weeklyAvg = [...weekBuckets.entries()]
              .sort(([a], [b]) => a - b)
              .map(([week, { total }]) => ({ week: `W${week + 1}`, admissions: total }));
            const wowDrop = weeklyAvg.length >= 2
              ? ((weeklyAvg[0].admissions - weeklyAvg[1].admissions) / weeklyAvg[0].admissions * 100).toFixed(1)
              : null;

            return (
              <ChartCard title={movie.title}>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <TypeBadge type={movie.type} />
                  <StatChip icon={<Star className="h-3 w-3" />} label="Score" value={movie.latest_score.toFixed(1)} />
                  <StatChip icon={<Users className="h-3 w-3" />} label="Lifetime" value={movie.latest_total_admission.toLocaleString()} />
                  <StatChip icon={<TrendingUp className="h-3 w-3" />} label="Period" value={movie.total_period_admissions.toLocaleString()} />
                  <StatChip icon={<Popcorn className="h-3 w-3" />} label="Peak Day" value={movie.peak_admission.toLocaleString()} />
                  {movie.opening_admission !== null && (
                    <StatChip icon={<CalendarDays className="h-3 w-3" />} label="Opening" value={movie.opening_admission.toLocaleString()} />
                  )}
                  {wowDrop !== null && (
                    <StatChip
                      icon={Number(wowDrop) > 0 ? <TrendingUp className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      label="W1→W2"
                      value={`${wowDrop}%`}
                      color={Number(wowDrop) > 0 ? 'text-green-600' : 'text-red-600'}
                    />
                  )}
                  <button onClick={() => setSelectedMovie(null)} className="ml-auto text-muted-foreground hover:text-foreground text-sm">✕ Close</button>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={movie.daily}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(String(v)), 'MMM d')} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} reversed domain={[1, 'auto']} />
                    <Tooltip
                      labelFormatter={(v) => format(parseISO(String(v)), 'EEE, MMM d')}
                      formatter={(v, name) => name === 'Rank' ? `#${v}` : Number(v).toLocaleString()}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="admission" stroke="#6366f1" strokeWidth={2} name="Admissions" dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="rank" stroke="#f59e0b" strokeWidth={2} name="Rank" strokeDasharray="5 5" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
                {/* Cumulative line */}
                {movie.daily.length > 1 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Cumulative Admissions</h4>
                    <ResponsiveContainer width="100%" height={150}>
                      <AreaChart data={movie.daily}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(String(v)), 'MMM d')} tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(Number(v) / 1000000).toFixed(1)}M`} />
                        <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                        <Area type="monotone" dataKey="total_admission" stroke="#10b981" fill="#10b981" fillOpacity={0.15} name="Cumulative" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
            );
          })()}

          {/* Full rankings table */}
          <ChartCard title="Full Rankings" subtitle={`${data.movie_rankings.length} movies · Click any row for daily trend`}>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-3 w-12">Rank</th>
                    <th className="py-2 px-3">Movie</th>
                    <th className="py-2 px-3 w-16">Type</th>
                    <th className="py-2 px-3 text-right">Period</th>
                    <th className="py-2 px-3 text-right">Lifetime</th>
                    <th className="py-2 px-3 text-right w-14">Score</th>
                    <th className="py-2 px-3 text-center w-14">Days</th>
                    <th className="py-2 px-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {data.movie_rankings.map((m) => (
                    <tr
                      key={m.id}
                      className={cn(
                        'border-b hover:bg-muted/50 cursor-pointer transition-colors',
                        selectedMovie === m.id && 'bg-indigo-50 dark:bg-indigo-950',
                      )}
                      onClick={() => setSelectedMovie(selectedMovie === m.id ? null : m.id)}
                    >
                      <td className="py-2 px-3 font-mono font-bold">{m.latest_rank ?? '-'}</td>
                      <td className="py-2 px-3">
                        <div className="font-medium">{m.title}</div>
                        <div className="text-xs text-muted-foreground">{m.movie_genre.join(', ')}</div>
                      </td>
                      <td className="py-2 px-3"><TypeBadge type={m.type} /></td>
                      <td className="py-2 px-3 text-right font-mono">{m.total_period_admissions.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">{m.latest_total_admission.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right font-mono">{m.latest_score.toFixed(1)}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">{m.daily.length}</td>
                      <td className="py-2 px-3"><ChevronRight className="h-3 w-3 text-muted-foreground" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function KPICard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  };

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className={cn('p-1.5 rounded-md', colorMap[color])}>{icon}</div>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={cn(
      'text-xs px-2 py-0.5 rounded-full',
      type === 'local'
        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    )}>
      {type === 'local' ? 'Local' : 'Intl'}
    </span>
  );
}

function RankChange({ change, first, last }: { change: number; first: number; last: number }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-medium',
      change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500',
    )}>
      {change > 0 ? <ArrowUpRight className="h-3 w-3" /> : change < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {Math.abs(change)} ({first} → {last})
    </span>
  );
}

function StatChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      <span>{label}:</span>
      <span className={cn('font-medium', color)}>{value}</span>
    </div>
  );
}
