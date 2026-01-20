import { NextResponse } from 'next/server';

function getMockData() {
    return {
        stats: { cities: 83, theatres: 450, movies: 35, showtimes: 12500, overall_occupancy: 62.5 },
        lowPerformingCities: [
            { name: 'Kupang', region: 'Nusa Tenggara', avg_occupancy: 38.2, theatres: 2 },
            { name: 'Ternate', region: 'Maluku', avg_occupancy: 41.5, theatres: 1 },
            { name: 'Jayapura', region: 'Papua', avg_occupancy: 43.8, theatres: 2 },
        ],
        bottomTheatres: [
            { name: 'XXI Kupang', chain: 'XXI', city: 'Kupang', avg_occupancy: 32.5 },
            { name: 'CGV Ternate', chain: 'CGV', city: 'Ternate', avg_occupancy: 35.2 },
        ],
        timeSlots: [
            { time_slot: 'Morning', avg_occupancy: 42.5, count: 2500 },
            { time_slot: 'Afternoon', avg_occupancy: 55.8, count: 3200 },
            { time_slot: 'Evening', avg_occupancy: 68.2, count: 3800 },
            { time_slot: 'Prime', avg_occupancy: 78.5, count: 2500 },
            { time_slot: 'Late', avg_occupancy: 52.3, count: 500 },
        ],
        chainPerformance: [
            { chain: 'XXI', theatres: 280, avg_occupancy: 65.2, avg_price: 55000 },
            { chain: 'CGV', theatres: 120, avg_occupancy: 62.8, avg_price: 65000 },
            { chain: 'Cinépolis', theatres: 50, avg_occupancy: 58.5, avg_price: 60000 },
        ],
        underperformingMovies: [
            { title: 'FILM INDIE A', genre: 'Drama', avg_occupancy: 28.5 },
            { title: 'DOKUMENTER B', genre: 'Documentary', avg_occupancy: 32.1 },
        ],
        marketingTriggers: [
            { theatre: 'XXI Kupang', city: 'Kupang', movie: 'SIKSA NERAKA', show_time: '10:30', room_type: '2D', occupancy: 22.5, empty_seats: 180 },
            { theatre: 'CGV Ternate', city: 'Ternate', movie: 'AGAK LAEN 2', show_time: '11:00', room_type: '2D', occupancy: 25.8, empty_seats: 150 },
        ],
    };
}

export async function GET() {
    return NextResponse.json(getMockData());
}
