'use client';

import { useState, useMemo } from 'react';

interface TheaterSchedule {
    theatre_id: string;
    theatre_name: string;
    merchant: string;
    address: string;
    lat?: number;
    lng?: number;
    rooms: {
        category: string;
        price: string;
        showtimes: string[];
    }[];
}

interface TheatreMapExplorerProps {
    cityData: { city: string; theatres: number }[];
    schedulesByCity?: Record<string, TheaterSchedule[]>;
}

// Chain colors
const CHAIN_COLORS: Record<string, string> = {
    'XXI': '#3B82F6',
    'CGV': '#EF4444',
    'Cinépolis': '#EAB308',
};

export default function TheatreMapExplorer({ cityData, schedulesByCity }: TheatreMapExplorerProps) {
    const [selectedCity, setSelectedCity] = useState<string | null>(null);

    const maxTheatres = Math.max(...cityData.map(c => c.theatres), 1);

    // Get city stats
    const cityStats = useMemo(() => {
        if (!selectedCity || !schedulesByCity?.[selectedCity]) return null;
        const theatres = schedulesByCity[selectedCity];

        const chainCounts: Record<string, number> = {};
        let totalShowtimes = 0;
        const prices: number[] = [];

        theatres.forEach(t => {
            chainCounts[t.merchant] = (chainCounts[t.merchant] || 0) + 1;
            t.rooms.forEach(r => {
                totalShowtimes += r.showtimes.length;
                const match = r.price.match(/\d+[.,]?\d*/);
                if (match) {
                    const price = parseInt(match[0].replace(/[.,]/g, ''), 10);
                    if (price > 0 && price < 500000) prices.push(price);
                }
            });
        });

        return {
            theatreCount: theatres.length,
            chainCounts,
            totalShowtimes,
            minPrice: prices.length ? Math.min(...prices) : 0,
            maxPrice: prices.length ? Math.max(...prices) : 0,
            avgPrice: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
            theatres,
        };
    }, [selectedCity, schedulesByCity]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    🎭 Theatre Coverage Explorer
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                    Browse theatres by city • {cityData.length} cities across Indonesia
                </p>
            </div>

            {/* 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
                {/* Column 1: City Selection */}
                <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">🏙️ Select City</h4>
                    <div className="h-[400px] overflow-y-auto space-y-2 pr-2">
                        {cityData.map(city => {
                            const isSelected = selectedCity === city.city;
                            const theaterCountText = `${city.theatres} ${city.theatres === 1 ? 'theatre' : 'theatres'}`;

                            return (
                                <button
                                    key={city.city}
                                    onClick={() => setSelectedCity(city.city)}
                                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                                        isSelected
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="font-medium">{city.city}</div>
                                            <div className={`text-xs mt-0.5 ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                                                {theaterCountText}
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div className="w-2 h-2 rounded-full bg-white"></div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Column 2: Theatre List */}
                <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                        📍 {selectedCity || 'Select a City'}
                        {cityStats && <span className="text-gray-400 font-normal ml-2">({cityStats.theatreCount} theatres)</span>}
                    </h4>
                    <div className="h-[400px] overflow-y-auto">
                        {selectedCity && cityStats ? (
                            <div className="space-y-3">
                                {cityStats.theatres.map((theatre, idx) => (
                                    <div
                                        key={theatre.theatre_id || idx}
                                        className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors"
                                    >
                                        {/* Theatre Header */}
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: CHAIN_COLORS[theatre.merchant] || '#6B7280' }}
                                                    />
                                                    <h5 className="font-semibold text-gray-900">{theatre.theatre_name}</h5>
                                                </div>
                                                <p className="text-sm text-gray-500 mt-1 ml-5">{theatre.merchant}</p>
                                            </div>
                                        </div>

                                        {/* Theatre Address */}
                                        <p className="text-xs text-gray-400 mt-2 ml-5">{theatre.address}</p>

                                        {/* Showtime Stats */}
                                        <div className="flex items-center gap-4 mt-3 ml-5 text-xs">
                                            <div className="flex items-center gap-1 text-blue-600">
                                                <span>🕒</span>
                                                <span className="font-medium">
                                                    {theatre.rooms.reduce((acc, r) => acc + r.showtimes.length, 0)} showtimes
                                                </span>
                                            </div>
                                            <div className="text-gray-400">
                                                {theatre.rooms.length} {theatre.rooms.length === 1 ? 'screen' : 'screens'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <span className="text-4xl block mb-3">🏙️</span>
                                    <p className="text-sm">Select a city from the list</p>
                                    <p className="text-xs mt-1">to see theatres and details</p>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Chain Legend */}
                    <div className="flex items-center justify-center gap-4 mt-3">
                        {Object.entries(CHAIN_COLORS).map(([chain, color]) => (
                            <div key={chain} className="flex items-center gap-1.5 text-xs">
                                <div className="w-3 h-3 rounded-full border border-white shadow" style={{ backgroundColor: color }} />
                                <span className="text-gray-600">{chain}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            {selectedCity && cityStats && (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Theatre Count */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                            <div className="text-3xl font-bold text-blue-600">{cityStats.theatreCount}</div>
                            <div className="text-sm text-gray-600">Theatres</div>
                        </div>

                        {/* Chain Breakdown */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="text-xs font-medium text-gray-500 mb-2">BY CHAIN</div>
                            <div className="space-y-1">
                                {Object.entries(cityStats.chainCounts).map(([chain, count]) => (
                                    <div key={chain} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: CHAIN_COLORS[chain] || '#6B7280' }}
                                            />
                                            <span className="text-sm text-gray-700">{chain}</span>
                                        </div>
                                        <span className="text-sm font-medium text-gray-900">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Showtime Count */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                            <div className="text-3xl font-bold text-purple-600">{cityStats.totalShowtimes.toLocaleString()}</div>
                            <div className="text-sm text-gray-600">Showtimes</div>
                        </div>

                        {/* Price Range */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                            {cityStats.minPrice > 0 ? (
                                <>
                                    <div className="text-lg font-bold text-emerald-600">
                                        Rp{(cityStats.minPrice / 1000).toFixed(0)}k - {(cityStats.maxPrice / 1000).toFixed(0)}k
                                    </div>
                                    <div className="text-sm text-gray-600">Price Range</div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        Avg: Rp{(cityStats.avgPrice / 1000).toFixed(0)}k
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-lg font-bold text-gray-400">-</div>
                                    <div className="text-sm text-gray-500">No price data</div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
