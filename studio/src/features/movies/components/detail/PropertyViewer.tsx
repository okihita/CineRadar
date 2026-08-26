'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';

interface PropertyViewerProps {
  value: unknown;
  depth?: number;
}

/**
 * PropertyViewer - A recursive component to render arbitrary data values
 * in a human-readable and visually structured way.
 */
export function PropertyViewer({ value, depth = 0 }: PropertyViewerProps) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }

  if (typeof value === 'boolean') {
    return (
      <Badge variant={value ? 'default' : 'outline'}>
        {value ? 'Yes' : 'No'}
      </Badge>
    );
  }

  if (typeof value === 'number') {
    return <span className="font-mono">{value.toLocaleString()}</span>;
  }

  if (typeof value === 'string') {
    // Check if it looks like a URL
    if (value.startsWith('http')) {
      return (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-primary hover:underline break-all text-sm"
        >
          {value}
        </a>
      );
    }
    return <span className="text-sm">{value}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground italic text-sm">empty</span>;
    }
    // Simple array of primitives
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <Badge key={i} variant="secondary" className="font-normal">
              {String(v)}
            </Badge>
          ))}
        </div>
      );
    }
    // Complex array
    return (
      <div className="space-y-2 pl-4 border-l-2 border-border">
        {value.map((v, i) => (
          <div key={i} className="text-sm">
            <span className="text-muted-foreground text-sm mr-2">[{i}]</span>
            <PropertyViewer value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj);

    // Special case: `rating_score` object from TIX.id
    if (entries.length > 0 && obj.vote_average !== undefined) {
      return (
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500 font-bold hover:bg-amber-600 shadow-none border-transparent">
            ★ {Number(obj.vote_average).toFixed(1)}
          </Badge>
          <span className="text-sm text-muted-foreground font-medium">({(obj.vote_count as number) || 0} votes)</span>
        </div>
      );
    }

    // Special case: `trailer` object from TIX.id
    if (obj.path && typeof obj.path === 'string' && obj.path.includes('youtu')) {
      return (
        <a href={obj.path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors">
          ▶ Watch Trailer
        </a>
      );
    }

    if (depth > 2) {
      return <pre className="text-sm bg-muted p-2 rounded overflow-auto border border-border">{JSON.stringify(value, null, 2)}</pre>;
    }
    return (
      <div className="space-y-2 pl-3 border-l-[3px] border-muted">
        {entries.map(([key, val]) => (
          <div key={key}>
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{key}</span>
            <div className="mt-0.5"><PropertyViewer value={val} depth={depth + 1} /></div>
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}
