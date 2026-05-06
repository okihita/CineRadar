'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import {
  Archive,
  Loader2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Film,
  TrendingUp,
  MessageSquare,
  ChevronDown,
  ClipboardPaste,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Archive className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Tweet Archive</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Imported competitor tweets — verify completeness
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
            className="h-7 gap-1.5 px-3 text-[10px] font-bold uppercase"
          >
            <ClipboardPaste className="w-3 h-3" />
            Paste JSON
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="h-7 gap-1.5 px-3 text-[10px] font-bold uppercase"
          >
            {importing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            Upload File
          </Button>
        </div>
      </div>

      {/* Paste Area */}
      {showPasteArea && (
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Paste Twitter JSON
              </span>
              <span className="text-[9px] text-muted-foreground/40">
                Copy the full response from DevTools → Paste here
              </span>
            </div>
            <textarea
              value={jsonPaste}
              onChange={(e) => setJsonPaste(e.target.value)}
              placeholder={'Paste the full Twitter API JSON here...\n\nTip: In Chrome DevTools → Network tab → find the Twitter API request → Copy Response → paste here'}
              rows={8}
              className={cn(
                'w-full rounded-md border bg-muted/5 px-3 py-2 text-[10px] font-mono',
                'placeholder:text-muted-foreground/40 resize-y',
                'focus:outline-none focus:ring-1 focus:ring-primary/30',
                'border-border/50',
              )}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handlePasteImport}
                disabled={!jsonPaste.trim() || importing}
                className="h-7 gap-1.5 px-3 text-[10px] font-bold uppercase"
              >
                {importing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )}
                {importing ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import result toast */}
      {importResult && (
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-medium',
            importResult.ok
              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-400',
          )}
        >
          {importResult.ok ? (
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          )}
          {importResult.msg}
          <button onClick={() => setImportResult(null)} className="ml-auto opacity-50 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {/* Source Filter Bar */}
      {data && data.sources.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
            Source
          </span>
          {data.sources.map((s) => (
            <button
              key={s.handle}
              onClick={() => setActiveSource(activeSource === s.handle ? null : s.handle)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-colors',
                activeSource === s.handle
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/50 hover:bg-muted/50 text-muted-foreground',
              )}
            >
              <span>@{s.handle}</span>
              <span className="font-mono opacity-60">{s.tweet_count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Type Filter */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
          Type
        </span>
        {(Object.entries(TYPE_CONFIG) as [TweetType, typeof TYPE_CONFIG.showtimes][]).map(([type, cfg]) => (
          <button
            key={type}
            onClick={() => setActiveType(activeType === type ? null : type)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-colors',
              activeType === type
                ? 'bg-primary text-primary-foreground border-primary'
                : `border-border/50 hover:bg-muted/50 ${cfg.color}`,
            )}
          >
            <cfg.icon className="w-3 h-3" />
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Tweet List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : data && data.tweets.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">
            {data.total} tweets {activeSource ? `from @${activeSource}` : ''} {activeType ? `· ${activeType}` : ''}
          </div>
          {data.tweets.map((tweet) => (
            <TweetCard key={tweet.id} tweet={tweet} />
          ))}
        </div>
      ) : (
        <Card className="border-border/30">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-xs">No tweets imported yet.</p>
            <p className="text-muted-foreground/50 text-[10px] mt-1">
              Click &quot;Paste JSON&quot; to paste a Twitter API response, or &quot;Upload File&quot; to import a .json file.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tweet Card ────────────────────────────────────────────

function TweetCard({ tweet }: { tweet: CompetitorTweet }) {
  const [expanded, setExpanded] = useState(false);

  const cfg = TYPE_CONFIG[tweet.tweet_type];
  const TypeIcon = cfg.icon;

  let displayDate = tweet.created_at;
  try {
    displayDate = format(new Date(tweet.created_at), 'EEE, d MMM yyyy · HH:mm');
  } catch { /* keep raw */ }

  return (
    <div
      className={cn(
        'rounded-lg border border-border/30 bg-muted/5 hover:bg-muted/10 transition-colors',
        'px-4 py-2.5',
      )}
    >
      {/* Top row: date + badges */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-mono font-bold text-muted-foreground">{displayDate}</span>
        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-bold uppercase', cfg.color)}>
          <TypeIcon className="w-2.5 h-2.5" />
          {cfg.label}
        </span>
        <span className="text-[9px] text-muted-foreground/40">·</span>
        <span className="text-[9px] text-muted-foreground/50">@{tweet.source_handle}</span>
      </div>

      {/* Tweet text */}
      <div
        className={cn(
          'text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-foreground/80',
          !expanded && 'max-h-[4.5em] overflow-hidden relative',
        )}
      >
        {expanded ? tweet.text : tweet.text.split('\n').slice(0, 5).join('\n')}
        {!expanded && tweet.text.split('\n').length > 5 && (
          <button
            onClick={() => setExpanded(true)}
            className="absolute bottom-0 right-0 text-primary text-[10px] font-bold hover:underline flex items-center gap-0.5 pl-6 bg-gradient-to-l from-muted/5 via-muted/5 to-transparent"
          >
            more <ChevronDown className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}
