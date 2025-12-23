import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const dataPath = path.join(process.cwd(), '..', 'data', 'live_seat_snapshot.json');

        if (!fs.existsSync(dataPath)) {
            return NextResponse.json(
                { error: 'No seat data available. Run the scraper first.' },
                { status: 404 }
            );
        }

        const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error reading seat data:', error);
        return NextResponse.json(
            { error: 'Failed to read seat data' },
            { status: 500 }
        );
    }
}
