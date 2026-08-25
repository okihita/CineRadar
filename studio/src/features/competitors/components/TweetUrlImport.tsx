'use client';

import { useCallback, useState } from 'react';
import { CheckCircle2, AlertCircle, ExternalLink, Loader2, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TweetUrlImportProps {
  onImported: () => void | Promise<void>;
  /** Hide the section heading (useful when embedded in a card with its own title) */
  hideHeading?: boolean;
}

interface ScrapeResult {
  type: string;
  text_preview: string;
  media_count: number;
  snapshot: { date: string; type: string; parsed_count: number } | null;
}

export function TweetUrlImport({ onImported, hideHeading }: TweetUrlImportProps) {
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; detail?: ScrapeResult } | null>(null);

  const handleFetch = useCallback(async () => {
    if (!url.trim()) return;

    setFetching(true);
    setResult(null);

    try {
      const res = await fetch('/api/competitors/scrape-tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const json = await res.json();

      if (json.success) {
        setResult({ ok: true, msg: 'Tweet fetched and imported successfully', detail: json.data });
        setUrl('');
        await onImported();
      } else {
        setResult({ ok: false, msg: json.error || 'Failed to fetch tweet' });
      }
    } catch {
      setResult({ ok: false, msg: 'Network error — check your connection' });
    } finally {
      setFetching(false);
    }
  }, [url, onImported]);

  const isValidUrl = /(?:x\.com|twitter\.com)\/\w+\/status\/\d+/.test(url.trim()) || /^\d+$/.test(url.trim());

  return (
    <div className="space-y-3">
      {!hideHeading && (
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Import from Tweet URL
        </h3>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setResult(null);
            }}
            placeholder="https://x.com/cinepoint_/status/..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isValidUrl && !fetching) handleFetch();
            }}
            className={cn(
              'w-full rounded-md border bg-muted/5 pl-9 pr-3 py-2 text-xs font-mono',
              'placeholder:text-muted-foreground/30',
              'focus:outline-none focus:ring-1 focus:ring-primary/30',
              'border-border/50',
            )}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleFetch}
          disabled={!isValidUrl || fetching}
          className="h-[34px] gap-1.5 px-4 text-[10px] font-bold uppercase tracking-wider"
        >
          {fetching ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <ExternalLink className="w-3 h-3" />
          )}
          {fetching ? 'Fetching...' : 'Fetch'}
        </Button>
      </div>

      {result && (
        <div
          className={cn(
            'flex items-start gap-2 px-3 py-2 rounded-lg border text-[11px] font-medium animate-in fade-in slide-in-from-top-1 duration-300',
            result.ok
              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-400',
          )}
        >
          {result.ok ? (
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <span>{result.msg}</span>
            {result.detail?.snapshot && (
              <span className="ml-1 text-muted-foreground">
                — {result.detail.snapshot.parsed_count} movies parsed for {result.detail.snapshot.date}
              </span>
            )}
          </div>
          {result.ok && (
            <button
              onClick={() => setResult(null)}
              className="text-[9px] font-bold uppercase tracking-wider text-emerald-600/60 hover:text-emerald-600 px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors flex-shrink-0"
            >
              Fetch Another
            </button>
          )}
        </div>
      )}
    </div>
  );
}
