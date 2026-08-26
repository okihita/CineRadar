import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface TruthSource {
    id: string;
    handle: string;
    name: string;
    category: 'exhibitor' | 'studio' | 'tracker';
    active: boolean;
    verified: boolean;
    priority: 'high' | 'medium' | 'low';
    notes: string;
}

interface SourcesData {
    sources: TruthSource[];
    overrides: Record<string, string[]>;
}

function getSourcesFilePath(): string {
    return path.join(process.cwd(), 'src/data/tiktok_sources.json');
}

function readSources(): SourcesData {
    const filePath = getSourcesFilePath();
    if (!fs.existsSync(filePath)) {
        return { sources: [], overrides: {} };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
}

function writeSources(data: SourcesData): void {
    const filePath = getSourcesFilePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET() {
    try {
        const data = readSources();
        return NextResponse.json({
            success: true,
            sources: data.sources,
            overrides: data.overrides || {},
        });
    } catch (err: unknown) {
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to read TikTok sources',
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, source, override } = body;
        const currentData = readSources();

        if (action === 'add_source' && source) {
            const cleanHandle = source.handle.replace(/^@/, '').trim().toLowerCase();
            const existingIdx = currentData.sources.findIndex(s => s.handle.toLowerCase() === cleanHandle);
            
            const newSource: TruthSource = {
                id: source.id || `src-${cleanHandle.replace(/[^a-z0-9]/g, '-')}`,
                handle: cleanHandle,
                name: source.name || cleanHandle,
                category: source.category || 'studio',
                active: source.active !== false,
                verified: Boolean(source.verified),
                priority: source.priority || 'medium',
                notes: source.notes || '',
            };

            if (existingIdx >= 0) {
                currentData.sources[existingIdx] = newSource;
            } else {
                currentData.sources.push(newSource);
            }
            writeSources(currentData);
            return NextResponse.json({ success: true, message: 'Source added/updated', sources: currentData.sources });
        }

        if (action === 'toggle_source' && source?.id) {
            const item = currentData.sources.find(s => s.id === source.id);
            if (item) {
                item.active = !item.active;
                writeSources(currentData);
                return NextResponse.json({ success: true, message: 'Source toggled', sources: currentData.sources });
            }
            return NextResponse.json({ success: false, error: 'Source not found' }, { status: 404 });
        }

        if (action === 'delete_source' && source?.id) {
            currentData.sources = currentData.sources.filter(s => s.id !== source.id);
            writeSources(currentData);
            return NextResponse.json({ success: true, message: 'Source deleted', sources: currentData.sources });
        }

        if (action === 'set_override' && override?.movieTitle) {
            const movieKey = override.movieTitle.trim().toUpperCase();
            const tags = Array.isArray(override.hashtags)
                ? override.hashtags.map((t: string) => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean)
                : [];
            
            if (tags.length === 0) {
                delete currentData.overrides[movieKey];
            } else {
                currentData.overrides[movieKey] = tags;
            }
            writeSources(currentData);
            return NextResponse.json({ success: true, message: 'Override saved', overrides: currentData.overrides });
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    } catch (err: unknown) {
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to update TikTok sources',
        }, { status: 500 });
    }
}
