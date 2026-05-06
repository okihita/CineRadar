'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ClipboardPaste, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasteAreaProps {
  label: string;
  placeholder: string;
  existingRaw?: string;
  parsedCount?: number;
  onSave: (raw: string) => Promise<{ success: boolean; parsed_count?: number }>;
}

export function PasteArea({
  label,
  placeholder,
  existingRaw,
  parsedCount,
  onSave,
}: PasteAreaProps) {
  const [raw, setRaw] = useState(existingRaw || '');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; count: number } | null>(
    existingRaw ? { ok: true, count: parsedCount || 0 } : null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [raw, existingRaw, autoResize]);

  const handleSave = useCallback(async () => {
    if (!raw.trim()) return;
    setSaving(true);
    setResult(null);
    try {
      const res = await onSave(raw.trim());
      setResult({ ok: res.success, count: res.parsed_count || 0 });
    } catch {
      setResult({ ok: false, count: 0 });
    } finally {
      setSaving(false);
    }
  }, [raw, onSave]);

  const hasContent = raw.trim().length > 0;
  const isDirty = raw.trim() !== (existingRaw || '');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {label}
        </h3>
        {result && (
          <span
            className={cn(
              'text-[10px] font-bold flex items-center gap-1',
              result.ok ? 'text-emerald-600' : 'text-red-500',
            )}
          >
            {result.ok ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                {result.count} movies parsed
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3" />
                Parse failed
              </>
            )}
          </span>
        )}
      </div>

      <textarea
        ref={textareaRef}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          setResult(null);
        }}
        placeholder={placeholder}
        rows={existingRaw ? undefined : 8}
        className={cn(
          'w-full rounded-md border bg-muted/5 px-3 py-2 text-xs font-mono',
          'placeholder:text-muted-foreground/40 resize-none',
          'focus:outline-none focus:ring-1 focus:ring-primary/30',
          'border-border/50',
          'overflow-hidden',
        )}
      />

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={!hasContent || saving || !isDirty}
          className="h-7 gap-1.5 px-3 text-[10px] font-bold uppercase"
        >
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <ClipboardPaste className="w-3 h-3" />
          )}
          {saving ? 'Parsing...' : 'Save & Parse'}
        </Button>
      </div>
    </div>
  );
}
