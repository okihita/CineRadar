import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import zlib from 'zlib';

function decompressLayout(base64Data?: string | null): LayoutGrid | null {
    if (!base64Data) return null;
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        const decompressed = zlib.gunzipSync(buffer);
        const jsonStr = decompressed.toString('utf-8');
        return JSON.parse(jsonStr) as LayoutGrid;
    } catch (error) {
        console.error('Failed to decompress layout data:', error);
        return null;
    }
}

interface Seat {
    id: string;
    status: number;
}

interface SeatRow {
    row_name: string;
    seats: (Seat | null)[];
}

type LayoutGrid = SeatRow[];

interface RawShowtimeResponse {
    showtimeId: string;
    movieTitle: string;
    theatreName: string;
    city: string;
    roomCategory: string;
    merchant: string;
    showtime: string;
    date: string;
    occupancyPct: number;
    totalSeats: number;
    soldSeats: number;
    scrapedAt: string;
    rawApiResponse: object | null;
    initialLayout: LayoutGrid | null;
    finalLayout: LayoutGrid | null;
    masterLayout: unknown | null;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ showtimeId: string }> }
) {
    const { showtimeId } = await params;
    const { searchParams } = new URL(request.url);

    const movieId = searchParams.get('movieId');
    const date = searchParams.get('date');

    if (!movieId || !date) {
        return NextResponse.json(
            { error: 'movieId and date query parameters required' },
            { status: 400 }
        );
    }

    try {
        // Try V2 collection first (if movieId is actually a metadataId)
        let doc = await firestoreRestClient.getDocument(
            `movie_performance_v2/${movieId}/days/${date}/showtimes`,
            showtimeId
        );

        // Fallback to V1 collection
        if (!doc) {
            doc = await firestoreRestClient.getDocument(
                `movie_performance/${movieId}/days/${date}/showtimes`,
                showtimeId
            );
        }

        if (!doc) {
            return NextResponse.json(
                { error: 'Showtime not found' },
                { status: 404 }
            );
        }

        const data = doc as Record<string, unknown>;

        // Decode layout data
        const initialLayout = decompressLayout(data.initial_layout_compressed as string | undefined);
        const finalLayout = decompressLayout(data.layout_compressed as string | undefined);

        // Fetch master layout
        let masterLayout = null;
        const theatreId = data.theatre_id ? String(data.theatre_id) : null;
        const studioId = data.studio_id ? String(data.studio_id) : null;

        if (theatreId && studioId) {
            try {
                const studioDoc = await firestoreRestClient.getDocument(
                    `theatres/${theatreId}/studios`,
                    studioId
                );
                if (studioDoc && studioDoc.layout) {
                    masterLayout = studioDoc.layout;
                }
            } catch (err) {
                console.error('Failed to fetch master layout:', err);
            }
        }

        const response: RawShowtimeResponse = {
            showtimeId: String(data.showtime_id),
            movieTitle: String(data.movie_title),
            theatreName: String(data.theatre_name),
            city: String(data.city),
            roomCategory: String(data.room_category),
            merchant: String(data.merchant),
            showtime: String(data.showtime),
            date: String(data.date),
            occupancyPct: Number(data.occupancy_pct),
            totalSeats: Number(data.total_seats),
            soldSeats: Number(data.sold_seats),
            scrapedAt: String(data.scraped_at),
            rawApiResponse: (data.raw_api_response as object | null) || null,
            initialLayout,
            finalLayout,
            masterLayout,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching showtime raw data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch showtime data' },
            { status: 500 }
        );
    }
}
