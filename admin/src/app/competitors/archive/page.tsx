'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ClipboardPaste,
  Loader2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CompetitorTweet, TweetSourceSummary, TweetType } from '@/features/competitors/types';
import type { DateCoverage } from './components/CalendarSidebar';
import { useScrollSpy } from '@/features/competitors/hooks/useScrollSpy';
import { useTweetImport } from '@/features/competitors/hooks/useTweetImport';
import { TweetCard } from './components/TweetCard';
import { ImportModal } from './components/ImportModal';
import { FilterSidebar } from './components/FilterSidebar';
import { CalendarSidebar } from './components/CalendarSidebar';

// ─── Types ─────────────────────────────────────────────────

interface TweetsResponse {
  tweets: CompetitorTweet[];
  sources: TweetSourceSummary[];
  total: number;
}

// ─── Page Component (Orchestrator) ─────────────────────────

export default function TweetArchivePage() {
  // Data fetching
  const [data, setData] = useState<TweetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<TweetType | null>(null);

  // Snapshot coverage (for calendar sidebar)
  const [coverageData, setCoverageData] = useState<DateCoverage[]>([]);

  const fetchTweets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeSource) params.set('source', activeSource);
      if (activeType) params.set('type', activeType);
      const res = await fetch(`/api/competitors/tweets?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error('[Tweet archive fetch error]', err);
    } finally {
      setLoading(false);
    }
  }, [activeSource, activeType]);

  const fetchCoverage = useCallback(async () => {
    try {
      const res = await fetch('/api/competitors');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setCoverageData(json.data || []);
      }
    } catch {
      // Silent — calendar just won't show coverage dots
    }
  }, []);

  useEffect(() => {
    fetchTweets();
    fetchCoverage();
  }, [fetchTweets, fetchCoverage]);

  // Scroll spy
  const { currentDateInView, scrollToDate } = useScrollSpy({
    enabled: !loading && !!data,
    dataDep: data,
  });

  // Import (JSON modal only — URL import lives in CalendarSidebar)
  const {
    importing,
    importResult,
    setImportResult,
    isImportModalOpen,
    setIsImportModalOpen,
    jsonPaste,
    setJsonPaste,
    scanReport,
    handleScan,
    handlePasteImport,
  } = useTweetImport({ onImportSuccess: async () => { await Promise.all([fetchTweets(), fetchCoverage()]); } });

  // Derived: group tweets by date
  const groupedTweets = useMemo(() => {
    if (!data) return new Map<string, CompetitorTweet[]>();
    const groups = new Map<string, CompetitorTweet[]>();

    data.tweets.forEach(tweet => {
      let dateKey = tweet.data_date;
      if (!dateKey) {
        try {
          dateKey = format(new Date(tweet.created_at), 'yyyy-MM-dd');
        } catch {
          dateKey = 'unknown';
        }
      }
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)?.push(tweet);
    });

    return new Map([...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])));
  }, [data]);

  const handleImportComplete = useCallback(async () => {
    await Promise.all([fetchTweets(), fetchCoverage()]);
  }, [fetchTweets, fetchCoverage]);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 w-full border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/competitors"
              className="w-9 h-9 rounded-xl border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Archive className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-black uppercase tracking-tighter">Tweet Archive</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
                Competitor Intelligence Feed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              disabled={importing}
              className="h-8 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl border-border/60 hover:bg-muted transition-all"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Import Twitter JSON
            </Button>
          </div>
        </div>
      </header>

      {/* Import Modal */}
      <ImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        importing={importing}
        jsonPaste={jsonPaste}
        onJsonPasteChange={(val) => {
          setJsonPaste(val);
        }}
        scanReport={scanReport}
        onScan={handleScan}
        onImport={handlePasteImport}
      />

      {/* Main Layout */}
      <div className="px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Filters */}
          <FilterSidebar
            sources={data?.sources ?? []}
            activeSource={activeSource}
            onSourceChange={setActiveSource}
            activeType={activeType}
            onTypeChange={setActiveType}
          />

          {/* Center: Timeline */}
          <div className="lg:col-span-7 space-y-6">
            {/* Import status banner */}
            {importResult && (
              <div
                className={cn(
                  'p-4 rounded-2xl border text-[11px] font-bold leading-relaxed animate-in fade-in slide-in-from-top-2 duration-500',
                  importResult.ok
                    ? 'bg-emerald-500/[0.03] border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-500/[0.03] border-red-500/20 text-red-700 dark:text-red-400',
                )}
              >
                <div className="flex items-start gap-2">
                  {importResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    {importResult.msg}
                  </div>
                  <button onClick={() => setImportResult(null)} className="opacity-40 hover:opacity-100 p-1 rounded-md hover:bg-muted transition-colors">
                    ×
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="py-32 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary opacity-40" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">
                  Streaming Archive...
                </p>
              </div>
            ) : data && data.tweets.length > 0 ? (
              <div className="space-y-12 animate-in fade-in duration-700 pb-40">
                <div className="px-6 py-2 flex items-center justify-between border-b border-border/10 pb-4">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                    Intelligence Stream ({data.total} Signals)
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-black uppercase text-emerald-600/80">Live Archive</span>
                  </div>
                </div>

                {Array.from(groupedTweets.entries()).map(([date, tweets]) => (
                  <section
                    key={date}
                    id={`date-section-${date}`}
                    data-date={date}
                    className="space-y-4 scroll-mt-24"
                  >
                    <div className="sticky top-20 z-20 flex items-center gap-4 py-2 pointer-events-none">
                      <div className="bg-background/80 backdrop-blur-md border border-border/40 px-4 py-1.5 rounded-full shadow-lg pointer-events-auto flex items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          {date !== 'unknown' ? format(parseISO(date), 'EEEE, MMM d, yyyy') : 'Uncategorized'}
                        </span>
                        <DateCoverageBadge date={date} coverageData={coverageData} />
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-r from-border/40 to-transparent" />
                    </div>

                    <div className="space-y-6">
                      {tweets.map((tweet) => (
                        <TweetCard key={tweet.id} tweet={tweet} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyArchiveState />
            )}
          </div>

          {/* Right: Calendar Navigation — canonical import location */}
          <CalendarSidebar
            coverageData={coverageData}
            currentDateInView={currentDateInView}
            onDateSelect={scrollToDate}
            onImportComplete={handleImportComplete}
            onOpenJsonImport={() => setIsImportModalOpen(true)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Empty Archive State ────────────────────────────────────

function EmptyArchiveState() {
  return (
    <div className="py-16 text-center border-2 border-dashed rounded-[2.5rem] border-border/40 bg-muted/5">
      <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
        <Archive className="w-6 h-6 text-muted-foreground/40" />
      </div>
      <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">No signals found in the archive.</p>
      <p className="text-muted-foreground/50 text-[10px] mt-2 uppercase tracking-tight font-medium">
        Use the sidebar to import tweets and get started →
      </p>
    </div>
  );
}

// ─── Date Coverage Badge ───────────────────────────────────

function DateCoverageBadge({ date, coverageData }: { date: string; coverageData: DateCoverage[] }) {
  const coverage = coverageData.find((c) => c.date === date);
  if (!coverage || coverage.status === 'empty') return null;

  const config: Record<string, { label: string; className: string }> = {
    complete: { label: 'Complete', className: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
    showtimes_only: { label: 'Showtimes', className: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
    admissions_only: { label: 'Admissions', className: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  };

  const { label, className } = config[coverage.status] || { label: '', className: '' };
  if (!label) return null;

  return (
    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${className}`}>
      {label}
    </span>
  );
}
