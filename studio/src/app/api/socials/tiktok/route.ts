import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('hashtag')?.replace(/^#/, '').toLowerCase() || 'latest';

    try {
        const dataDir = path.join(process.cwd(), 'src/data');
        const specificPath = path.join(dataDir, `tiktok_${tag}.json`);
        const latestPath = path.join(dataDir, 'tiktok_latest.json');

        const targetPath = fs.existsSync(specificPath)
            ? specificPath
            : (fs.existsSync(latestPath) ? latestPath : null);

        if (!targetPath) {
            return NextResponse.json({
                success: false,
                error: 'No local TikTok data file found. Run backend/scripts/pilot_tiktok_crawler.py first.',
            }, { status: 404 });
        }

        const rawData = fs.readFileSync(targetPath, 'utf-8');
        const parsed = JSON.parse(rawData);

        return NextResponse.json({
            success: true,
            filePath: targetPath,
            data: parsed,
        });
    } catch (err: unknown) {
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error reading local TikTok dataset',
        }, { status: 500 });
    }
}
