'use client';

import { useState, useEffect } from 'react';
import { firestoreClient } from '@/lib/firebase';

interface CollectionInfo {
    name: string;
    count: number;
    sampleId?: string;
    sampleTimestamp?: string;
    subcollections?: string[];
}

export default function DebugFirestorePage() {
    const [collections, setCollections] = useState<CollectionInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Known top-level collections
                const collectionNames = [
                    'theatres',
                    'scraper_runs',
                    'snapshots',
                    'auth_tokens',
                    'seat_snapshots',
                ];

                const results: CollectionInfo[] = [];

                for (const name of collectionNames) {
                    try {
                        const count = await firestoreClient.getCollectionCount(name);
                        const sample = await firestoreClient.getSampleDocument(name);

                        // Extract timestamp from sample if available
                        let sampleTimestamp: string | undefined;
                        if (sample) {
                            const ts = sample.timestamp || sample.created_at || sample.scraped_at;
                            if (ts) {
                                sampleTimestamp = typeof ts === 'string' ? ts : new Date(ts).toISOString();
                            }
                        }

                        results.push({
                            name,
                            count,
                            sampleId: sample?.id as string | undefined,
                            sampleTimestamp,
                        });
                    } catch (err) {
                        results.push({
                            name,
                            count: -1, // Indicates error
                            sampleId: `Error: ${err instanceof Error ? err.message : 'Unknown'}`,
                        });
                    }
                }

                setCollections(results);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-bold mb-4">Firestore Debug</h1>
                <p>Loading Firestore collections...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-bold mb-4">Firestore Debug</h1>
                <p className="text-red-500">Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Firestore Debug</h1>
            <p className="text-sm text-gray-500 mb-6">
                Local time: {new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
            </p>

            <div className="space-y-4">
                {collections.map((col) => (
                    <div key={col.name} className="border rounded-lg p-4 bg-white shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <h2 className="text-lg font-semibold font-mono">{col.name}</h2>
                            <span className={`px-2 py-1 rounded text-sm ${col.count >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {col.count >= 0 ? `${col.count} docs` : 'Error'}
                            </span>
                        </div>

                        {col.sampleId && (
                            <div className="text-sm text-gray-600">
                                <p><strong>Sample ID:</strong> {col.sampleId}</p>
                                {col.sampleTimestamp && (
                                    <p><strong>Timestamp:</strong> {col.sampleTimestamp}</p>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-8 p-4 bg-gray-100 rounded-lg">
                <h3 className="font-semibold mb-2">Firebase Config Check</h3>
                <pre className="text-xs overflow-x-auto">
                    {JSON.stringify({
                        hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
                        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET',
                        hasAppId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
                    }, null, 2)}
                </pre>
            </div>
        </div>
    );
}
