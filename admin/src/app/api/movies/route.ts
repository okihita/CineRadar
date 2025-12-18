import { NextResponse } from 'next/server';

const isServerless = process.env.VERCEL === '1';

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

function getMockData() {
    const today = new Date().toISOString().split('T')[0];
    const movies = [
        { id: '1', title: 'SIKSA NERAKA', chain: 'XXI' },
        { id: '2', title: 'AGAK LAEN 2', chain: 'CGV' },
        { id: '3', title: 'AVATAR 3', chain: 'Cinépolis' },
    ];
    const cities = ['JAKARTA', 'SURABAYA', 'BANDUNG'];
    const times = ['10:30', '13:00', '15:30', '18:00', '20:30'];

    const showtimes: Showtime[] = [];
    let id = 1;
    for (const movie of movies) {
        for (const city of cities) {
            for (const time of times) {
                showtimes.push({
                    movie_id: movie.id,
                    movie_title: movie.title,
                    city,
                    theatre_id: `t${id}`,
                    theatre_name: `${movie.chain} ${city} Mall`,
                    chain: movie.chain,
                    room_type: '2D',
                    price: 'Rp55.000',
                    showtime: time,
                    showtime_id: `st${id++}`,
                    is_available: true,
                    date: today,
                });
            }
        }
    }
    return { showtimes, date: today, scraped_at: new Date().toISOString(), total: showtimes.length };
}

export async function GET() {
    if (isServerless) {
        return NextResponse.json(getMockData());
    }

    try {
        const { promises: fs } = await import('fs');
        const path = await import('path');
        const today = new Date().toISOString().split('T')[0];
        const dataDir = path.join(process.cwd(), '..', 'data');

        let movieData = null;
        const candidates = [
            path.join(dataDir, `movies_${today}.json`),
            path.join(dataDir, 'movies_2025-12-17.json'),
        ];

        for (const filePath of candidates) {
            try {
                const fileContent = await fs.readFile(filePath, 'utf-8');
                movieData = JSON.parse(fileContent);
                break;
            } catch { continue; }
        }

        if (!movieData) {
            return NextResponse.json(getMockData());
        }

        const showtimes: Showtime[] = [];
        for (const movie of movieData.movies || []) {
            for (const [city, theatres] of Object.entries(movie.schedules || {})) {
                for (const theatre of theatres as any[]) {
                    for (const room of theatre.rooms || []) {
                        for (const st of room.all_showtimes || []) {
                            showtimes.push({
                                movie_id: movie.id,
                                movie_title: movie.title,
                                city,
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

        return NextResponse.json({ showtimes, date: movieData.date, scraped_at: movieData.scraped_at, total: showtimes.length });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(getMockData());
    }
}
