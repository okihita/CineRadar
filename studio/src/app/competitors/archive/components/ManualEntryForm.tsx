'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Loader2, CheckCircle2, PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────

type DataType = 'showtimes' | 'admissions';

interface ShowtimeRow {
  title_cp: string;
  showtimes: number;
  daily_change_pct: number;
}

interface AdmissionRow {
  title_cp: string;
  daily_admissions: number;
  daily_change_pct: number;
  cumulative_admissions: number;
}

type EntryRow = ShowtimeRow | AdmissionRow;

interface ManualEntryFormProps {
  tweetId: string;
  postingDate: string; // Twitter date format
  onSaved: () => void;
  onCancel: () => void;
}

// ─── Component ─────────────────────────────────────────────

export function ManualEntryForm({ tweetId, postingDate, onSaved, onCancel }: ManualEntryFormProps) {
  const [dataType, setDataType] = useState<DataType>('admissions');
  const [date, setDate] = useState(() => {
    try { return format(new Date(postingDate), 'yyyy-MM-dd'); } catch { return ''; }
  });
  const [rows, setRows] = useState<EntryRow[]>([
    dataType === 'showtimes'
      ? { title_cp: '', showtimes: 0, daily_change_pct: 0 }
      : { title_cp: '', daily_admissions: 0, daily_change_pct: 0, cumulative_admissions: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRow = () => {
    if (dataType === 'showtimes') {
      setRows(prev => [...prev, { title_cp: '', showtimes: 0, daily_change_pct: 0 }]);
    } else {
      setRows(prev => [...prev, { title_cp: '', daily_admissions: 0, daily_change_pct: 0, cumulative_admissions: 0 }]);
    }
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: string, value: string | number) => {
    setRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const handleDataTypeChange = (newType: DataType) => {
    setDataType(newType);
    if (newType === 'showtimes') {
      setRows([{ title_cp: '', showtimes: 0, daily_change_pct: 0 }]);
    } else {
      setRows([{ title_cp: '', daily_admissions: 0, daily_change_pct: 0, cumulative_admissions: 0 }]);
    }
  };

  const handleSave = async () => {
    // Validate
    if (!date) { setError('Date is required'); return; }
    const validRows = rows.filter(r => (r as { title_cp: string }).title_cp.trim());
    if (validRows.length === 0) { setError('At least one entry with a title is required'); return; }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/competitors/manual-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweet_id: tweetId,
          date,
          data_type: dataType,
          entries: validRows,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`${dataType === 'showtimes' ? 'Showtimes' : 'Admissions'} saved`, {
          description: `${validRows.length} entries for ${date}`,
        });
        onSaved();
      } else {
        setError(json.error || 'Save failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const isShowtimes = dataType === 'showtimes';

  return (
    <div className="mt-4 pt-4 border-t border-primary/10 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PencilLine className="w-3.5 h-3.5 text-primary/60" />
          <span className="text-sm font-black uppercase tracking-[0.2em] text-primary/60">
            Manual Data Entry
          </span>
        </div>
        <button
          onClick={onCancel}
          className="text-sm text-muted-foreground/40 hover:text-muted-foreground/80 uppercase font-bold tracking-widest transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Type toggle */}
      <div className="flex gap-2 mb-4">
        {(['admissions', 'showtimes'] as DataType[]).map(t => (
          <button
            key={t}
            onClick={() => handleDataTypeChange(t)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-black uppercase tracking-widest border transition-all',
              dataType === t
                ? 'bg-primary/10 text-primary border-primary/30 shadow-sm'
                : 'bg-muted/30 text-muted-foreground/40 border-border/20 hover:border-border/40'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Date input */}
      <div className="mb-4">
        <label className="text-sm font-black uppercase tracking-widest text-muted-foreground/50 mb-1.5 block">
          Target Date
        </label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full max-w-[200px] px-3 py-1.5 rounded-lg border border-border/40 bg-background text-sm font-medium focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {/* Entries table */}
      <div className="space-y-2 mb-4">
        {/* Header row */}
        <div className={cn(
          'grid gap-2 px-3 py-1.5 text-sm font-black uppercase tracking-widest text-muted-foreground/40',
          isShowtimes ? 'grid-cols-[1fr_80px_80px_32px]' : 'grid-cols-[1fr_80px_80px_80px_32px]'
        )}>
          <span>Title</span>
          <span>{isShowtimes ? 'Showtimes' : 'Daily Adm.'}</span>
          <span>Chg %</span>
          {!isShowtimes && <span>Cumul.</span>}
          <span />
        </div>

        {/* Data rows */}
        {rows.map((row, idx) => (
          <div
            key={idx}
            className={cn(
              'grid gap-2 items-center',
              isShowtimes ? 'grid-cols-[1fr_80px_80px_32px]' : 'grid-cols-[1fr_80px_80px_80px_32px]'
            )}
          >
            <input
              type="text"
              placeholder="Movie title"
              value={(row as { title_cp: string }).title_cp}
              onChange={e => updateRow(idx, 'title_cp', e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border/30 bg-background text-sm font-medium focus:outline-none focus:border-primary/40"
            />
            <input
              type="number"
              value={isShowtimes ? (row as ShowtimeRow).showtimes : (row as AdmissionRow).daily_admissions}
              onChange={e => updateRow(idx, isShowtimes ? 'showtimes' : 'daily_admissions', Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-border/30 bg-background text-sm font-mono focus:outline-none focus:border-primary/40"
            />
            <input
              type="number"
              step="0.1"
              value={(row as { daily_change_pct: number }).daily_change_pct}
              onChange={e => updateRow(idx, 'daily_change_pct', Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-border/30 bg-background text-sm font-mono focus:outline-none focus:border-primary/40"
            />
            {!isShowtimes && (
              <input
                type="number"
                value={(row as AdmissionRow).cumulative_admissions}
                onChange={e => updateRow(idx, 'cumulative_admissions', Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-border/30 bg-background text-sm font-mono focus:outline-none focus:border-primary/40"
              />
            )}
            <button
              onClick={() => removeRow(idx)}
              disabled={rows.length <= 1}
              className={cn(
                'w-6 h-6 flex items-center justify-center rounded-md transition-colors',
                rows.length <= 1
                  ? 'text-muted-foreground/20 cursor-not-allowed'
                  : 'text-red-400/60 hover:text-red-500 hover:bg-red-500/10'
              )}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}

        <button
          onClick={addRow}
          className="flex items-center gap-1.5 text-sm font-black uppercase tracking-widest text-muted-foreground/40 hover:text-primary/60 transition-colors mt-1"
        >
          <Plus className="w-3 h-3" /> Add Row
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20 text-sm text-red-600 font-bold">
          {error}
        </div>
      )}

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saving}
        size="sm"
        className="h-8 gap-2 px-4 text-sm font-black uppercase tracking-wider rounded-xl"
      >
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5" />
        )}
        Save {dataType}
      </Button>
    </div>
  );
}
