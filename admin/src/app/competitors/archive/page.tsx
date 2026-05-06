'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import Image from 'next/image';
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

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);
  const [jsonPaste, setJsonPaste] = useState('');
  const [showPasteArea, setShowPasteArea] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setShowPasteArea(false);
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
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
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
              onClick={() => setShowPasteArea(!showPasteArea)}
              disabled={importing}
              className="h-8 gap-2 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl border-border/60 hover:bg-muted transition-all"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Paste JSON
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

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 2. Left Sidebar: Filters */}
          <aside className="lg:col-span-3 space-y-8 lg:sticky lg:top-24 h-fit">
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

            {/* Paste Area (Inline) */}
            {showPasteArea && (
              <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                    Source JSON
                  </span>
                </div>
                <textarea
                  value={jsonPaste}
                  onChange={(e) => setJsonPaste(e.target.value)}
                  placeholder={'Paste the full Twitter API JSON here...'}
                  rows={6}
                  className={cn(
                    'w-full rounded-2xl border bg-muted/5 px-4 py-3 text-[10px] font-mono',
                    'placeholder:text-muted-foreground/30 resize-none',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all',
                    'border-border/40 shadow-inner',
                  )}
                />
                <Button
                  size="sm"
                  onClick={handlePasteImport}
                  disabled={!jsonPaste.trim() || importing}
                  className="w-full h-9 gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20"
                >
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Finalize Import
                </Button>
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
          <div className="lg:col-span-9 space-y-6">
            {loading ? (
              <div className="py-32 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary opacity-40" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">
                  Streaming Archive...
                </p>
              </div>
            ) : data && data.tweets.length > 0 ? (
              <div className="space-y-4 animate-in fade-in duration-700">
                <div className="px-6 py-2 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                    Intelligence Stream ({data.total} Verified Signals)
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-black uppercase text-emerald-600/80">Live Archive</span>
                  </div>
                </div>
                
                {data.tweets.map((tweet) => (
                  <TweetCard key={tweet.id} tweet={tweet} />
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
        </div>
      </main>
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

// ─── Tweet Card ────────────────────────────────────────────

function TweetCard({ tweet }: { tweet: CompetitorTweet }) {
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
              <div key={idx} className="relative aspect-video rounded-3xl overflow-hidden border-2 border-border/20 bg-muted/20 shadow-lg group/img">
                <Image 
                  src={url} 
                  alt="" 
                  fill 
                  className="object-cover group-hover/img:scale-[1.03] transition-transform duration-1000" 
                  sizes="(max-width: 768px) 100vw, 500px" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none opacity-0 group-hover/img:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
