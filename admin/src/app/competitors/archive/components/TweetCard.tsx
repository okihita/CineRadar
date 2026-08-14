'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import Image from 'next/image';
import { JsonViewer, sortObjectKeys } from '@/components/JsonViewer';
import {
  Braces,
  Calendar,
  ExternalLink,
  Film,
  ImageIcon,
  MessageSquare,
  PencilLine,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CompetitorTweet, TweetType } from '@/features/competitors/types';
import { TWEET_TYPE_CONFIG } from '@/features/competitors/types';
import { LightboxCarousel } from './LightboxCarousel';
import { ManualEntryForm } from './ManualEntryForm';

const TYPE_ICONS: Record<TweetType, typeof Film> = {
  showtimes: Film,
  admissions: TrendingUp,
  other: MessageSquare,
};

interface TweetCardProps {
  tweet: CompetitorTweet;
  onManualEntry?: () => void;
}

export function TweetCard({ tweet, onManualEntry }: TweetCardProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const cfg = TWEET_TYPE_CONFIG[tweet.tweet_type];
  const TypeIcon = TYPE_ICONS[tweet.tweet_type];
  const mediaUrls = tweet.media_urls ?? [];

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
      {/* Profile Sidebar */}
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

      {/* Content Area */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Meta Row */}
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

        {/* Text Body */}
        <div
          className={cn(
            'text-[15px] leading-[1.6] whitespace-pre-wrap text-foreground/90 selection:bg-primary/20',
            'font-medium tracking-tight break-words',
          )}
        >
          {formatTweetText(tweet.text)}
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-4">
            {mediaUrls.length > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground/40 text-[9px] font-black uppercase tracking-widest border border-border/30 px-2 py-1 rounded-lg bg-muted/5">
                <ImageIcon className="w-3.5 h-3.5 opacity-60" />
                {mediaUrls.length} visuals
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

            <button
              onClick={() => setShowManualEntry(!showManualEntry)}
              className={cn(
                "flex items-center gap-2 text-[9px] font-black uppercase tracking-widest border px-2 py-1 rounded-lg transition-all",
                showManualEntry
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted/5 text-muted-foreground/30 border-border/30 hover:text-primary/60 hover:border-primary/30"
              )}
            >
              <PencilLine className="w-3 h-3" />
              Enter Data
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

        {/* Media Thumbnails */}
        {mediaUrls.length > 0 && (
          <div className="flex gap-2 mt-3">
            {mediaUrls.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setLightboxIdx(idx)}
                className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-border/20 bg-muted/20 shadow-sm hover:border-primary/40 hover:shadow-md transition-all group/thumb flex-shrink-0"
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  className="object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                  sizes="80px"
                />
                <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors" />
              </button>
            ))}
          </div>
        )}

        {/* Lightbox Carousel */}
        {lightboxIdx !== null && (
          <LightboxCarousel
            urls={mediaUrls}
            initialIndex={lightboxIdx}
            onClose={() => setLightboxIdx(null)}
          />
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

        {/* Manual Data Entry */}
        {showManualEntry && (
          <ManualEntryForm
            tweetId={tweet.id}
            postingDate={tweet.created_at}
            onSaved={() => {
              setShowManualEntry(false);
              onManualEntry?.();
            }}
            onCancel={() => setShowManualEntry(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────

/**
 * Highlight hashtags in tweet text with a blue, bold style.
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
