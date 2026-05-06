'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, ClipboardPaste, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importing: boolean;
  jsonPaste: string;
  onJsonPasteChange: (val: string) => void;
  scanReport: ScanReport | null;
  onScan: () => void;
  onImport: () => void;
}

export function ImportModal({
  open,
  onOpenChange,
  importing,
  jsonPaste,
  onJsonPasteChange,
  scanReport,
  onScan,
  onImport,
}: ImportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                onJsonPasteChange(e.target.value);
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
                  onClick={onScan}
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
                onClick={onImport}
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
  );
}
