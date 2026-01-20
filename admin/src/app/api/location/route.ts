import { NextResponse } from 'next/server';

function getMockData() {
    return {
        theatreDensity: [
            { city: 'Jakarta', region: 'Java', population: 10500000, theatres: 87, per_100k: 0.83, total_seats: 52000, seats_per_1k: 4.95 },
            { city: 'Surabaya', region: 'Java', population: 2900000, theatres: 28, per_100k: 0.97, total_seats: 16800, seats_per_1k: 5.79 },
            { city: 'Bandung', region: 'Java', population: 2500000, theatres: 22, per_100k: 0.88, total_seats: 13200, seats_per_1k: 5.28 },
            { city: 'Medan', region: 'Sumatra', population: 2200000, theatres: 15, per_100k: 0.68, total_seats: 9000, seats_per_1k: 4.09 },
            { city: 'Makassar', region: 'Sulawesi', population: 1500000, theatres: 8, per_100k: 0.53, total_seats: 4800, seats_per_1k: 3.20 },
        ],
        competitorProximity: [
            { city: 'Jakarta', xxi: 45, cgv: 28, cinepolis: 14, total: 87 },
            { city: 'Surabaya', xxi: 18, cgv: 7, cinepolis: 3, total: 28 },
            { city: 'Bandung', xxi: 14, cgv: 5, cinepolis: 3, total: 22 },
        ],
        underserved: [
            { city: 'Kupang', region: 'Nusa Tenggara', population: 450000, theatres: 2, per_100k: 0.44, gap: 2.5 },
            { city: 'Jayapura', region: 'Papua', population: 320000, theatres: 2, per_100k: 0.63, gap: 1.2 },
        ],
        theatreAge: [
            { age_group: 'New (<1 year)', count: 25, avg_seats: 650 },
            { age_group: 'Recent (1-3 years)', count: 85, avg_seats: 580 },
            { age_group: 'Established (3-7 years)', count: 180, avg_seats: 520 },
            { age_group: 'Legacy (>7 years)', count: 160, avg_seats: 480 },
        ],
        recommendations: [
            { city: 'Kupang', region: 'Nusa Tenggara', population: 450000, current_theatres: 2, recommended_min: 4.5, additional_needed: 2.5 },
            { city: 'Jayapura', region: 'Papua', population: 320000, current_theatres: 2, recommended_min: 3.2, additional_needed: 1.2 },
        ],
    };
}

export async function GET() {
    return NextResponse.json(getMockData());
}
