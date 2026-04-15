'use client';

import React from 'react';
import { ShowtimeSnapshot, ShowtimeRow } from './ShowtimeTable';

interface ForensicShowtimeTableProps {
    showtimes: ShowtimeSnapshot[];
    movieId: string;
    date: string;
}

export function ForensicShowtimeTable({ showtimes, movieId, date }: ForensicShowtimeTableProps) {
    // Sort by time
    const sorted = [...showtimes].sort((a, b) => (a.showtime || '').localeCompare(b.showtime || ''));

    return (
        <div className="overflow-x-auto rounded-xl border border-primary/5 shadow-sm bg-card">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-muted/30 border-b text-left text-muted-foreground/60 uppercase text-[9px] font-black tracking-widest">
                        <th className="py-4 px-4 w-24">Time</th>
                        <th className="py-4 px-4">Room</th>
                        <th className="py-4 px-4">Price</th>
                        <th className="py-4 px-4 w-48">Occupancy</th>
                        <th className="py-4 px-4 text-right w-24">Audience</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                    {sorted.map(st => (
                        <ShowtimeRow 
                            key={st.id} 
                            showtime={st} 
                            movieId={movieId} 
                            date={date} 
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
