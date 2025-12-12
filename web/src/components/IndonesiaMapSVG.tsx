'use client';

// Simplified Indonesia map with main islands
// Based on actual geography but simplified for web display

interface IndonesiaMapSVGProps {
    cityData: { city: string; theatres: number }[];
    onCityClick?: (city: string) => void;
}

// City coordinates mapped to approximate real positions (0-1000 x 0-400 viewBox)
const CITY_POSITIONS: Record<string, { x: number; y: number; region: string }> = {
    // Sumatra
    'MEDAN': { x: 115, y: 85, region: 'sumatra' },
    'PEKANBARU': { x: 140, y: 135, region: 'sumatra' },
    'PADANG': { x: 125, y: 165, region: 'sumatra' },
    'PALEMBANG': { x: 170, y: 210, region: 'sumatra' },
    'LAMPUNG': { x: 185, y: 255, region: 'sumatra' },
    'BATAM': { x: 165, y: 115, region: 'sumatra' },
    'PEMATANG SIANTAR': { x: 120, y: 95, region: 'sumatra' },
    'BENGKULU': { x: 155, y: 195, region: 'sumatra' },
    'JAMBI': { x: 160, y: 175, region: 'sumatra' },
    'BANDA ACEH': { x: 95, y: 55, region: 'sumatra' },
    'LUBUKLINGGAU': { x: 165, y: 200, region: 'sumatra' },
    'PRABUMULIH': { x: 170, y: 215, region: 'sumatra' },
    'PANGKAL PINANG': { x: 195, y: 185, region: 'sumatra' },
    'RANTAU PRAPAT': { x: 125, y: 100, region: 'sumatra' },
    'ROKAN HILIR': { x: 140, y: 120, region: 'sumatra' },

    // Java
    'JAKARTA': { x: 230, y: 275, region: 'java' },
    'BANDUNG': { x: 250, y: 280, region: 'java' },
    'SEMARANG': { x: 295, y: 280, region: 'java' },
    'SURABAYA': { x: 360, y: 280, region: 'java' },
    'YOGYAKARTA': { x: 290, y: 290, region: 'java' },
    'SOLO': { x: 300, y: 285, region: 'java' },
    'MALANG': { x: 355, y: 290, region: 'java' },
    'TANGERANG': { x: 225, y: 275, region: 'java' },
    'DEPOK': { x: 232, y: 278, region: 'java' },
    'BEKASI': { x: 238, y: 275, region: 'java' },
    'BOGOR': { x: 235, y: 282, region: 'java' },
    'CIREBON': { x: 268, y: 278, region: 'java' },
    'CIKARANG': { x: 242, y: 276, region: 'java' },
    'KARAWANG': { x: 245, y: 274, region: 'java' },
    'SUKABUMI': { x: 245, y: 285, region: 'java' },
    'TASIKMALAYA': { x: 262, y: 286, region: 'java' },
    'GARUT': { x: 255, y: 284, region: 'java' },
    'SUMEDANG': { x: 252, y: 282, region: 'java' },
    'PURWOKERTO': { x: 280, y: 285, region: 'java' },
    'TEGAL': { x: 278, y: 280, region: 'java' },
    'PEKALONGAN': { x: 285, y: 278, region: 'java' },
    'MAGELANG': { x: 292, y: 288, region: 'java' },
    'KEDIRI': { x: 345, y: 288, region: 'java' },
    'JEMBER': { x: 375, y: 290, region: 'java' },
    'SIDOARJO': { x: 362, y: 282, region: 'java' },
    'GRESIK': { x: 358, y: 278, region: 'java' },
    'MOJOKERTO': { x: 352, y: 284, region: 'java' },
    'MADIUN': { x: 330, y: 286, region: 'java' },
    'PROBOLINGGO': { x: 370, y: 286, region: 'java' },
    'SERANG': { x: 218, y: 272, region: 'java' },
    'PURWAKARTA': { x: 248, y: 278, region: 'java' },
    'PONOROGO': { x: 325, y: 290, region: 'java' },

    // Bali & Nusa Tenggara
    'DENPASAR': { x: 400, y: 300, region: 'bali' },
    'MATARAM': { x: 420, y: 305, region: 'nusatenggara' },
    'KUPANG': { x: 520, y: 330, region: 'nusatenggara' },

    // Kalimantan
    'PONTIANAK': { x: 280, y: 140, region: 'kalimantan' },
    'BANJARMASIN': { x: 350, y: 195, region: 'kalimantan' },
    'BALIKPAPAN': { x: 400, y: 160, region: 'kalimantan' },
    'SAMARINDA': { x: 405, y: 145, region: 'kalimantan' },
    'PALANGKARAYA': { x: 340, y: 175, region: 'kalimantan' },
    'SINGKAWANG': { x: 275, y: 125, region: 'kalimantan' },
    'SAMPIT': { x: 355, y: 180, region: 'kalimantan' },
    'TARAKAN': { x: 415, y: 95, region: 'kalimantan' },

    // Sulawesi
    'MAKASSAR': { x: 470, y: 255, region: 'sulawesi' },
    'MANADO': { x: 520, y: 115, region: 'sulawesi' },
    'PALU': { x: 475, y: 165, region: 'sulawesi' },
    'KENDARI': { x: 510, y: 225, region: 'sulawesi' },
    'GORONTALO': { x: 510, y: 130, region: 'sulawesi' },
    'MAMUJU': { x: 460, y: 195, region: 'sulawesi' },

    // Maluku & Papua
    'AMBON': { x: 600, y: 210, region: 'maluku' },
    'TERNATE': { x: 560, y: 135, region: 'maluku' },
    'JAYAPURA': { x: 780, y: 175, region: 'papua' },
    'SORONG': { x: 640, y: 155, region: 'papua' },
    'MANOKWARI': { x: 680, y: 145, region: 'papua' },
    'TIMIKA': { x: 720, y: 210, region: 'papua' },
};

// Simplified island paths (approximate outlines)
const ISLAND_PATHS = {
    sumatra: "M80,35 L130,25 L155,45 L165,75 L175,95 L190,120 L195,155 L200,190 L210,225 L200,260 L185,280 L165,275 L145,250 L130,220 L120,185 L105,150 L95,110 L85,70 Z",
    java: "M205,260 L220,255 L250,258 L280,260 L310,262 L340,265 L370,268 L395,275 L400,290 L390,305 L360,302 L320,300 L280,298 L240,295 L215,288 L205,275 Z",
    bali: "M398,295 L408,292 L418,298 L415,308 L402,310 Z",
    lombok: "M420,300 L432,298 L438,308 L428,312 Z",
    kalimantan: "M260,90 L300,85 L340,90 L380,95 L420,85 L440,105 L445,140 L440,175 L425,200 L400,210 L360,215 L320,210 L290,195 L270,170 L255,140 L260,110 Z",
    sulawesi: "M450,100 L470,95 L490,105 L530,90 L545,115 L530,135 L520,155 L485,145 L470,155 L455,180 L440,210 L450,240 L475,270 L495,285 L520,260 L540,230 L525,195 L545,175 L530,155 L540,130 L520,115 L490,125 L475,135 L460,120 Z",
    maluku: "M575,130 L595,125 L605,145 L595,165 L580,160 L575,145 Z M580,190 L620,185 L630,210 L610,230 L585,225 L575,205 Z",
    papua: "M625,120 L680,115 L740,130 L780,145 L800,175 L795,210 L770,235 L720,245 L670,235 L640,210 L625,175 L630,145 Z",
    nusatenggara: "M420,305 L445,302 L470,308 L500,315 L530,325 L545,340 L520,345 L490,342 L455,338 L430,330 L418,318 Z"
};

export default function IndonesiaMapSVG({ cityData, onCityClick }: IndonesiaMapSVGProps) {
    const maxTheatres = Math.max(...cityData.map(c => c.theatres), 1);

    // Group cities by region for better visualization
    const getCityData = (cityName: string) => {
        return cityData.find(c => c.city === cityName);
    };

    return (
        <div className="relative w-full aspect-[2.5/1] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-xl overflow-hidden border border-white/10">
            {/* Ocean texture */}
            <div className="absolute inset-0 opacity-30">
                <svg width="100%" height="100%" className="absolute inset-0">
                    <defs>
                        <pattern id="ocean-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                            <circle cx="20" cy="20" r="1" fill="rgba(99, 179, 237, 0.3)" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#ocean-pattern)" />
                </svg>
            </div>

            {/* Main SVG Map */}
            <svg
                viewBox="0 0 850 380"
                className="absolute inset-0 w-full h-full"
                style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))' }}
            >
                <defs>
                    {/* Gradient for islands */}
                    <linearGradient id="island-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#334155" />
                        <stop offset="100%" stopColor="#1e293b" />
                    </linearGradient>

                    {/* Glow filter for cities */}
                    <filter id="city-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Island shapes */}
                {Object.entries(ISLAND_PATHS).map(([island, path]) => (
                    <path
                        key={island}
                        d={path}
                        fill="url(#island-gradient)"
                        stroke="rgba(148, 163, 184, 0.3)"
                        strokeWidth="1"
                        className="transition-all hover:fill-slate-700/80"
                    />
                ))}

                {/* City markers */}
                {Object.entries(CITY_POSITIONS).map(([cityName, pos]) => {
                    const data = getCityData(cityName);
                    if (!data) return null;

                    const intensity = data.theatres / maxTheatres;
                    const size = 4 + intensity * 12;
                    const isLarge = data.theatres > 20;

                    return (
                        <g
                            key={cityName}
                            className="cursor-pointer transition-transform hover:scale-125"
                            onClick={() => onCityClick?.(cityName)}
                        >
                            {/* Outer glow for large cities */}
                            {isLarge && (
                                <circle
                                    cx={pos.x}
                                    cy={pos.y}
                                    r={size + 4}
                                    fill="none"
                                    stroke="rgba(168, 85, 247, 0.4)"
                                    strokeWidth="2"
                                    className="animate-ping"
                                    style={{ animationDuration: '2s' }}
                                />
                            )}

                            {/* Gradient circle */}
                            <circle
                                cx={pos.x}
                                cy={pos.y}
                                r={size}
                                fill={`url(#city-gradient-${intensity > 0.5 ? 'high' : intensity > 0.2 ? 'medium' : 'low'})`}
                                filter="url(#city-glow)"
                                className="drop-shadow-lg"
                            />

                            {/* Inner bright core */}
                            <circle
                                cx={pos.x}
                                cy={pos.y}
                                r={size * 0.4}
                                fill="white"
                                opacity={0.6 + intensity * 0.4}
                            />

                            {/* City label for large cities */}
                            {data.theatres > 30 && (
                                <text
                                    x={pos.x}
                                    y={pos.y - size - 5}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="white"
                                    className="font-semibold pointer-events-none"
                                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                                >
                                    {cityName}
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* City gradients */}
                <defs>
                    <radialGradient id="city-gradient-high">
                        <stop offset="0%" stopColor="#f472b6" />
                        <stop offset="100%" stopColor="#9333ea" />
                    </radialGradient>
                    <radialGradient id="city-gradient-medium">
                        <stop offset="0%" stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="#7c3aed" />
                    </radialGradient>
                    <radialGradient id="city-gradient-low">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#4f46e5" />
                    </radialGradient>
                </defs>
            </svg>

            {/* Legend */}
            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-300">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span>1-10</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-violet-500" />
                        <span>11-30</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-r from-pink-500 to-purple-600" />
                        <span>30+</span>
                    </div>
                </div>
            </div>

            {/* Title */}
            <div className="absolute top-3 left-3 text-white">
                <h4 className="text-sm font-semibold">🗺️ Theatre Coverage</h4>
                <p className="text-xs text-gray-400">{cityData.length} cities • Click to explore</p>
            </div>

            {/* Hover tooltip container */}
            <div id="map-tooltip" className="hidden absolute bg-black/90 text-white text-xs px-2 py-1 rounded pointer-events-none z-50" />
        </div>
    );
}
