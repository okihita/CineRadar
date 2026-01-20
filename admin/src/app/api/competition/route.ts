import { NextResponse } from 'next/server';

function getMockData() {
    return {
        nationalShare: [
            { chain: 'XXI', share_pct: 58.2, theatres: 280 },
            { chain: 'CGV', share_pct: 28.5, theatres: 120 },
            { chain: 'Cinépolis', share_pct: 13.3, theatres: 50 },
        ],
        cityShare: [
            { city: 'Jakarta', chain: 'XXI', share_pct: 52.0, theatre_count: 45 },
            { city: 'Jakarta', chain: 'CGV', share_pct: 32.0, theatre_count: 28 },
            { city: 'Jakarta', chain: 'Cinépolis', share_pct: 16.0, theatre_count: 14 },
            { city: 'Surabaya', chain: 'XXI', share_pct: 65.0, theatre_count: 18 },
            { city: 'Surabaya', chain: 'CGV', share_pct: 25.0, theatre_count: 7 },
        ],
        shareTrend: [
            { chain: 'XXI', month: '2024-07', share_pct: 60.1 },
            { chain: 'XXI', month: '2024-12', share_pct: 58.2 },
            { chain: 'CGV', month: '2024-07', share_pct: 26.8 },
            { chain: 'CGV', month: '2024-12', share_pct: 28.5 },
        ],
        priceComparison: [
            { chain: 'XXI', room_type: '2D', avg_price: 55000, min_price: 35000, max_price: 75000 },
            { chain: 'CGV', room_type: '2D', avg_price: 65000, min_price: 45000, max_price: 85000 },
            { chain: 'XXI', room_type: 'IMAX', avg_price: 120000, min_price: 100000, max_price: 150000 },
        ],
        priceTrend: [
            { chain: 'XXI', month: '2024-07', avg_price: 52000 },
            { chain: 'XXI', month: '2024-12', avg_price: 55000 },
            { chain: 'CGV', month: '2024-07', avg_price: 62000 },
            { chain: 'CGV', month: '2024-12', avg_price: 65000 },
        ],
        expansionEvents: [
            { chain: 'CGV', city: 'Makassar', event_type: 'Opening', event_date: '2024-11-15', theatre_name: 'CGV Trans Studio' },
            { chain: 'XXI', city: 'Medan', event_type: 'Renovation', event_date: '2024-10-01', theatre_name: 'XXI Sun Plaza' },
        ],
        chainDensity: [
            { city: 'Jakarta', population: 10500000, chain: 'XXI', theatres: 45, per_100k: 0.43 },
            { city: 'Jakarta', population: 10500000, chain: 'CGV', theatres: 28, per_100k: 0.27 },
        ],
        battlegrounds: [
            { city: 'Jakarta', gap: 20.0, breakdown: 'XXI:52.0, CGV:32.0, Cinépolis:16.0' },
            { city: 'Bandung', gap: 25.0, breakdown: 'XXI:55.0, CGV:30.0, Cinépolis:15.0' },
        ],
    };
}

export async function GET() {
    return NextResponse.json(getMockData());
}
