'use client';

import { Info, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PasteArea } from '@/features/competitors/components/PasteArea';
import { TweetUrlImport } from '@/features/competitors/components/TweetUrlImport';
import { buildCinepointVerifyUrl } from '@/features/competitors/lib/verify-link';
import type { PageData } from './useDatePageData';

interface DataEntryPanelProps {
  date: string;
  data: PageData | null;
  fetchData: () => Promise<void>;
  onSaveShowtimes: (raw: string) => Promise<{ success: boolean; parsed_count?: number }>;
  onSaveAdmissions: (raw: string) => Promise<{ success: boolean; parsed_count?: number }>;
}

export function DataEntryPanel({
  date,
  data,
  fetchData,
  onSaveShowtimes,
  onSaveAdmissions,
}: DataEntryPanelProps) {
  const hasShowtimes = (data?.snapshot?.showtimes?.parsed?.length ?? 0) > 0;
  const hasAdmissions = (data?.snapshot?.admissions?.parsed?.length ?? 0) > 0;
  const isPartial = (hasShowtimes && !hasAdmissions) || (!hasShowtimes && hasAdmissions);
  const isMissing = !hasShowtimes && !hasAdmissions;

  return (
    <div className="space-y-4">
      {/* Quick Import from Tweet URL */}
      <Card className="overflow-hidden border-border/50">
        <CardContent className="p-4">
          <TweetUrlImport onImported={fetchData} />
        </CardContent>
      </Card>

      {/* Check CinePoint — shown when data is partial or missing */}
      {(isPartial || isMissing) && (
        <a
          href={buildCinepointVerifyUrl(date)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/20 bg-muted/3 hover:bg-muted/8 transition-colors group"
        >
          <span className="text-sm text-muted-foreground/50 leading-relaxed">
            {isMissing
              ? 'CinePoint may not have posted this date — '
              : `Missing ${hasShowtimes ? 'admissions' : 'showtimes'} — `}
            <span className="text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
              check their timeline →
            </span>
          </span>
          <ExternalLink className="w-3 h-3 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors flex-shrink-0" />
        </a>
      )}

      {/* Manual Paste Areas */}
      <Card className="overflow-hidden border-border/50">
        <CardContent className="p-4 space-y-6">
          <PasteArea
            label="Showtime Count"
            placeholder={`Paste CinePoint showtime tweet here...\n\nExample:\n#Salmokji 2,466 (-3.90%)\n#GhostinTheCell 2,444 (+1.20%)`}
            existingRaw={data?.snapshot?.showtimes?.raw}
            parsedCount={data?.snapshot?.showtimes?.parsed?.length}
            onSave={onSaveShowtimes}
          />

          <div className="border-t border-border/30" />

          <PasteArea
            label="Estimated Admissions"
            placeholder={`Paste CinePoint admissions tweet here...\n\nExample:\n#Salmokji\n+74,385 (-3.90%) | 389,072`}
            existingRaw={data?.snapshot?.admissions?.raw}
            parsedCount={data?.snapshot?.admissions?.parsed?.length}
            onSave={onSaveAdmissions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
