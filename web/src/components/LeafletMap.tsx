'use client';

import { useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';

interface LeafletMapProps {
    cityData: { city: string; theatres: number }[];
    onCityClick?: (city: string) => void;
}

// Client-side detection without useState/useEffect
const emptySubscribe = () => () => { };
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsClient() {
    return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

// City coordinates with real lat/lng
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
    // Sumatra
    'BANDA ACEH': { lat: 5.5483, lng: 95.3238 },
    'MEDAN': { lat: 3.5952, lng: 98.6722 },
    'PEMATANG SIANTAR': { lat: 2.9595, lng: 99.0687 },
    'RANTAU PRAPAT': { lat: 2.0979, lng: 99.8341 },
    'PEKANBARU': { lat: 0.5071, lng: 101.4478 },
    'BATAM': { lat: 1.0456, lng: 104.0305 },
    'PADANG': { lat: -0.9471, lng: 100.4172 },
    'JAMBI': { lat: -1.6101, lng: 103.6131 },
    'PALEMBANG': { lat: -2.9761, lng: 104.7754 },
    'PANGKAL PINANG': { lat: -2.1316, lng: 106.1169 },
    'BENGKULU': { lat: -3.7928, lng: 102.2608 },
    'LAMPUNG': { lat: -5.4500, lng: 105.2667 },
    'BANDAR LAMPUNG': { lat: -5.4294, lng: 105.2610 },
    'LUBUKLINGGAU': { lat: -3.2942, lng: 102.8615 },
    'PRABUMULIH': { lat: -3.4364, lng: 104.2296 },

    // Java - Greater Jakarta
    'JAKARTA': { lat: -6.2088, lng: 106.8456 },
    'TANGERANG': { lat: -6.1783, lng: 106.6319 },
    'TANGERANG SELATAN': { lat: -6.2894, lng: 106.7108 },
    'DEPOK': { lat: -6.4025, lng: 106.7942 },
    'BEKASI': { lat: -6.2383, lng: 106.9756 },
    'BOGOR': { lat: -6.5971, lng: 106.8060 },
    'CIKARANG': { lat: -6.3012, lng: 107.1519 },
    'KARAWANG': { lat: -6.3227, lng: 107.3376 },
    'SERANG': { lat: -6.1103, lng: 106.1640 },

    // Java - West Java
    'BANDUNG': { lat: -6.9175, lng: 107.6191 },
    'CIREBON': { lat: -6.7063, lng: 108.5570 },
    'SUKABUMI': { lat: -6.9277, lng: 106.9300 },
    'TASIKMALAYA': { lat: -7.3506, lng: 108.2172 },
    'GARUT': { lat: -7.2167, lng: 107.9000 },
    'SUMEDANG': { lat: -6.8539, lng: 107.9186 },
    'PURWAKARTA': { lat: -6.5569, lng: 107.4372 },
    'SUBANG': { lat: -6.5714, lng: 107.7583 },

    // Java - Central Java
    'SEMARANG': { lat: -6.9666, lng: 110.4196 },
    'SOLO': { lat: -7.5755, lng: 110.8243 },
    'YOGYAKARTA': { lat: -7.7956, lng: 110.3695 },
    'PURWOKERTO': { lat: -7.4214, lng: 109.2342 },
    'TEGAL': { lat: -6.8694, lng: 109.1402 },
    'PEKALONGAN': { lat: -6.8885, lng: 109.6753 },
    'MAGELANG': { lat: -7.4797, lng: 110.2177 },
    'KUDUS': { lat: -6.8048, lng: 110.8405 },
    'SALATIGA': { lat: -7.3305, lng: 110.5084 },

    // Java - East Java
    'SURABAYA': { lat: -7.2575, lng: 112.7521 },
    'MALANG': { lat: -7.9786, lng: 112.6309 },
    'KEDIRI': { lat: -7.8480, lng: 112.0177 },
    'JEMBER': { lat: -8.1845, lng: 113.6681 },
    'SIDOARJO': { lat: -7.4478, lng: 112.7183 },
    'GRESIK': { lat: -7.1558, lng: 112.6503 },
    'MOJOKERTO': { lat: -7.4716, lng: 112.4340 },
    'MADIUN': { lat: -7.6298, lng: 111.5239 },
    'PROBOLINGGO': { lat: -7.7543, lng: 113.2159 },
    'PONOROGO': { lat: -7.8678, lng: 111.4603 },
    'BLITAR': { lat: -8.0954, lng: 112.1609 },
    'PASURUAN': { lat: -7.6469, lng: 112.9075 },
    'BANYUWANGI': { lat: -8.2191, lng: 114.3691 },

    // Bali & Nusa Tenggara
    'DENPASAR': { lat: -8.6705, lng: 115.2126 },
    'MATARAM': { lat: -8.5833, lng: 116.1167 },
    'KUPANG': { lat: -10.1772, lng: 123.6070 },

    // Kalimantan
    'PONTIANAK': { lat: -0.0263, lng: 109.3425 },
    'SINGKAWANG': { lat: 0.9048, lng: 108.9875 },
    'BANJARMASIN': { lat: -3.3186, lng: 114.5944 },
    'BALIKPAPAN': { lat: -1.2379, lng: 116.8529 },
    'SAMARINDA': { lat: -0.4948, lng: 117.1436 },
    'PALANGKARAYA': { lat: -2.2136, lng: 113.9108 },
    'TARAKAN': { lat: 3.3000, lng: 117.6333 },
    'SAMPIT': { lat: -2.5322, lng: 112.9508 },
    'BONTANG': { lat: 0.1333, lng: 117.5000 },

    // Sulawesi
    'MAKASSAR': { lat: -5.1477, lng: 119.4327 },
    'MANADO': { lat: 1.4748, lng: 124.8421 },
    'PALU': { lat: -0.8917, lng: 119.8707 },
    'KENDARI': { lat: -3.9985, lng: 122.5129 },
    'GORONTALO': { lat: 0.5435, lng: 123.0568 },
    'MAMUJU': { lat: -2.6748, lng: 118.8885 },
    'PARE-PARE': { lat: -4.0135, lng: 119.6255 },

    // Maluku & Papua
    'AMBON': { lat: -3.6954, lng: 128.1814 },
    'TERNATE': { lat: 0.7833, lng: 127.3833 },
    'JAYAPURA': { lat: -2.5337, lng: 140.7181 },
    'SORONG': { lat: -0.8761, lng: 131.2558 },
    'MANOKWARI': { lat: -0.8615, lng: 134.0620 },
    'TIMIKA': { lat: -4.5282, lng: 136.8879 },
    'MERAUKE': { lat: -8.4932, lng: 140.4018 },
};

// Leaflet component needs to be dynamically imported because it uses window
const MapContainer = dynamic(
    () => import('react-leaflet').then((mod) => mod.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(
    () => import('react-leaflet').then((mod) => mod.TileLayer),
    { ssr: false }
);
const CircleMarker = dynamic(
    () => import('react-leaflet').then((mod) => mod.CircleMarker),
    { ssr: false }
);
const Popup = dynamic(
    () => import('react-leaflet').then((mod) => mod.Popup),
    { ssr: false }
);
const Tooltip = dynamic(
    () => import('react-leaflet').then((mod) => mod.Tooltip),
    { ssr: false }
);

export default function LeafletMap({ cityData, onCityClick }: LeafletMapProps) {
    const isClient = useIsClient();

    const maxTheatres = Math.max(...cityData.map((c) => c.theatres), 1);

    // Get color based on theatre count
    const getColor = (theatres: number): string => {
        const ratio = theatres / maxTheatres;
        if (ratio > 0.6) return '#ec4899'; // pink-500
        if (ratio > 0.3) return '#a855f7'; // purple-500
        return '#6366f1'; // indigo-500
    };

    // Get radius based on theatre count
    const getRadius = (theatres: number): number => {
        const ratio = theatres / maxTheatres;
        return 6 + ratio * 18;
    };

    if (!isClient) {
        return (
            <div className="w-full h-80 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-xl flex items-center justify-center border border-white/10">
                <div className="text-gray-400 flex items-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
                    Loading map...
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Title */}
            <div className="mb-3">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    🗺️ Theatre Coverage Map
                </h3>
                <p className="text-sm text-gray-400">{cityData.length} cities across Indonesia</p>
            </div>

            {/* Map Container */}
            <div className="w-full h-80 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <MapContainer
                    center={[-2.5, 118]}
                    zoom={5}
                    style={{ height: '100%', width: '100%', background: '#0f172a' }}
                    scrollWheelZoom={true}
                    zoomControl={true}
                >
                    {/* Dark theme tiles */}
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />

                    {/* City markers */}
                    {cityData.map((city) => {
                        const coords = CITY_COORDINATES[city.city];
                        if (!coords) return null;

                        return (
                            <CircleMarker
                                key={city.city}
                                center={[coords.lat, coords.lng]}
                                radius={getRadius(city.theatres)}
                                fillColor={getColor(city.theatres)}
                                fillOpacity={0.7}
                                stroke={true}
                                color="white"
                                weight={1}
                                opacity={0.8}
                                eventHandlers={{
                                    click: () => onCityClick?.(city.city),
                                }}
                            >
                                <Tooltip
                                    permanent={city.theatres > maxTheatres * 0.5}
                                    direction="top"
                                    offset={[0, -10]}
                                    className="custom-tooltip"
                                >
                                    <span className="font-semibold">{city.city}</span>
                                </Tooltip>
                                <Popup>
                                    <div className="text-center">
                                        <div className="font-bold text-lg">{city.city}</div>
                                        <div className="text-purple-600 font-semibold">
                                            🎭 {city.theatres} theatres
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        );
                    })}
                </MapContainer>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white z-[1000]">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-indigo-500" />
                        <span>1-10</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-purple-500" />
                        <span>11-30</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-pink-500" />
                        <span>30+</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
