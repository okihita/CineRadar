'use client';

import { useState, useMemo, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';

interface TheaterSchedule {
    theatre_id: string;
    theatre_name: string;
    merchant: string;
    address: string;
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

// Client-side detection
const emptySubscribe = () => () => { };
const getSnapshot = () => true;
const getServerSnapshot = () => false;
function useIsClient() {
    return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

// City coordinates
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
    'BANDA ACEH': { lat: 5.5483, lng: 95.3238 },
    'MEDAN': { lat: 3.5952, lng: 98.6722 },
    'PEKANBARU': { lat: 0.5071, lng: 101.4478 },
    'BATAM': { lat: 1.0456, lng: 104.0305 },
    'PADANG': { lat: -0.9471, lng: 100.4172 },
    'PALEMBANG': { lat: -2.9761, lng: 104.7754 },
    'LAMPUNG': { lat: -5.4500, lng: 105.2667 },
    'JAKARTA': { lat: -6.2088, lng: 106.8456 },
    'TANGERANG': { lat: -6.1783, lng: 106.6319 },
    'DEPOK': { lat: -6.4025, lng: 106.7942 },
    'BEKASI': { lat: -6.2383, lng: 106.9756 },
    'BOGOR': { lat: -6.5971, lng: 106.8060 },
    'BANDUNG': { lat: -6.9175, lng: 107.6191 },
    'CIREBON': { lat: -6.7063, lng: 108.5570 },
    'SEMARANG': { lat: -6.9666, lng: 110.4196 },
    'SOLO': { lat: -7.5755, lng: 110.8243 },
    'YOGYAKARTA': { lat: -7.7956, lng: 110.3695 },
    'SURABAYA': { lat: -7.2575, lng: 112.7521 },
    'MALANG': { lat: -7.9786, lng: 112.6309 },
    'DENPASAR': { lat: -8.6705, lng: 115.2126 },
    'PONTIANAK': { lat: -0.0263, lng: 109.3425 },
    'BANJARMASIN': { lat: -3.3186, lng: 114.5944 },
    'BALIKPAPAN': { lat: -1.2379, lng: 116.8529 },
    'SAMARINDA': { lat: -0.4948, lng: 117.1436 },
    'MAKASSAR': { lat: -5.1477, lng: 119.4327 },
    'MANADO': { lat: 1.4748, lng: 124.8421 },
    'AMBON': { lat: -3.6954, lng: 128.1814 },
    'JAYAPURA': { lat: -2.5337, lng: 140.7181 },
};

// Dynamic imports for Leaflet
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });

// Chain colors
const CHAIN_COLORS: Record<string, string> = {
    'XXI': '#3B82F6',
    'CGV': '#EF4444',
    'Cinépolis': '#EAB308',
};

export default function TheatreMapExplorer({ cityData, schedulesByCity }: TheatreMapExplorerProps) {
    const [selectedCity, setSelectedCity] = useState<string | null>(null);
    const isClient = useIsClient();

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

    const selectedCoords = selectedCity ? CITY_COORDINATES[selectedCity] : null;

    if (!isClient) {
        return (
            <div className="h-96 bg-gray-100 rounded-xl flex items-center justify-center">
                <div className="text-gray-500 flex items-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                    Loading map...
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    🗺️ Theatre Coverage Explorer
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                    Click a city on the map to explore theatres
                </p>
            </div>

            {/* 3-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
                {/* Column 1: Indonesia Overview */}
                <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">🌏 Indonesia Overview</h4>
                    <div className="h-64 rounded-lg overflow-hidden border border-gray-200">
                        <MapContainer
                            center={[-2.5, 118]}
                            zoom={4}
                            style={{ height: '100%', width: '100%' }}
                            scrollWheelZoom={true}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                            />
                            {cityData.map(city => {
                                const coords = CITY_COORDINATES[city.city];
                                if (!coords) return null;
                                const isSelected = selectedCity === city.city;
                                const size = 5 + (city.theatres / maxTheatres) * 15;

                                return (
                                    <CircleMarker
                                        key={city.city}
                                        center={[coords.lat, coords.lng]}
                                        radius={size}
                                        fillColor={isSelected ? '#8B5CF6' : '#3B82F6'}
                                        fillOpacity={isSelected ? 0.9 : 0.6}
                                        stroke={isSelected}
                                        color={isSelected ? '#7C3AED' : 'white'}
                                        weight={isSelected ? 3 : 1}
                                        eventHandlers={{
                                            click: () => setSelectedCity(city.city),
                                        }}
                                    >
                                        <Popup>
                                            <div className="text-center font-sans">
                                                <div className="font-bold">{city.city}</div>
                                                <div className="text-blue-600">{city.theatres} theatres</div>
                                            </div>
                                        </Popup>
                                    </CircleMarker>
                                );
                            })}
                        </MapContainer>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                        {cityData.length} cities with theatres
                    </p>
                </div>

                {/* Column 2: City Zoom View */}
                <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                        🔍 {selectedCity || 'Select a City'}
                    </h4>
                    <div className="h-64 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                        {selectedCity && selectedCoords ? (
                            <MapContainer
                                key={selectedCity}
                                center={[selectedCoords.lat, selectedCoords.lng]}
                                zoom={13}
                                style={{ height: '100%', width: '100%' }}
                                scrollWheelZoom={true}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                {/* Theatre markers - spread around city center */}
                                {cityStats?.theatres.map((theatre, idx) => {
                                    // Spread markers around city center
                                    const angle = (idx / cityStats.theatres.length) * 2 * Math.PI;
                                    const radius = 0.01 + (idx % 3) * 0.005;
                                    const lat = selectedCoords.lat + Math.sin(angle) * radius;
                                    const lng = selectedCoords.lng + Math.cos(angle) * radius;

                                    return (
                                        <CircleMarker
                                            key={theatre.theatre_id || idx}
                                            center={[lat, lng]}
                                            radius={8}
                                            fillColor={CHAIN_COLORS[theatre.merchant] || '#6B7280'}
                                            fillOpacity={0.8}
                                            stroke={true}
                                            color="white"
                                            weight={2}
                                        >
                                            <Popup>
                                                <div className="font-sans text-sm">
                                                    <div className="font-bold">{theatre.theatre_name}</div>
                                                    <div className="text-gray-500">{theatre.merchant}</div>
                                                    <div className="text-xs text-gray-400 mt-1">{theatre.address}</div>
                                                </div>
                                            </Popup>
                                        </CircleMarker>
                                    );
                                })}
                            </MapContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <span className="text-3xl block mb-2">📍</span>
                                    <p className="text-sm">Click a city on the left</p>
                                </div>
                            </div>
                        )}
                    </div>
                    {selectedCity && cityStats && (
                        <div className="flex items-center justify-center gap-3 mt-2">
                            {Object.entries(CHAIN_COLORS).map(([chain, color]) => (
                                <div key={chain} className="flex items-center gap-1 text-xs">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                                    <span className="text-gray-600">{chain}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Column 3: City Stats */}
                <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">📊 City Statistics</h4>
                    {selectedCity && cityStats ? (
                        <div className="space-y-3">
                            {/* Theatre Count */}
                            <div className="bg-blue-50 rounded-lg p-3">
                                <div className="text-3xl font-bold text-blue-600">{cityStats.theatreCount}</div>
                                <div className="text-sm text-blue-800">Theatres</div>
                            </div>

                            {/* Chain Breakdown */}
                            <div className="bg-gray-50 rounded-lg p-3">
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
                            <div className="bg-purple-50 rounded-lg p-3">
                                <div className="text-2xl font-bold text-purple-600">{cityStats.totalShowtimes.toLocaleString()}</div>
                                <div className="text-sm text-purple-800">Total Showtimes</div>
                            </div>

                            {/* Price Range */}
                            {cityStats.minPrice > 0 && (
                                <div className="bg-emerald-50 rounded-lg p-3">
                                    <div className="text-xs font-medium text-gray-500 mb-1">PRICE RANGE</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-emerald-700">
                                            Rp{(cityStats.minPrice / 1000).toFixed(0)}k
                                        </span>
                                        <span className="text-gray-400">→</span>
                                        <span className="text-sm text-emerald-700">
                                            Rp{(cityStats.maxPrice / 1000).toFixed(0)}k
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Avg: Rp{(cityStats.avgPrice / 1000).toFixed(0)}k
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <span className="text-3xl block mb-2">📈</span>
                                <p className="text-sm">Statistics will appear here</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
