// City to Region mapping (Indonesian Islands)
export const REGION_CITIES: Record<string, string[]> = {
    'Jawa': ['JAKARTA', 'BANDUNG', 'SURABAYA', 'SEMARANG', 'YOGYAKARTA', 'MALANG', 'BEKASI', 'TANGERANG', 'DEPOK', 'BOGOR', 'CIREBON', 'SOLO', 'SERANG', 'CILEGON', 'TASIKMALAYA', 'SUKABUMI', 'KARAWANG', 'PURWAKARTA', 'GARUT', 'INDRAMAYU', 'SUMEDANG', 'GRESIK', 'SIDOARJO', 'MOJOKERTO', 'KEDIRI', 'MADIUN', 'PONOROGO', 'PROBOLINGGO', 'TEGAL', 'PEKALONGAN', 'KUDUS', 'PURWOKERTO', 'KLATEN', 'JEMBER'],
    'Sumatera': ['MEDAN', 'PALEMBANG', 'PEKANBARU', 'PADANG', 'JAMBI', 'LAMPUNG', 'BATAM', 'DUMAI', 'DURI', 'LUBUKLINGGAU', 'PRABUMULIH', 'PANGKAL PINANG', 'PEMATANG SIANTAR', 'RANTAU PRAPAT', 'ROKAN HILIR', 'KISARAN', 'TANJUNG PINANG'],
    'Kalimantan': ['BALIKPAPAN', 'BANJARMASIN', 'PONTIANAK', 'SAMARINDA', 'TARAKAN', 'PALANGKARAYA', 'SINGKAWANG', 'SAMPIT', 'BANJARBARU', 'KETAPANG', 'KUALA KAPUAS'],
    'Sulawesi': ['MAKASSAR', 'MANADO', 'PALU', 'KENDARI', 'GORONTALO', 'BAUBAU', 'MAMUJU'],
    'Bali & NT': ['DENPASAR', 'BALI', 'MATARAM', 'KUPANG'],
    'Papua & Maluku': ['JAYAPURA', 'SORONG', 'MANOKWARI', 'AMBON', 'TERNATE', 'TIMIKA'],
};

export function getRegion(city: string): string {
    const upperCity = city.toUpperCase().trim();
    for (const [region, cities] of Object.entries(REGION_CITIES)) {
        // Exact match first
        if (cities.includes(upperCity)) {
            return region;
        }
        // Then check if the city starts with or contains any reference city as a whole word
        if (cities.some(c => upperCity === c || upperCity.startsWith(c + ' ') || upperCity.endsWith(' ' + c) || upperCity.includes(' ' + c + ' '))) {
            return region;
        }
    }
    return 'Others';
}

// Merchant color utilities
export const MERCHANT_COLORS = {
    XXI: { bg: '#f59e0b', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500 text-white', badgeLight: 'bg-amber-500/20' },
    CGV: { bg: '#dc2626', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-600 text-white', badgeLight: 'bg-red-500/20' },
    Cinepolis: { bg: '#2563eb', text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-600 text-white', badgeLight: 'bg-blue-500/20' },
} as const;

export function getMerchantColor(merchant: string) {
    return MERCHANT_COLORS[merchant as keyof typeof MERCHANT_COLORS] ?? MERCHANT_COLORS.Cinepolis;
}
