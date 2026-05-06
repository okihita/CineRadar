'use client';

import { useCallback, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchUrlImportProps {
  onComplete: () => void;
}

interface BatchItem {
  url: string;
  status: 'pending' | 'fetching' | 'success' | 'error';
  message?: string;
}

export function BatchUrlImport({ onComplete }: BatchUrlImportProps) {
  const [input, setInput] = useState('');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const urls = input
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const isValid = urls.length > 0 && urls.every((u) =>
    /(?:x\.com|twitter\.com)\/\w+\/status\/\d+/.test(u) || /^\d+$/.test(u),
  );

  const handleFetch = useCallback(async () => {
    if (urls.length === 0) return;

    const batchItems: BatchItem[] = urls.map((url) => ({ url, status: 'pending' as const }));
    setItems(batchItems);
    setProcessing(true);
    setDone(false);

    try {
      const res = await fetch('/api/competitors/scrape-tweet/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      const json = await res.json();

      if (json.success) {
        // Map results back to items
        const updated = batchItems.map((item, i) => {
          const result = json.data.results[i];
          if (!result) return { ...item, status: 'error' as const, message: 'No result' };

          if (result.success) {
            const snap = result.snapshot;
            return {
              ...item,
              status: 'success' as const,
              message: snap
                ? `${snap.parsed_count} movies → ${snap.date}`
                : result.type === 'other' ? 'Tweet stored (not a data tweet)' : 'Imported',
            };
          }
          return { ...item, status: 'error' as const, message: result.error || 'Failed' };
        });

        setItems(updated);
        setDone(true);

        const hadSuccess = updated.some((i) => i.status === 'success');
        if (hadSuccess) {
          onComplete();
        }
      } else {
        setItems(batchItems.map((item) => ({ ...item, status: 'error' as const, message: json.error })));
        setDone(true);
      }
    } catch {
      setItems(batchItems.map((item) => ({ ...item, status: 'error' as const, message: 'Network error' })));
      setDone(true);
    } finally {
      setProcessing(false);
    }
  }, [urls, onComplete]);

  const successCount = items.filter((i) => i.status === 'success').length;
  const progress = items.length > 0 ? (items.filter((i) => i.status !== 'pending' && i.status !== 'fetching').length / items.length) * 100 : 0;

  return (
    <div className="space-y-3">
      <textarea
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          if (items.length > 0) {
            setItems([]);
            setDone(false);
          }
        }}
        placeholder={'Paste tweet URLs, one per line:\n\nhttps://x.com/cinepoint_/status/123456...\nhttps://x.com/cinepoint_/status/789012...'}
        rows={5}
        disabled={processing}
        className={cn(
          'w-full rounded-md border bg-muted/5 px-3 py-2 text-xs font-mono',
          'placeholder:text-muted-foreground/30 resize-none',
          'focus:outline-none focus:ring-1 focus:ring-primary/30',
          'border-border/50 disabled:opacity-50',
        )}
      />

      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground/40 font-medium">
          {urls.length > 0 ? `${urls.length} URL${urls.length !== 1 ? 's' : ''} detected` : 'Paste URLs above'}
        </span>
        <button
          onClick={handleFetch}
          disabled={!isValid || processing}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all',
            isValid && !processing
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted/30 text-muted-foreground/40 cursor-not-allowed',
          )}
        >
          {processing ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <ExternalLink className="w-3 h-3" />
              Fetch All
            </>
          )}
        </button>
      </div>

      {/* Progress */}
      {processing && (
        <div className="space-y-1">
          <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {items.length > 0 && done && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold mb-2">
            <span className={cn(
              successCount === items.length ? 'text-emerald-600' : 'text-amber-600',
            )}>
              {successCount}/{items.length} succeeded
            </span>
            {successCount > 0 && (
              <button
                onClick={() => {
                  setInput('');
                  setItems([]);
                  setDone(false);
                }}
                className="text-primary hover:underline"
              >
                Import more
              </button>
            )}
          </div>
          <div className="max-h-[200px] overflow-y-auto space-y-1">
            {items.map((item, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] font-medium',
                  item.status === 'success' ? 'bg-emerald-500/5 text-emerald-700 dark:text-emerald-400' :
                  item.status === 'error' ? 'bg-red-500/5 text-red-600' :
                  'bg-muted/20 text-muted-foreground',
                )}
              >
                {item.status === 'success' ? (
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                )}
                <span className="truncate flex-1">{item.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
