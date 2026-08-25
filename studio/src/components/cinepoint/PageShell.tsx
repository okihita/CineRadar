'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── PageHeader ─────────────────────────────────────────────

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** If true, title uses tracking-tight instead of tracking-tighter (for person names) */
  titleNoUppercase?: boolean;
  backHref?: string;
  right?: ReactNode;
}

export function PageHeader({ icon, title, subtitle, titleNoUppercase, backHref, right }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="w-9 h-9 rounded-xl border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-primary/10 border-primary/20">
          {icon}
        </div>
        <div>
          <h1 className={cn(
            'text-base font-black',
            titleNoUppercase ? 'tracking-tight' : 'uppercase tracking-tighter',
          )}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

// ─── PageLoader ──────────────────────────────────────────────

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message }: PageLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary opacity-40" />
      {message && (
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">
          {message}
        </p>
      )}
    </div>
  );
}

// ─── PageError ───────────────────────────────────────────────

interface PageErrorProps {
  error?: string | null;
  backHref?: string;
}

export function PageError({ error, backHref }: PageErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
      <p className="text-sm text-red-500 font-bold">Failed to load data</p>
      {error && <p className="text-xs text-muted-foreground">{error}</p>}
      {backHref && (
        <Link href={backHref} className="text-xs text-primary hover:underline">← Back</Link>
      )}
    </div>
  );
}
