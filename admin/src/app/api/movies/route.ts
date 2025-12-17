import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

interface Showtime {
    movie_id: string;
    movie_title: string;
    city: string;
    theatre_id: string;
    theatre_name: string;
    chain: string;
    room_type: string;
    price: string;
    showtime: string;
    showtime_id: string;
    is_available: boolean;
    date: string;
}

export async function GET() {
    try {
        // Get today's date
        const today = new Date().toISOString().split('T')[0];

        // Try to find movie data file
        const dataDir = path.join(process.cwd(), '..', 'data');
        let movieData = null;

        // Try today's file first, then look for any recent file
        const candidates = [
            path.join(dataDir, `movies_${today}.json`),
            path.join(dataDir, 'movies_2025-12-17.json'), // Fallback
        ];

        for (const filePath of candidates) {
            try {
                const fileContent = await fs.readFile(filePath, 'utf-8');
                movieData = JSON.parse(fileContent);
                break;
            } catch {
                continue;
            }
        }

        if (!movieData) {
            return NextResponse.json({
                showtimes: [],
                error: 'No movie data found',
                date: today
            });
        }

        // Flatten the nested structure into showtime rows
        const showtimes: Showtime[] = [];

        for (const movie of movieData.movies || []) {
            const schedules = movie.schedules || {};

            for (const [city, theatres] of Object.entries(schedules)) {
                for (const theatre of theatres as any[]) {
                    for (const room of theatre.rooms || []) {
                        for (const st of room.all_showtimes || []) {
                            showtimes.push({
                                movie_id: movie.id,
                                movie_title: movie.title,
                                city: city,
                                theatre_id: theatre.theatre_id,
                                theatre_name: theatre.theatre_name,
                                chain: theatre.merchant,
                                room_type: room.category,
                                price: room.price,
                                showtime: st.time,
                                showtime_id: st.showtime_id,
                                is_available: st.is_available,
                                date: movieData.date,
                            });
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            showtimes,
            date: movieData.date,
            scraped_at: movieData.scraped_at,
            total: showtimes.length,
        });
    } catch (error) {
        console.error('Error loading movie data:', error);
        return NextResponse.json({
            showtimes: [],
            error: 'Failed to load movie data'
        }, { status: 500 });
    }
}
