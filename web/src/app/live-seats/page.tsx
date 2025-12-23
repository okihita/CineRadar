'use client';

import { useEffect, useState } from 'react';

interface SeatRow {
    seat_row: string;
    status: number;
}

interface SeatGroup {
    seat_code: string;
    seat_rows: SeatRow[];
}

interface SeatSnapshot {
    scraped_at: string;
    showtime: {
        movie_title: string;
        theatre_name: string;
        merchant: string;
        city: string;
        room_name: string;
        time: string;
    };
    occupancy: {
        total_seats: number;
        unavailable_seats: number;
        available_seats: number;
        occupancy_pct: number;
    };
    seat_map: SeatGroup[];
}

// Status codes (verified Dec 23, 2025):
// 1 = Available (can purchase)
// 5 = Unavailable (sold or blocked)
// 6 = Unavailable (sold or blocked)
const STATUS_COLORS: Record<number, string> = {
    1: '#22c55e', // green - available
    5: '#ef4444', // red - unavailable
    6: '#ef4444', // red - unavailable
};

const STATUS_LABELS: Record<number, string> = {
    1: 'Available',
    5: 'Unavailable',
    6: 'Unavailable',
};

export default function LiveSeatMapPage() {
    const [data, setData] = useState<SeatSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/live-seats')
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch');
                return res.json();
            })
            .then(setData)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="text-xl">Loading seat map...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="text-xl text-red-400">Error: {error || 'No data'}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">{data.showtime.movie_title}</h1>
                    <div className="text-gray-400 space-y-1">
                        <p>🏢 {data.showtime.theatre_name} ({data.showtime.merchant})</p>
                        <p>📍 {data.showtime.city} • {data.showtime.room_name}</p>
                        <p>🕐 {data.showtime.time}</p>
                        <p className="text-xs">Scraped: {new Date(data.scraped_at).toLocaleString()}</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-gray-800 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold">{data.occupancy.total_seats}</div>
                        <div className="text-gray-400 text-sm">Total</div>
                    </div>
                    <div className="bg-green-900 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-400">{data.occupancy.available_seats}</div>
                        <div className="text-gray-400 text-sm">Available</div>
                    </div>
                    <div className="bg-red-900 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-red-400">{data.occupancy.unavailable_seats}</div>
                        <div className="text-gray-400 text-sm">Unavailable</div>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex gap-6 mb-6 justify-center">
                    {Object.entries(STATUS_LABELS).map(([status, label]) => (
                        <div key={status} className="flex items-center gap-2">
                            <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: STATUS_COLORS[Number(status)] }}
                            />
                            <span className="text-sm text-gray-300">{label}</span>
                        </div>
                    ))}
                </div>

                {/* Screen indicator */}
                <div className="text-center mb-4">
                    <div className="inline-block bg-gray-700 px-12 py-2 rounded-t-lg text-sm text-gray-400">
                        SCREEN
                    </div>
                </div>

                {/* Seat Map */}
                <div className="overflow-x-auto">
                    <div className="inline-block min-w-full">
                        {data.seat_map.map(row => (
                            <div key={row.seat_code} className="flex items-center gap-1 mb-1">
                                <div className="w-6 text-center text-gray-500 text-sm font-mono">
                                    {row.seat_code}
                                </div>
                                <div className="flex gap-1">
                                    {row.seat_rows.map(seat => (
                                        <div
                                            key={seat.seat_row}
                                            className="w-6 h-6 rounded text-xs flex items-center justify-center font-mono cursor-default"
                                            style={{ backgroundColor: STATUS_COLORS[seat.status] || '#374151' }}
                                            title={`${seat.seat_row} - ${STATUS_LABELS[seat.status] || 'Unknown'}`}
                                        >
                                            {seat.seat_row.replace(row.seat_code, '')}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Occupancy Bar */}
                <div className="mt-8">
                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                        <span>Occupancy</span>
                        <span>{data.occupancy.occupancy_pct}%</span>
                    </div>
                    <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all"
                            style={{ width: `${data.occupancy.occupancy_pct}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
