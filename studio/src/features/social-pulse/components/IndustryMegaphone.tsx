'use client';

import React from 'react';
import { Megaphone, ExternalLink, TrendingUp, Play } from 'lucide-react';
import { SocialSignal } from '../types';

interface IndustryMegaphoneProps {
    narrative: string;
    signals: SocialSignal[];
}

export function IndustryMegaphone({ narrative, signals }: IndustryMegaphoneProps) {
    return (
        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 space-y-6">
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Megaphone className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tighter">Industry Megaphone</h2>
                </div>
                
                <div className="max-w-2xl">
                    <p className="text-foreground/80 leading-relaxed font-medium italic border-l-4 border-primary/30 pl-4 py-1">
                        &quot;{narrative}&quot;
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {signals.map((signal, i) => (
                        <a 
                            key={i} 
                            href={signal.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-3 bg-background/50 hover:bg-background rounded-2xl border border-border/50 transition-all group/item"
                        >
                            <div className="p-2.5 bg-muted rounded-xl">
                                {signal.source === 'YouTube' ? <Play className="w-4 h-4 text-red-500" /> : <TrendingUp className="w-4 h-4 text-blue-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold truncate uppercase tracking-tight">{signal.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-black uppercase text-muted-foreground/60">{signal.author}</span>
                                    <span className="text-sm font-mono text-primary font-bold">{signal.views}</span>
                                </div>
                            </div>
                            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
