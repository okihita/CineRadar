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

function extractLayoutFromRaw(raw: unknown): LayoutGrid | null {
    if (!raw || typeof raw !== 'object') return null;
    const rawObj = raw as { data?: { seat_map?: { seat_code: string; seat_rows: { seat_row: string; status: number }[] }[] } };
    if (!rawObj.data || !rawObj.data.seat_map) return null;
    try {
        const tixSeatMap = rawObj.data.seat_map;
        return tixSeatMap.map((row) => ({
            row_name: row.seat_code,
            seats: (row.seat_rows || []).map((s) => ({
                id: s.seat_row,
                status: s.status
            }))
        }));
    } catch (e) {
        console.error('Failed to extract layout from raw API response:', e);
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
    isInferred: boolean;
    inferredStudioId?: string;
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
        // performance collection only (V1 sunset)
        const doc = await firestoreRestClient.getDocument(
            `movie_performance_v2/${movieId}/days/${date}/showtimes`,
            showtimeId
        );

        if (!doc) {
            return NextResponse.json(
                { error: 'Showtime not found' },
                { status: 404 }
            );
        }

        const data = doc as Record<string, unknown>;
        const rawApiResponse = data.raw_api_response || null;

        // Decode layout data
        const initialLayout = decompressLayout(data.initial_layout_compressed as string | undefined);
        
        // Prioritize Raw API Response for the Final Layout (preserves TIX ID status codes like 5, 6)
        // Fallback to the compressed layout if raw is missing
        const finalLayout = extractLayoutFromRaw(rawApiResponse) || decompressLayout(data.layout_compressed as string | undefined);

        // Fetch master layout
        let masterLayout = null;
        let isInferred = false;
        let inferredStudioId: string | undefined = undefined;
        
        const theatreId = data.theatre_id ? String(data.theatre_id) : null;
        const studioId = data.studio_id ? String(data.studio_id) : null;
        const totalSeats = Number(data.total_seats);

        if (theatreId) {
            try {
                if (studioId) {
                    // Modern data: Exact lookup
                    const studioDoc = await firestoreRestClient.getDocument(
                        `theatres/${theatreId}/studios`,
                        studioId
                    );
                    if (studioDoc && studioDoc.layout) {
                        masterLayout = studioDoc.layout;
                    }
                } else {
                    // Legacy data: JIT Inference by capacity
                    const studios = await firestoreRestClient.getCollection(
                        `theatres/${theatreId}/studios`
                    );
                    // Find a studio with the exact same capacity
                    const matchingStudio = studios.find(s => Number(s.total_seats) === totalSeats);
                    if (matchingStudio && matchingStudio.layout) {
                        masterLayout = matchingStudio.layout;
                        isInferred = true;
                        inferredStudioId = String(matchingStudio.id);
                        console.log(`[JIT Inference] Matched legacy showtime (seats: ${totalSeats}) to studio ID: ${matchingStudio.id}`);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch master layout:', err);
            }
        }

        const showtimeData: RawShowtimeResponse = {
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
            isInferred,
            inferredStudioId,
        };

        return NextResponse.json({
            success: true,
            data: showtimeData
        });
        } catch (error) {
        console.error('Error fetching showtime raw data:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch showtime data' },
            { status: 500 }
        );
        }
        }

