'use client';

import Link from 'next/link';
import { Swords, ExternalLink, Archive, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function EmptyState() {
  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="py-12 px-8">
        <div className="max-w-lg mx-auto text-center space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Swords className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-tighter">Getting Started with Competitor Tracking</h2>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              CineRadar compares your cinema data against <span className="font-bold text-foreground">@cinepoint_</span> on X/Twitter.
              Import their tweets to start benchmarking.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <div className="p-4 rounded-xl border border-border/40 bg-muted/5 hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <ExternalLink className="w-3 h-3 text-emerald-600" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider">Easy Import</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Paste individual tweet URLs. No developer tools needed.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border/40 bg-muted/5 hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Archive className="w-3 h-3 text-blue-600" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider">Advanced Import</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Paste raw Twitter API JSON from browser DevTools. Best for bulk initial import.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link href="/competitors/archive">
              <Button size="sm" className="h-8 gap-2 px-5 text-[10px] font-bold uppercase tracking-wider">
                Open Tweet Archive
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
            <a
              href="https://x.com/cinepoint_"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="h-8 gap-2 px-4 text-[10px] font-bold uppercase tracking-wider">
                <ExternalLink className="w-3 h-3" />
                Open @cinepoint_
              </Button>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
