'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { format, parseISO, subDays, differenceInDays } from 'date-fns';
import Image from 'next/image';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { JsonViewer, sortObjectKeys } from '@/components/JsonViewer';
import {
  Archive,
  Loader2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Film,
  TrendingUp,
  MessageSquare,
  ClipboardPaste,
  ExternalLink,
  ImageIcon,
  Calendar,
  Braces,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CompetitorTweet, TweetSourceSummary, TweetType } from '@/features/competitors/types';

interface TweetsResponse {
  tweets: CompetitorTweet[];
  sources: TweetSourceSummary[];
  total: number;
}

const TYPE_CONFIG: Record<TweetType, { label: string; icon: typeof Film; color: string }> = {
  showtimes: { label: 'Showtimes', icon: Film, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  admissions: { label: 'Admissions', icon: TrendingUp, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  other: { label: 'Other', icon: MessageSquare, color: 'bg-muted/50 text-muted-foreground border-border/30' },
};

export default function TweetArchivePage() {
  const [data, setData] = useState<TweetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<TweetType | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Navigation State
  const [currentDateInView, setCurrentDateInView] = useState<Date | undefined>(new Date());
  const isManualScrolling = useRef(false);
  const suppressObserverUntil = useRef(0); // timestamp: ignore observer entries before this time

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);
  const [jsonPaste, setJsonPaste] = useState('');
  const [scanReport, setScanReport] = useState<{
    total: number;
    signals: { date: string; type: string; len: number; truncated: boolean }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScan = useCallback(() => {
    if (!jsonPaste.trim()) return;
    try {
      const json = JSON.parse(jsonPaste);
      const tweets = extractTweetsWithGreedyScour(json);
      
      const signals = tweets.map(t => ({
        date: t.created_at.split(' ').slice(1, 4).join(' '),
        type: t.text.startsWith('SHOWTIMES') ? 'Show' : 'Adm',
        len: t.text.length,
        truncated: t.text.endsWith('...') || t.text.length < 100
      }));

      setScanReport({
        total: tweets.length,
        signals: signals.slice(0, 10) // Show top 10 for preview
      });
    } catch {
      setImportResult({ ok: false, msg: 'Invalid JSON for scanning' });
    }
  }, [jsonPaste]);

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

  useEffect(() => {
    fetchTweets();
  }, [fetchTweets]);

  // ─── Scroll-Spy Logic ────────────────────────────────────
   
  useEffect(() => {
    if (loading || !data) return;

    // Delay observer setup to ensure DOM sections are rendered
    const rafId = requestAnimationFrame(() => {
      const sections = Array.from(document.querySelectorAll('section[data-date]'));
      if (sections.length === 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (isManualScrolling.current) return;

          const now = Date.now();
          if (now < suppressObserverUntil.current) return;

          // Find the topmost visible section (closest to viewport top)
          let topEntry: { element: Element; dateStr: string } | null = null;
          
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const dateStr = entry.target.getAttribute('data-date');
              if (dateStr && dateStr !== 'unknown') {
                const rect = entry.boundingClientRect;
                if (!topEntry || Math.abs(rect.top) < Math.abs(topEntry.element.getBoundingClientRect().top)) {
                  topEntry = { element: entry.target, dateStr };
                }
              }
            }
          }

          if (topEntry) {
            setCurrentDateInView(parseISO(topEntry.dateStr));
          }
        },
        // Tripwire: triggers when the top of a section enters the viewport band
        // between -80px (below sticky header) and 60% down (before it leaves bottom)
        { threshold: 0, rootMargin: '-80px 0px -60% 0px' }
      );

      sections.forEach(section => observer.observe(section));

      // Store for cleanup
      scrollObserverRef.current = observer;
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (scrollObserverRef.current) {
        scrollObserverRef.current.disconnect();
        scrollObserverRef.current = null;
      }
    };
  }, [loading, data]);

  const scrollObserverRef = useRef<IntersectionObserver | null>(null);

  const scrollToDate = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const element = document.getElementById(`date-section-${dateStr}`)
      || document.querySelector(`section[data-date="${dateStr}"]`);

    if (!element) return;

    isManualScrolling.current = true;
    setCurrentDateInView(date);
    suppressObserverUntil.current = Date.now() + 2500;

    if (scrollObserverRef.current) {
      scrollObserverRef.current.disconnect();
    }

    // Find the DashboardLayout's scrollable <main> — now the only <main> in the DOM.
    const scrollContainer = document.querySelector('main') as HTMLElement | null;
    if (scrollContainer) {
      const rect = element.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      scrollContainer.scrollTop = scrollContainer.scrollTop + rect.top - containerRect.top - 80;
    }

    setTimeout(() => {
      isManualScrolling.current = false;
      const sections = Array.from(document.querySelectorAll('section[data-date]'));
      if (scrollObserverRef.current) {
        sections.forEach(section => scrollObserverRef.current!.observe(section));
      }
    }, 1500);
  }, []);

  // Group tweets by date
  const groupedTweets = useMemo(() => {
    if (!data) return new Map<string, CompetitorTweet[]>();
    const groups = new Map<string, CompetitorTweet[]>();
    
    data.tweets.forEach(tweet => {
      // Use data_date if available, otherwise fallback to created_at date part
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
    
    // Sort keys descending
    const sorted = new Map([...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])));
    return sorted;
  }, [data]);

  const availableDates = useMemo(() => 
    new Set(Array.from(groupedTweets.keys()).filter(d => d !== 'unknown')), 
  [groupedTweets]);

  // Compute missing dates: dates within the tweet range that have no data
  const missingDates = useMemo(() => {
    const dates = Array.from(availableDates).sort();
    if (dates.length < 2) return new Set<string>();

    const earliest = parseISO(dates[0]);
    const latest = parseISO(dates[dates.length - 1]);
    const totalDays = differenceInDays(latest, earliest) + 1;

    const missing = new Set<string>();
    for (let i = 0; i < totalDays; i++) {
      const d = format(subDays(latest, i), 'yyyy-MM-dd');
      if (!availableDates.has(d)) {
        missing.add(d);
      }
    }
    return missing;
  }, [availableDates]);

  const runImport = useCallback(async (jsonObj: unknown) => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/competitors/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonObj),
      });
      const result = await res.json();
      if (result.success) {
        setImportResult({
          ok: true,
          msg: `Imported ${result.data.tweets_stored} tweets from @${result.data.source} → ${result.data.dates_upserted} dates updated`,
        });
        setJsonPaste('');
        setIsImportModalOpen(false);
        await fetchTweets();
      } else {
        setImportResult({ ok: false, msg: result.error || 'Import failed' });
      }
    } catch {
      setImportResult({ ok: false, msg: 'Invalid JSON' });
    } finally {
      setImporting(false);
    }
  }, [fetchTweets]);

  const handlePasteImport = useCallback(() => {
    if (!jsonPaste.trim()) return;
    try {
      const parsed = JSON.parse(jsonPaste);
      runImport(parsed);
    } catch {
      setImportResult({ ok: false, msg: 'Invalid JSON — check the pasted text' });
    }
  }, [jsonPaste, runImport]);

  const handleFileImport = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      runImport(parsed);
    } catch {
      setImportResult({ ok: false, msg: 'Invalid JSON file' });
    }
  }, [runImport]);

  return (
    <div className="min-h-screen bg-background">
      {/* 1. Sticky Header */}
      <header className="sticky top-0 z-30 w-full border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileImport(file);
                e.target.value = '';
              }}
            />
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="h-8 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-muted transition-all"
            >
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              Upload
            </Button>
          </div>
        </div>
      </header>

      {/* 1.5 Import Modal (Highest Leverage for large JSON) */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-4xl bg-background/95 backdrop-blur-2xl border-border/40 rounded-[2.5rem] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase tracking-tighter">
              <div className="p-2 bg-primary/10 rounded-xl">
                <ClipboardPaste className="w-6 h-6 text-primary" />
              </div>
              Import Forensic Data
            </DialogTitle>
            <DialogDescription className="text-xs uppercase font-bold tracking-widest text-muted-foreground/60">
              Paste the full Twitter API response payload below
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <textarea
                value={jsonPaste}
                onChange={(e) => {
                  setJsonPaste(e.target.value);
                  setScanReport(null);
                }}
                placeholder={'Paste massive JSON here (e.g. 15,000+ lines)...'}
                rows={scanReport ? 5 : 12}
                className={cn(
                  'w-full rounded-[2rem] border bg-muted/5 px-6 py-5 text-xs font-mono',
                  'placeholder:text-muted-foreground/20 resize-none',
                  'focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all',
                  'border-border/40 shadow-inner custom-scrollbar',
                )}
              />
              {!scanReport && (
                <div className="flex items-center justify-between px-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 italic">
                    Tip: Copy directly from Chrome DevTools → Network → Response
                  </span>
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={handleScan}
                    disabled={!jsonPaste.trim()}
                    className="text-[10px] font-black uppercase tracking-widest text-primary h-fit p-0"
                  >
                    Scan for Signals →
                  </Button>
                </div>
              )}
            </div>

            {scanReport && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">Total Signals Found</p>
                    <p className="text-2xl font-black">{scanReport.total}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600/60">Integrity Risk</p>
                    <p className="text-2xl font-black">{scanReport.signals.filter(s => s.truncated).length} Truncated</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/40 overflow-hidden bg-muted/5">
                  <table className="w-full text-[10px]">
                    <thead className="bg-muted/10 border-b border-border/40">
                      <tr className="text-left font-black uppercase tracking-widest text-muted-foreground/60">
                        <th className="px-4 py-2">Signal Date</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Length</th>
                        <th className="px-4 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {scanReport.signals.map((s, i) => (
                        <tr key={i} className="hover:bg-muted/10 transition-colors font-medium">
                          <td className="px-4 py-2 opacity-80">{s.date}</td>
                          <td className="px-4 py-2">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                              s.type === 'Show' ? "bg-blue-500/10 text-blue-600" : "bg-emerald-500/10 text-emerald-600"
                            )}>{s.type}</span>
                          </td>
                          <td className="px-4 py-2 font-mono">{s.len} chars</td>
                          <td className="px-4 py-2 text-right">
                            {s.truncated ? (
                              <span className="text-red-500 flex items-center justify-end gap-1 font-black uppercase tracking-tighter text-[8px]">
                                <AlertCircle className="w-2.5 h-2.5" /> Truncated
                              </span>
                            ) : (
                              <span className="text-emerald-500 flex items-center justify-end gap-1 font-black uppercase tracking-tighter text-[8px]">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Full Text
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {scanReport.total > 10 && (
                    <div className="px-4 py-2 bg-muted/10 text-[9px] font-black uppercase tracking-widest text-center text-muted-foreground/40 italic">
                      + {scanReport.total - 10} more forensic signals identified
                    </div>
                  )}
                </div>

                <Button
                  size="lg"
                  onClick={handlePasteImport}
                  disabled={importing}
                  className="w-full h-14 gap-3 text-sm font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                >
                  {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  {importing ? 'Processing forensic timeline...' : 'Finalize Import'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 2. Left Sidebar: Filters */}
          <aside className="lg:col-span-2 space-y-8 lg:sticky lg:top-24 h-fit">
            {/* Import Status */}
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

            {/* Source Selection */}
            <div className="space-y-4">
              <h3 className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                Data Sources
              </h3>
              <div className="flex flex-wrap lg:flex-col gap-2">
                <button
                  onClick={() => setActiveSource(null)}
                  className={cn(
                    'flex items-center justify-between px-4 py-2.5 rounded-xl border text-[11px] font-bold transition-all',
                    !activeSource
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10 scale-[1.02]'
                      : 'bg-muted/5 border-border/40 hover:bg-muted/30 text-muted-foreground',
                  )}
                >
                  <span>All Accounts</span>
                </button>
                {data?.sources.map((s) => (
                  <button
                    key={s.handle}
                    onClick={() => setActiveSource(activeSource === s.handle ? null : s.handle)}
                    className={cn(
                      'flex items-center justify-between px-4 py-2.5 rounded-xl border text-[11px] font-bold transition-all group',
                      activeSource === s.handle
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10 scale-[1.02]'
                        : 'bg-muted/5 border-border/40 hover:bg-muted/30 text-muted-foreground',
                    )}
                  >
                    <span className="truncate pr-2">@{s.handle}</span>
                    <span className={cn(
                      "font-mono text-[10px] px-1.5 py-0.5 rounded-md",
                      activeSource === s.handle ? "bg-white/20" : "bg-muted text-muted-foreground/60"
                    )}>{s.tweet_count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Type Filtering */}
            <div className="space-y-4">
              <h3 className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                Tweet Content
              </h3>
              <div className="flex flex-wrap lg:flex-col gap-2">
                {(Object.entries(TYPE_CONFIG) as [TweetType, typeof TYPE_CONFIG.showtimes][]).map(([type, cfg]) => (
                  <button
                    key={type}
                    onClick={() => setActiveType(activeType === type ? null : type)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 rounded-xl border text-[11px] font-bold transition-all',
                      activeType === type
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10 scale-[1.02]'
                        : `bg-muted/5 border-border/40 hover:bg-muted/30 text-muted-foreground`,
                    )}
                  >
                    <cfg.icon className={cn("w-3.5 h-3.5", activeType === type ? "text-primary-foreground" : "opacity-60")} />
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* 3. Center Column: Timeline */}
          <div className="lg:col-span-7 space-y-6">
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
                      <div className="bg-background/80 backdrop-blur-md border border-border/40 px-4 py-1.5 rounded-full shadow-lg pointer-events-auto">
                        <span className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          {date !== 'unknown' ? format(parseISO(date), 'EEEE, MMM d, yyyy') : 'Uncategorized'}
                        </span>
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
              <div className="py-24 text-center border-2 border-dashed rounded-[2.5rem] border-border/40 bg-muted/5">
                <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <Archive className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">No signals found in the archive.</p>
                <p className="text-muted-foreground/50 text-[10px] mt-2 uppercase tracking-tight font-medium">
                  Use &quot;Paste JSON&quot; or &quot;Upload File&quot; to populate the timeline.
                </p>
              </div>
            )}
          </div>

          {/* 4. Right Sidebar: Temporal Navigation */}
          <aside className="lg:col-span-3 space-y-8 lg:sticky lg:top-24 h-fit">
            <div className="bg-card border border-border/40 rounded-[2.5rem] p-6 shadow-sm">
              <h3 className="px-2 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 flex items-center justify-between">
                Temporal Navigation
                <span className="text-primary/60 font-mono">{Array.from(availableDates).length} Days</span>
              </h3>
              
              <div className="border border-border/20 rounded-2xl overflow-hidden bg-muted/5 p-1">
                <CalendarPicker
                  mode="single"
                  selected={currentDateInView}
                  disabled={{ after: new Date() }}
                  onSelect={(date) => {
                    if (date) setCurrentDateInView(date);
                  }}
                  onDayClick={(date) => {
                    scrollToDate(date);
                  }}
                  modifiers={{
                    hasData: (date) => availableDates.has(format(date, 'yyyy-MM-dd')),
                    missingData: (date) => missingDates.has(format(date, 'yyyy-MM-dd')),
                  }}
                  modifiersClassNames={{
                    hasData: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full font-bold text-foreground",
                    missingData: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-red-400 after:rounded-full text-red-400/80 font-medium",
                  }}
                  className="w-full"
                />
              </div>

              {/* Legend */}
              <div className="mt-4 space-y-2 px-2">
                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-muted-foreground">Has Data ({availableDates.size} days)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-muted-foreground">Missing ({missingDates.size})</span>
                  </span>
                </div>
                {missingDates.size > 0 && (
                  <div className="px-3 py-2 rounded-xl bg-red-500/5 border border-red-500/15">
                    <p className="text-[10px] font-bold text-red-600/80 uppercase tracking-wider">
                      Gap Detected
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                      {missingDates.size} date{missingDates.size > 1 ? 's' : ''} within the archive range lack tweet data. Fetch the missing JSON from the source account and import to fill gaps.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-4 px-2">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-tight">Timeline Sync</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 font-medium">
                      Select a date with a dot to jump to that forensic evidence.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** 
 * Highlight hashtags in tweet text with a blue, bold style 
 * mimicking links but non-clickable.
 */
function formatTweetText(text: string) {
  if (!text) return text;
  
  const parts = text.split(/(#\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      return (
        <span key={i} className="text-blue-500 dark:text-blue-400 font-bold tracking-tight">
          {part}
        </span>
      );
    }
    return part;
  });
}

/**
 * Greedy scour for frontend preview/scan
 */
function extractTweetsWithGreedyScour(json: unknown): { text: string; created_at: string }[] {
  const root = json as Record<string, unknown>;
  const data = root?.data as Record<string, unknown>;
  const user = data?.user as Record<string, unknown>;
  const result = user?.result as Record<string, unknown>;
  const timeline = result?.timeline as Record<string, unknown>;
  const timelineInner = timeline?.timeline as Record<string, unknown>;
  const instructions = timelineInner?.instructions as Record<string, unknown>[];

  if (!Array.isArray(instructions)) return [];

  const entries = instructions
    .filter((i) => Array.isArray(i?.entries))
    .flatMap((i) => (i.entries as Record<string, unknown>[]) || []);

  const results: { text: string; created_at: string }[] = [];

  for (const e of entries) {
    const content = e?.content as Record<string, unknown>;
    const itemContent = content?.itemContent as Record<string, unknown>;
    const tweetResults = itemContent?.tweet_results as Record<string, unknown>;
    const res = tweetResults?.result as Record<string, unknown>;
    
    if (!res) continue;

    const reportTexts: string[] = [];
    const scour = (obj: unknown) => {
      if (!obj || typeof obj !== 'object') return;
      const record = obj as Record<string, unknown>;
      if (typeof record.full_text === 'string') reportTexts.push(record.full_text);
      if (typeof record.text === 'string') reportTexts.push(record.text);
      Object.values(record).forEach(val => scour(val));
    };
    scour(res);

    const validReports = reportTexts.filter(t => 
      t.startsWith('SHOWTIMES') || t.startsWith('ESTIMATED ADMISSION')
    );
    
    if (validReports.length > 0) {
      const longest = validReports.reduce((a, b) => a.length > b.length ? a : b);
      const target = (res.tweet as Record<string, unknown>) || res;
      const legacy = target.legacy as Record<string, unknown>;
      
      results.push({
        text: longest,
        created_at: (legacy?.created_at as string) || ''
      });
    }
  }

  return results;
}

// ─── Tweet Card ────────────────────────────────────────────

function TweetCard({ tweet }: { tweet: CompetitorTweet }) {
  const [showRaw, setShowRaw] = useState(false);
  const cfg = TYPE_CONFIG[tweet.tweet_type];
  const TypeIcon = cfg.icon;

  let displayDate = tweet.created_at;
  try {
    displayDate = format(new Date(tweet.created_at), 'HH:mm · MMM d, yyyy');
  } catch { /* keep raw */ }

  return (
    <div
      className={cn(
        'group flex gap-4 px-6 py-6 transition-all duration-300 rounded-[2rem] border',
        'bg-card shadow-sm hover:shadow-xl hover:border-primary/20 cursor-default',
        'border-border/40 hover:bg-card/80',
      )}
    >
      {/* 1. Profile Sidebar */}
      <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
        <div className="w-11 h-11 rounded-full bg-muted overflow-hidden border-2 border-border/20 relative shadow-inner group-hover:border-primary/40 transition-colors">
          {tweet.source_avatar ? (
            <Image src={tweet.source_avatar} alt="" fill className="object-cover" sizes="44px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/5">
              <span className="text-sm font-black text-primary uppercase">{tweet.source_handle.charAt(0)}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Content Area */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Top Row: Meta */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-1.5 min-w-0 overflow-hidden">
            <span className="font-black text-[15px] text-foreground truncate uppercase tracking-tighter group-hover:text-primary transition-colors cursor-pointer">
              {tweet.source_name}
            </span>
            <span className="text-muted-foreground/50 text-xs truncate lowercase tracking-tight">
              @{tweet.source_handle}
            </span>
            <span className="text-muted-foreground/20 text-xs px-1">·</span>
            <span className="text-muted-foreground/40 text-[11px] whitespace-nowrap font-mono tracking-tighter">
              {displayDate}
            </span>
          </div>
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all shrink-0 shadow-inner',
            cfg.color
          )}>
            <TypeIcon className="w-3 h-3" />
            {cfg.label}
          </div>
        </div>

        {/* Content Body (Always expanded) */}
        <div
          className={cn(
            'text-[15px] leading-[1.6] whitespace-pre-wrap text-foreground/90 selection:bg-primary/20',
            'font-medium tracking-tight break-words',
          )}
        >
          {formatTweetText(tweet.text)}
        </div>

        {/* Action Row: Media Info / Links */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-4">
            {tweet.media_urls && tweet.media_urls.length > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground/40 text-[9px] font-black uppercase tracking-widest border border-border/30 px-2 py-1 rounded-lg bg-muted/5">
                <ImageIcon className="w-3.5 h-3.5 opacity-60" />
                {tweet.media_urls.length} visuals
              </div>
            )}
            
            {tweet.data_date && (
              <div className="flex items-center gap-2 text-primary/40 text-[9px] font-black uppercase tracking-widest border border-primary/10 px-2 py-1 rounded-lg bg-primary/5">
                <Calendar className="w-3 h-3 opacity-60" />
                Data: {tweet.data_date}
              </div>
            )}
            
            <button 
              onClick={() => setShowRaw(!showRaw)}
              className={cn(
                "flex items-center gap-2 text-[9px] font-black uppercase tracking-widest border px-2 py-1 rounded-lg transition-all",
                showRaw 
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20" 
                  : "bg-muted/5 text-muted-foreground/30 border-border/30 hover:text-muted-foreground/60 hover:border-border/60"
              )}
            >
              <Braces className="w-3 h-3" />
              Raw Source
            </button>
          </div>

          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0 duration-500">
            <Button variant="ghost" size="sm" className="h-7 px-3 text-[10px] font-black uppercase gap-2 rounded-xl text-primary/60 hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20" asChild>
              <a href={`https://x.com/${tweet.source_handle}/status/${tweet.id}`} target="_blank" rel="noopener noreferrer">
                Verify Source <ExternalLink className="w-3 h-3" />
              </a>
            </Button>
          </div>
        </div>

        {/* Media Grid (Always fully visible) */}
        {tweet.media_urls && tweet.media_urls.length > 0 && (
          <div className={cn(
            "grid gap-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-700",
            tweet.media_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"
          )}>
            {tweet.media_urls.map((url, idx) => (
              <div key={idx} className="relative min-h-[300px] rounded-3xl overflow-hidden border-2 border-border/20 bg-muted/20 shadow-lg group/img">
                <Image 
                  src={url} 
                  alt="" 
                  fill 
                  className="object-contain" 
                  sizes="(max-width: 768px) 100vw, 500px" 
                />
              </div>
            ))}
          </div>
        )}

        {/* Raw Source Viewer */}
        {showRaw && (
          <div className="mt-6 pt-6 border-t border-border/10 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/60">
                Firestore Document Source
              </span>
              <span className="text-[9px] font-mono text-muted-foreground/30">ID: {tweet.id}</span>
            </div>
            <div className="bg-background/50 backdrop-blur-sm border border-border/20 rounded-2xl p-4 overflow-auto max-h-[400px] shadow-inner font-mono text-[11px]">
              <JsonViewer data={sortObjectKeys(tweet)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
