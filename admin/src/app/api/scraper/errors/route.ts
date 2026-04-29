import { NextRequest, NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';
import { auth } from '@/auth';

/**
 * GET /api/scraper/errors
 * 
 * Fetches error details for a specific dispatch and counts by HTTP status.
 * Used to distinguish between logic issues (401) and operational issues (400).
 * 
 * Query params:
 *   - date: Required date in YYYY-MM-DD format
 *   - slot: Required dispatch slot (e.g., "10-35" or "10:35")
 */
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date');
        const slot = searchParams.get('slot');

        if (!dateStr || !slot) {
            return NextResponse.json(
                { error: 'Missing required params: date and slot' },
                { status: 400 }
            );
        }

        // Normalize slot format (10-35 or 10:35 -> 10-35 for Firestore doc ID)
        const normalizedSlot = slot.replace(':', '-');

        // Fetch errors subcollection: scraper_logs/{date}/dispatches/{slot}/errors
        const errors = await firestoreRestClient.getSubCollection(
            `scraper_logs/${dateStr}/dispatches/${normalizedSlot}/errors`
        );

        if (!errors || errors.length === 0) {
            return NextResponse.json({
                date: dateStr,
                slot: normalizedSlot,
                total: 0,
                error_counts: { "401": 0, "400": 0, "other": 0 },
                errors: [],
            });
        }

        // Count errors by HTTP status
        const errorCounts = {
            "401": 0,  // Auth/token issues - DANGER
            "400": 0,  // Operational - WARNING
            "other": 0, // Network, schema issues, etc.
        };

        const errorDetails: Array<{
            http_status: number;
            api_error: string;
            movie_title: string;
            theatre: string;
            merchant: string;
        }> = [];

        for (const err of errors) {
            const httpStatus = (err.http_status as number) || 0;

            if (httpStatus === 401) {
                errorCounts["401"]++;
            } else if (httpStatus === 400) {
                errorCounts["400"]++;
            } else {
                errorCounts["other"]++;
            }

            errorDetails.push({
                http_status: httpStatus,
                api_error: (err.api_error as string) || '',
                movie_title: (err.movie_title as string) || '',
                theatre: (err.theatre as string) || '',
                merchant: (err.merchant as string) || '',
            });
        }

        return NextResponse.json({
            date: dateStr,
            slot: normalizedSlot,
            total: errors.length,
            error_counts: errorCounts,
            errors: errorDetails,
        });

    } catch (error) {
        console.error('Error fetching dispatch errors:', error);
        return NextResponse.json(
            { error: 'Failed to fetch errors' },
            { status: 500 }
        );
    }
}
