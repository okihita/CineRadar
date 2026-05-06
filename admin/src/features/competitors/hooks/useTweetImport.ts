import { useCallback, useRef, useState } from 'react';

interface ImportResult {
  ok: boolean;
  msg: string;
}

interface ScanSignal {
  date: string;
  type: string;
  len: number;
  truncated: boolean;
}

interface ScanReport {
  total: number;
  signals: ScanSignal[];
}

interface UseTweetImportOptions {
  onImportSuccess: () => Promise<void>;
}

/**
 * Manages the tweet import flow: paste/scan/file upload + actual API call.
 */
export function useTweetImport({ onImportSuccess }: UseTweetImportOptions) {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [jsonPaste, setJsonPaste] = useState('');
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        await onImportSuccess();
      } else {
        setImportResult({ ok: false, msg: result.error || 'Import failed' });
      }
    } catch {
      setImportResult({ ok: false, msg: 'Invalid JSON' });
    } finally {
      setImporting(false);
    }
  }, [onImportSuccess]);

  const handleScan = useCallback(() => {
    if (!jsonPaste.trim()) return;
    try {
      const json = JSON.parse(jsonPaste);
      const tweets = extractTweetsWithGreedyScour(json);

      const signals = tweets.map(t => ({
        date: t.created_at.split(' ').slice(1, 4).join(' '),
        type: t.text.startsWith('SHOWTIMES') ? 'Show' : 'Adm',
        len: t.text.length,
        truncated: t.text.endsWith('...') || t.text.length < 100,
      }));

      setScanReport({ total: tweets.length, signals: signals.slice(0, 10) });
    } catch {
      setImportResult({ ok: false, msg: 'Invalid JSON for scanning' });
    }
  }, [jsonPaste]);

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

  return {
    importing,
    importResult,
    setImportResult,
    isImportModalOpen,
    setIsImportModalOpen,
    jsonPaste,
    setJsonPaste,
    scanReport,
    setScanReport,
    fileInputRef,
    handleScan,
    handlePasteImport,
    handleFileImport,
  };
}

// ─── Greedy JSON Scour (local to this hook) ────────────────

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
        created_at: (legacy?.created_at as string) || '',
      });
    }
  }

  return results;
}
