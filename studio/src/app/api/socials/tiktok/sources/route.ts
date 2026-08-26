import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { firestoreRestClient } from '@/lib/firestore-rest';

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
    excluded_hashtags?: string[];
}

function sortedUniqueTags(tags: string[]): string[] {
    const set = new Set<string>();
    for (const t of tags) {
        const clean = t.replace(/^#/, '').trim().toLowerCase();
        if (clean) set.add(clean);
    }
    return Array.from(set).sort();
}

const FIRESTORE_COLLECTION = 'tiktok_sources';
const FIRESTORE_DOC_ID = 'config';

function getSourcesFilePath(): string {
    return path.join(process.cwd(), 'src/data/tiktok_sources.json');
}

function readLocalSources(): SourcesData {
    const filePath = getSourcesFilePath();
    if (!fs.existsSync(filePath)) {
        return { sources: [], overrides: {}, excluded_hashtags: [] };
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return { sources: [], overrides: {}, excluded_hashtags: [] };
    }
}

function writeLocalSources(data: SourcesData): void {
    try {
        const filePath = getSourcesFilePath();
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.warn('[TikTok Sources] Failed to write local cache backup:', e);
    }
}

async function getSourcesData(): Promise<SourcesData> {
    try {
        const doc = await firestoreRestClient.getDocument<SourcesData>(FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);
        if (doc && Array.isArray(doc.sources)) {
            // Update local fallback file asynchronously
            writeLocalSources(doc);
            return {
                sources: doc.sources,
                overrides: doc.overrides || {},
                excluded_hashtags: doc.excluded_hashtags || [],
            };
        }
    } catch (err) {
        console.warn('[TikTok Sources] Firestore read fallback to local JSON:', err);
    }

    // Fallback to local JSON file
    const local = readLocalSources();
    // Seed Firestore asynchronously if not yet present
    if (local.sources.length > 0) {
        firestoreRestClient.createDocument(FIRESTORE_COLLECTION, FIRESTORE_DOC_ID, {
            sources: local.sources,
            overrides: local.overrides || {},
            excluded_hashtags: local.excluded_hashtags || [],
            updated_at: new Date().toISOString(),
        }).catch((err) => console.warn('[TikTok Sources] Initial Firestore seed error:', err));
    }
    return local;
}

async function persistSourcesData(data: SourcesData): Promise<boolean> {
    // 1. Write local disk cache
    writeLocalSources(data);

    // 2. Persist to Firestore
    try {
        const payload = {
            sources: data.sources,
            overrides: data.overrides || {},
            updated_at: new Date().toISOString(),
        };
        const updated = await firestoreRestClient.updateDocument(FIRESTORE_COLLECTION, FIRESTORE_DOC_ID, payload);
        if (!updated) {
            await firestoreRestClient.createDocument(FIRESTORE_COLLECTION, FIRESTORE_DOC_ID, payload);
        }
        return true;
    } catch (err) {
        console.error('[TikTok Sources] Firestore write error:', err);
        return false;
    }
}

export async function GET() {
    try {
        const data = await getSourcesData();
        return NextResponse.json({
            success: true,
            sources: data.sources,
            overrides: data.overrides || {},
            excluded_hashtags: data.excluded_hashtags || [],
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
        const { action, source, override, excluded_hashtags } = body;
        const currentData = await getSourcesData();

        if (action === 'set_excluded' && Array.isArray(excluded_hashtags)) {
            currentData.excluded_hashtags = sortedUniqueTags(excluded_hashtags);
            await persistSourcesData(currentData);
            return NextResponse.json({ success: true, message: 'Excluded hashtags updated', excluded_hashtags: currentData.excluded_hashtags });
        }

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
            await persistSourcesData(currentData);
            return NextResponse.json({ success: true, message: 'Source added/updated', sources: currentData.sources });
        }

        if (action === 'toggle_source' && source?.id) {
            const item = currentData.sources.find(s => s.id === source.id);
            if (item) {
                item.active = !item.active;
                await persistSourcesData(currentData);
                return NextResponse.json({ success: true, message: 'Source toggled', sources: currentData.sources });
            }
            return NextResponse.json({ success: false, error: 'Source not found' }, { status: 404 });
        }

        if (action === 'delete_source' && source?.id) {
            currentData.sources = currentData.sources.filter(s => s.id !== source.id);
            await persistSourcesData(currentData);
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
            await persistSourcesData(currentData);
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
