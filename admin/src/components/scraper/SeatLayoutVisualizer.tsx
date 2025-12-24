
import React from 'react';

interface SeatLayoutVisualizerProps {
    layout: [string, number[]][];
}

export const SeatLayoutVisualizer: React.FC<SeatLayoutVisualizerProps> = ({ layout }) => {
    if (!layout || layout.length === 0) {
        return <div className="text-slate-500 italic text-xs">No layout data available</div>;
    }

    return (
        <div className="flex flex-col gap-1 p-3 bg-slate-950/50 rounded-lg overflow-auto max-h-80 border border-slate-800">
            <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Seating Map</span>
                <div className="flex gap-3">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                        <span className="text-[10px] text-slate-400">Available</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm bg-rose-500" />
                        <span className="text-[10px] text-slate-400">Sold</span>
                    </div>
                </div>
            </div>
            {layout.map(([rowName, seats], idx) => (
                <div key={idx} className="flex items-center gap-2">
                    <span className="w-5 text-[10px] text-slate-600 font-mono text-center">{rowName}</span>
                    <div className="flex gap-0.5">
                        {seats.map((status, sIdx) => (
                            <div
                                key={sIdx}
                                className={`w-2.5 h-2.5 rounded-[1px] transition-colors ${status === 1
                                        ? 'bg-emerald-500/80 hover:bg-emerald-400'
                                        : 'bg-rose-500/40 hover:bg-rose-500/60'
                                    }`}
                                title={status === 1 ? 'Available' : 'Sold'}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
