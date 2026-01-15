/**
 * City to Region mapping for all 83 Indonesian cities supported by TIX.id
 * FROZEN REQUIREMENT: All cities MUST be mapped. No "Others" category allowed.
 */
export const REGION_CITIES: Record<string, string[]> = {
    'Jawa': [
        'JAKARTA', 'BANDUNG', 'SURABAYA', 'SEMARANG', 'YOGYAKARTA', 'MALANG', 'BEKASI',
        'TANGERANG', 'DEPOK', 'BOGOR', 'CIREBON', 'SOLO', 'SERANG', 'CILEGON',
        'TASIKMALAYA', 'KARAWANG', 'PURWAKARTA', 'GARUT', 'INDRAMAYU', 'SUMEDANG',
        'GRESIK', 'SIDOARJO', 'MOJOKERTO', 'KEDIRI', 'MADIUN', 'PONOROGO', 'PROBOLINGGO',
        'TEGAL', 'PEKALONGAN', 'PURWOKERTO', 'KLATEN', 'JEMBER', 'BLITAR', 'BONDOWOSO',
        'CIANJUR', 'CIKARANG'
    ],
    'Sumatera': [
        'MEDAN', 'PALEMBANG', 'PEKANBARU', 'PADANG', 'JAMBI', 'LAMPUNG', 'BATAM',
        'DUMAI', 'DURI', 'LUBUKLINGGAU', 'PRABUMULIH', 'PANGKAL PINANG',
        'PEMATANG SIANTAR', 'RANTAU PRAPAT', 'ROKAN HILIR', 'KISARAN', 'TANJUNG PINANG',
        'BENGKULU', 'BINJAI'
    ],
    'Kalimantan': [
        'BALIKPAPAN', 'BANJARMASIN', 'PONTIANAK', 'SAMARINDA', 'TARAKAN',
        'PALANGKARAYA', 'SINGKAWANG', 'SAMPIT', 'BANJARBARU', 'KETAPANG',
        'KUALA KAPUAS', 'BONTANG'
    ],
    'Sulawesi': [
        'MAKASSAR', 'MANADO', 'PALU', 'KENDARI', 'GORONTALO', 'BAUBAU', 'MAMUJU'
    ],
    'Bali & NT': [
        'BALI', 'MATARAM', 'KUPANG'
    ],
    'Papua & Maluku': [
        'JAYAPURA', 'SORONG', 'MANOKWARI', 'AMBON', 'TERNATE', 'TIMIKA'
    ],
};

// Build reverse lookup for O(1) access
const CITY_TO_REGION: Record<string, string> = {};
for (const [region, cities] of Object.entries(REGION_CITIES)) {
    for (const city of cities) {
        CITY_TO_REGION[city] = region;
    }
}

export function getRegion(city: string): string {
    return CITY_TO_REGION[city.toUpperCase().trim()] ?? 'Jawa'; // Default to Jawa if unknown
}

// Merchant colors - FROZEN REQUIREMENT
export const MERCHANT_COLORS = {
    XXI: { bg: '#f59e0b', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500 text-white', badgeLight: 'bg-amber-500/20' },
    CGV: { bg: '#dc2626', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-600 text-white', badgeLight: 'bg-red-500/20' },
    'Cinépolis': { bg: '#2563eb', text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-600 text-white', badgeLight: 'bg-blue-500/20' },
} as const;

export function getMerchantColor(merchant: string) {
    return MERCHANT_COLORS[merchant as keyof typeof MERCHANT_COLORS] ?? MERCHANT_COLORS['Cinépolis'];
}

// Region center coordinates for map panning
export const REGION_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
    'Jawa': { lat: -7.0, lng: 110.4, zoom: 7 },
    'Sumatera': { lat: -0.5, lng: 101.5, zoom: 6 },
    'Kalimantan': { lat: 0.5, lng: 116.5, zoom: 6 },
    'Sulawesi': { lat: -2.0, lng: 121.0, zoom: 6.5 },
    'Bali & NT': { lat: -8.5, lng: 118.0, zoom: 7 },
    'Papua & Maluku': { lat: -3.5, lng: 135.0, zoom: 6 },
    'all': { lat: -2.5, lng: 118, zoom: 5.5 },
};

