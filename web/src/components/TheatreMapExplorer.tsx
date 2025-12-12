'use client';

import { useState, useMemo, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';

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
    'PEMATANG SIANTAR': { lat: 2.9595, lng: 99.0687 },
    'PEKANBARU': { lat: 0.5071, lng: 101.4478 },
    'BATAM': { lat: 1.0456, lng: 104.0305 },
    'PADANG': { lat: -0.9471, lng: 100.4172 },
    'JAMBI': { lat: -1.6101, lng: 103.6131 },
    'PALEMBANG': { lat: -2.9761, lng: 104.7754 },
    'PANGKAL PINANG': { lat: -2.1316, lng: 106.1169 },
    'BENGKULU': { lat: -3.7928, lng: 102.2608 },
    'LAMPUNG': { lat: -5.4500, lng: 105.2667 },
    'BANDAR LAMPUNG': { lat: -5.4294, lng: 105.2610 },
    'JAKARTA': { lat: -6.2088, lng: 106.8456 },
    'TANGERANG': { lat: -6.1783, lng: 106.6319 },
    'TANGERANG SELATAN': { lat: -6.2894, lng: 106.7108 },
    'DEPOK': { lat: -6.4025, lng: 106.7942 },
    'BEKASI': { lat: -6.2383, lng: 106.9756 },
    'BOGOR': { lat: -6.5971, lng: 106.8060 },
    'CIKARANG': { lat: -6.3012, lng: 107.1519 },
    'KARAWANG': { lat: -6.3227, lng: 107.3376 },
    'SERANG': { lat: -6.1103, lng: 106.1640 },
    'BANDUNG': { lat: -6.9175, lng: 107.6191 },
    'CIREBON': { lat: -6.7063, lng: 108.5570 },
    'SUKABUMI': { lat: -6.9277, lng: 106.9300 },
    'TASIKMALAYA': { lat: -7.3506, lng: 108.2172 },
    'SEMARANG': { lat: -6.9666, lng: 110.4196 },
    'SOLO': { lat: -7.5755, lng: 110.8243 },
    'YOGYAKARTA': { lat: -7.7956, lng: 110.3695 },
    'PURWOKERTO': { lat: -7.4214, lng: 109.2342 },
    'TEGAL': { lat: -6.8694, lng: 109.1402 },
    'PEKALONGAN': { lat: -6.8885, lng: 109.6753 },
    'MAGELANG': { lat: -7.4797, lng: 110.2177 },
    'SURABAYA': { lat: -7.2575, lng: 112.7521 },
    'MALANG': { lat: -7.9786, lng: 112.6309 },
    'KEDIRI': { lat: -7.8480, lng: 112.0177 },
    'JEMBER': { lat: -8.1845, lng: 113.6681 },
    'SIDOARJO': { lat: -7.4478, lng: 112.7183 },
    'GRESIK': { lat: -7.1558, lng: 112.6503 },
    'MOJOKERTO': { lat: -7.4716, lng: 112.4340 },
    'MADIUN': { lat: -7.6298, lng: 111.5239 },
    'DENPASAR': { lat: -8.6705, lng: 115.2126 },
    'MATARAM': { lat: -8.5833, lng: 116.1167 },
    'PONTIANAK': { lat: -0.0263, lng: 109.3425 },
    'SINGKAWANG': { lat: 0.9048, lng: 108.9875 },
    'BANJARMASIN': { lat: -3.3186, lng: 114.5944 },
    'BALIKPAPAN': { lat: -1.2379, lng: 116.8529 },
    'SAMARINDA': { lat: -0.4948, lng: 117.1436 },
    'PALANGKARAYA': { lat: -2.2136, lng: 113.9108 },
    'MAKASSAR': { lat: -5.1477, lng: 119.4327 },
    'MANADO': { lat: 1.4748, lng: 124.8421 },
    'PALU': { lat: -0.8917, lng: 119.8707 },
    'KENDARI': { lat: -3.9985, lng: 122.5129 },
    'GORONTALO': { lat: 0.5435, lng: 123.0568 },
    'AMBON': { lat: -3.6954, lng: 128.1814 },
    'JAYAPURA': { lat: -2.5337, lng: 140.7181 },
    'SORONG': { lat: -0.8761, lng: 131.2558 },
};

// Dynamic imports for Leaflet
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false });
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
            <div className="h-[500px] bg-gray-100 rounded-xl flex items-center justify-center">
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
                    Click a city to explore • {cityData.length} cities across Indonesia
                </p>
            </div>

            {/* 2-Column Map Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
                {/* Column 1: Indonesia Overview */}
                <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">🌏 Indonesia Overview</h4>
                    <div className="h-[400px] rounded-lg overflow-hidden border border-gray-200">
                        <MapContainer
                            center={[-2.5, 118]}
                            zoom={5}
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
                                const size = 6 + (city.theatres / maxTheatres) * 18;

                                return (
                                    <CircleMarker
                                        key={city.city}
                                        center={[coords.lat, coords.lng]}
                                        radius={size}
                                        fillColor={isSelected ? '#8B5CF6' : '#3B82F6'}
                                        fillOpacity={isSelected ? 0.9 : 0.6}
                                        stroke={true}
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
                </div>

                {/* Column 2: City Zoom View */}
                <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                        🔍 {selectedCity || 'Select a City'}
                        {cityStats && <span className="text-gray-400 font-normal ml-2">({cityStats.theatreCount} theatres)</span>}
                    </h4>
                    <div className="h-[400px] rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
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
                                {/* Theatre markers - use real coordinates */}
                                {cityStats?.theatres.map((theatre, idx) => {
                                    // Use real geocoded coordinates if available
                                    const lat = theatre.lat ?? (selectedCoords.lat + Math.sin(idx) * 0.01);
                                    const lng = theatre.lng ?? (selectedCoords.lng + Math.cos(idx) * 0.01);

                                    return (
                                        <CircleMarker
                                            key={theatre.theatre_id || idx}
                                            center={[lat, lng]}
                                            radius={10}
                                            fillColor={CHAIN_COLORS[theatre.merchant] || '#6B7280'}
                                            fillOpacity={0.85}
                                            stroke={true}
                                            color="white"
                                            weight={2}
                                        >
                                            <Popup>
                                                <div className="font-sans text-sm min-w-[180px]">
                                                    <div className="font-bold text-gray-900">{theatre.theatre_name}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{theatre.merchant}</div>
                                                    <div className="text-xs text-gray-400 mt-1 border-t pt-1">{theatre.address}</div>
                                                    <div className="text-xs text-blue-600 mt-1">
                                                        {theatre.rooms.reduce((acc, r) => acc + r.showtimes.length, 0)} showtimes today
                                                    </div>
                                                </div>
                                            </Popup>
                                        </CircleMarker>
                                    );
                                })}
                            </MapContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <span className="text-4xl block mb-3">📍</span>
                                    <p className="text-sm">Click a city on the left map</p>
                                    <p className="text-xs mt-1">to see theatre locations</p>
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

            {/* Stats Row - Below Maps */}
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
