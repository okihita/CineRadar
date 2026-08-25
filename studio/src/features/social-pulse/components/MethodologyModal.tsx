'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Info, Calculator, TrendingUp, Share2, Target } from 'lucide-react';

export function MethodologyModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-all border border-primary/20 group">
          <Calculator className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-wider">How it&apos;s calculated</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-xl border-border/40 rounded-[2rem] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase tracking-tighter">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Target className="w-6 h-6 text-primary" />
            </div>
            Forensic Methodology
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-8 py-6">
          {/* 1. Pulse Score */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-primary">
              <Share2 className="w-4 h-4" />
              <h4>Pulse Score (Social Gravity)</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/40">
                <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Weighting</p>
                <ul className="space-y-2 text-xs font-medium">
                  <li className="flex justify-between"><span>Google Trends (RSV)</span> <span className="text-primary font-bold">60%</span></li>
                  <li className="flex justify-between"><span>YouTube View Velocity</span> <span className="text-primary font-bold">30%</span></li>
                  <li className="flex justify-between"><span>TMDB Popularity</span> <span className="text-primary font-bold">10%</span></li>
                </ul>
              </div>
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/40">
                <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Definition</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  A normalized index representing the &quot;Top of Mind&quot; awareness for a title. 
                  High velocity indicates a successful viral campaign or organic breakout.
                </p>
              </div>
            </div>
          </section>

          {/* 2. Perf Score */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-green-600">
              <TrendingUp className="w-4 h-4" />
              <h4>Perf Score (Sales Gravity)</h4>
            </div>
            <div className="p-4 bg-muted/30 rounded-2xl border border-border/40">
              <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">The Formula</p>
              <div className="bg-background/50 p-3 rounded-xl border border-border/20 font-mono text-xs text-center">
                Score = (Current Movie Sales / Max Daily Sales) * 100
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground mt-3 italic">
                Normalization allows us to compare &quot;Buzz&quot; against &quot;Sales&quot; on the same scale, regardless of whether it is a weekday or a block-buster weekend.
              </p>
            </div>
          </section>

          {/* 3. Divergence */}
          <section className="space-y-3 border-t border-border/20 pt-6">
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-foreground">
              <Info className="w-4 h-4" />
              <h4>The Divergence Delta</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Divergence identifies the gap between **what people are talking about** and **what people are buying.**
            </p>
            <div className="grid grid-cols-2 gap-3 text-[10px]">
              <div className="px-3 py-2 bg-blue-500/10 text-blue-600 rounded-lg border border-blue-500/20 font-bold uppercase">
                Buzz &gt; Sales = Pent-up Demand
              </div>
              <div className="px-3 py-2 bg-amber-500/10 text-amber-600 rounded-lg border border-amber-500/20 font-bold uppercase">
                Sales &gt; Buzz = Over-performing
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
