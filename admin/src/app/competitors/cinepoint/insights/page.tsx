'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  Play, Loader2, AlertCircle, CheckCircle2,
  TrendingUp, TrendingDown, Trophy, Film, Users, BarChart3,
  ArrowUpRight, ArrowDownRight, Minus, Calendar, Globe, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

interface TopMover extends MovieRanking {
  rank_change: number;
  first_rank: number;
  last_rank: number;
}

interface PilotData {
  success: boolean;
  has_data: boolean;
  meta: {
    scraped_at: string;
    days_scraped: number;
    date_range: { start: string; end: string };
    unique_movies: number;
    grand_total_admissions: number;
    avg_daily_admissions: number;
    peak_day: { date: string; admissions: number } | null;
  };
  daily_totals: DailyTotal[];
  movie_rankings: MovieRanking[];
  top_movers: TopMover[];
}

// ─── Colors ─────────────────────────────────────────────────

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8',
  '#6ee7b7', '#fbbf24', '#f87171', '#38bdf8', '#fb923c',
  '#e879f9', '#34d399', '#f472b6', '#22d3ee', '#a3e635',
];

const LOCAL_COLOR = '#6366f1';
const INTL_COLOR = '#f59e0b';

// ─── Component ──────────────────────────────────────────────

export default function CinePointInsightsPage() {
  const [data, setData] = useState<PilotData | null>(null);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeLog, setScrapeLog] = useState<string[]>([]);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [selectedMovie, setSelectedMovie] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load existing data on mount
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/competitors/cinepoint/pilot-data');
      const json = await res.json();
      if (json.success && json.has_data) {
        setData(json);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // SSE scrape
  const startScrape = () => {
    setScraping(true);
    setScrapeLog([]);
    setScrapeProgress(0);

    const es = new EventSource('/api/competitors/cinepoint/pilot-scrape');
    eventSourceRef.current = es;

    es.addEventListener('log', (e) => {
      const d = JSON.parse(e.data);
      setScrapeLog((prev) => [...prev, d.message]);
    });

    es.addEventListener('day', (e) => {
      const d = JSON.parse(e.data);
      setScrapeLog((prev) => [...prev, `✓ ${d.date}: ${d.movies} movies, ${d.total_admissions?.toLocaleString()} admissions`]);
      setScrapeProgress(d.progress_pct);
    });

    es.addEventListener('complete', async () => {
      es.close();
      setScraping(false);
      setScrapeProgress(100);
      setScrapeLog((prev) => [...prev, '✓ Scrape complete!']);
      await loadData();
    });

    es.addEventListener('error', (e) => {
      const d = JSON.parse((e as MessageEvent).data || '{}');
      setScrapeLog((prev) => [...prev, `✗ Error: ${d.message}`]);
      es.close();
      setScraping(false);
    });

    es.onerror = () => {
      es.close();
      setScraping(false);
    };
  };

  const meta = data?.meta;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-500" />
            CinePoint Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daily box office insights from CinePoint competitor data
          </p>
        </div>
        <div className="flex items-center gap-3">
          {meta && (
            <span className="text-xs text-muted-foreground">
              Data: {meta.date_range.start} → {meta.date_range.end} ({meta.days_scraped} days)
            </span>
          )}
          <Button onClick={startScrape} disabled={scraping}>
            {scraping ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scraping...</>
            ) : data ? (
              <><Play className="h-4 w-4 mr-2" /> Refresh (14 days)</>
            ) : (
              <><Play className="h-4 w-4 mr-2" /> Scrape Pilot (14 days)</>
            )}
          </Button>
        </div>
      </div>

      {/* Scrape progress */}
      {scraping && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Scraping in progress...</span>
            <span className="text-sm text-muted-foreground">{scrapeProgress}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${scrapeProgress}%` }} />
          </div>
          <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
            {scrapeLog.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && !data && !scraping && (
        <div className="text-center py-20 text-muted-foreground">
          <Film className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No data yet</p>
          <p className="text-sm">Click &ldquo;Scrape Pilot&rdquo; to fetch the last 14 days of CinePoint box office data.</p>
        </div>
      )}

      {data && meta && (
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
              sub={`${meta.days_scraped} days tracked`}
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
              value={data.movie_rankings[0]?.total_period_admissions?.toLocaleString() ?? '-'}
              sub={data.movie_rankings[0]?.title ?? '-'}
              color="emerald"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily admissions trend */}
            <ChartCard title="Daily Admissions Trend">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.daily_totals}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(parseISO(String(v)), 'MMM d')}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                  <Tooltip
                    labelFormatter={(v) => format(parseISO(String(v)), 'EEEE, MMM d, yyyy')}
                    formatter={(v) => Number(v).toLocaleString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="local_admissions"
                    stackId="1"
                    stroke={LOCAL_COLOR}
                    fill={LOCAL_COLOR}
                    fillOpacity={0.6}
                    name="Local"
                  />
                  <Area
                    type="monotone"
                    dataKey="international_admissions"
                    stackId="1"
                    stroke={INTL_COLOR}
                    fill={INTL_COLOR}
                    fillOpacity={0.6}
                    name="International"
                  />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Local vs International pie */}
            <ChartCard title="Local vs International Split">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: 'Local',
                        value: data.movie_rankings
                          .filter((m) => m.type === 'local')
                          .reduce((s, m) => s + m.total_period_admissions, 0),
                      },
                      {
                        name: 'International',
                        value: data.movie_rankings
                          .filter((m) => m.type === 'international')
                          .reduce((s, m) => s + m.total_period_admissions, 0),
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={60}
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
            </ChartCard>
          </div>

          {/* Top 10 bar chart */}
          <ChartCard title="Top 10 Movies by Admissions (Period Total)">
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
                  {data.movie_rankings.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Top movers */}
          {data.top_movers.length > 0 && (
            <ChartCard title="Rank Movers (Biggest Improvements)">
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
                      <tr key={m.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedMovie(selectedMovie === m.id ? null : m.id)}>
                        <td className="py-2 px-3 font-medium">{i + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-medium">{m.title}</div>
                          <div className="text-xs text-muted-foreground">{m.movie_genre.join(', ')}</div>
                        </td>
                        <td className="py-2 px-3">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            m.type === 'local' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
                          )}>
                            {m.type === 'local' ? 'ID' : 'INT'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{m.total_period_admissions.toLocaleString()}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={cn(
                            'inline-flex items-center gap-1 text-xs font-medium',
                            m.rank_change > 0 ? 'text-green-600' : m.rank_change < 0 ? 'text-red-600' : 'text-gray-500',
                          )}>
                            {m.rank_change > 0 ? <ArrowUpRight className="h-3 w-3" /> : m.rank_change < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {Math.abs(m.rank_change)} ({m.first_rank} → {m.last_rank})
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{m.latest_score.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}

          {/* Selected movie detail chart */}
          {selectedMovie && (() => {
            const movie = data.movie_rankings.find((m) => m.id === selectedMovie);
            if (!movie) return null;
            return (
              <ChartCard title={`${movie.title} — Daily Trend`}>
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full',
                    movie.type === 'local' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700',
                  )}>
                    {movie.type}
                  </span>
                  <span>Score: {movie.latest_score.toFixed(1)}</span>
                  <span>Lifetime: {movie.latest_total_admission.toLocaleString()}</span>
                  <span>Period: {movie.total_period_admissions.toLocaleString()}</span>
                  <button onClick={() => setSelectedMovie(null)} className="ml-auto text-muted-foreground hover:text-foreground">✕ Close</button>
                </div>
                <ResponsiveContainer width="100%" height={250}>
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
              </ChartCard>
            );
          })()}

          {/* Full rankings table */}
          <ChartCard title="Full Rankings (click for daily trend)">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-3">Rank</th>
                    <th className="py-2 px-3">Movie</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3 text-right">Period Adm.</th>
                    <th className="py-2 px-3 text-right">Lifetime</th>
                    <th className="py-2 px-3 text-right">Score</th>
                    <th className="py-2 px-3 text-center">Days</th>
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
                      <td className="py-2 px-3 font-mono font-bold">
                        {m.latest_rank ?? '-'}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium">{m.title}</div>
                        <div className="text-xs text-muted-foreground">{m.movie_genre.join(', ')}</div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          m.type === 'local' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
                        )}>
                          {m.type === 'local' ? 'Local' : 'Intl'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{m.total_period_admissions.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">{m.latest_total_admission.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right font-mono">{m.latest_score.toFixed(1)}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">{m.daily.length}</td>
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
        <div className={cn('p-1.5 rounded-md', colorMap[color])}>
          {icon}
        </div>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}
