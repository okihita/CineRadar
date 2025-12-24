
'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Activity, Clock, Layers } from 'lucide-react';
import { SeatLayoutVisualizer } from './SeatLayoutVisualizer';

interface JITItem {
    showtime_id: string;
    time: string; // Original showtime e.g. "12:35"
    movie: string;
    theatre: string;
    status: string;
    occupancy: number;
    layout: [string, number[]][];
}

interface JITTimelineSlot {
    time: string;
    count: number;
    items: JITItem[];
}

export const JITGranularMonitor: React.FC = () => {
    const [timeline, setTimeline] = useState<JITTimelineSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());
    const [viewingLayout, setViewingLayout] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/scraper/jit');
                const data = await res.json();
                if (data.timeline) {
                    setTimeline(data.timeline);
                }
            } catch (err) {
                console.error('Failed to fetch JIT data', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const toggleSlot = (time: string) => {
        const next = new Set(expandedSlots);
        if (next.has(time)) next.delete(time);
        else next.add(time);
        setExpandedSlots(next);
    };

    if (loading) return (
        <div className="flex flex-col gap-4 animate-pulse">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-800/50 rounded-xl border border-slate-700/50" />
            ))}
        </div>
    );

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-2 mb-2">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Granular JIT Health Check
                </h3>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                    Real-time (30s sync)
                </span>
            </div>

            <div className="flex flex-col gap-2">
                {timeline.map((slot) => (
                    <div key={slot.time} className="group">
                        <div
                            onClick={() => toggleSlot(slot.time)}
                            className={`flex items-center justify-between p-4 cursor-pointer transition-all border ${expandedSlots.has(slot.time)
                                ? 'bg-slate-800/80 border-emerald-500/30 rounded-t-xl'
                                : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/40 rounded-xl'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${expandedSlots.has(slot.time) ? 'bg-emerald-500/10' : 'bg-slate-800'}`}>
                                    <Clock className={`w-4 h-4 ${expandedSlots.has(slot.time) ? 'text-emerald-400' : 'text-slate-500'}`} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-200">{slot.time}</div>
                                    <div className="text-[11px] text-slate-500">{slot.count} showtimes captured</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="px-2 py-1 bg-emerald-500/10 rounded flex items-center gap-2 border border-emerald-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">Healthy</span>
                                </div>
                                {expandedSlots.has(slot.time) ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                            </div>
                        </div>

                        {expandedSlots.has(slot.time) && (
                            <div className="bg-slate-900/60 border-x border-b border-emerald-500/20 rounded-b-xl overflow-hidden divide-y divide-slate-800/50">
                                {slot.items.map((item) => (
                                    <div key={item.showtime_id} className="p-4 flex flex-col gap-4 hover:bg-slate-800/20 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{item.time}</span>
                                                    <span className="text-sm font-medium text-slate-200">{item.movie}</span>
                                                </div>
                                                <span className="text-[11px] text-slate-500">{item.theatre}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right flex flex-col items-end">
                                                    <span className="text-[11px] font-mono text-slate-400">{item.occupancy}% sold</span>
                                                    <div className="w-20 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500"
                                                            style={{ width: `${item.occupancy}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setViewingLayout(viewingLayout === item.showtime_id ? null : item.showtime_id)}
                                                    className={`p-2 rounded-lg transition-colors border ${viewingLayout === item.showtime_id
                                                        ? 'bg-emerald-500 text-slate-900 border-emerald-400'
                                                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                                                        }`}
                                                >
                                                    <Layers className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {viewingLayout === item.showtime_id && (
                                            <div className="animate-in slide-in-from-top-2 duration-200">
                                                <SeatLayoutVisualizer layout={item.layout} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
