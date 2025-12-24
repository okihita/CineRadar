/**
 * Firebase Admin SDK Client using REST API
 * Avoids gRPC native module issues with Next.js Turbopack
 */

import { GoogleAuth } from 'google-auth-library';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cineradar-481014';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let authClient: GoogleAuth | null = null;

function getAuthClient(): GoogleAuth {
    if (!authClient) {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (serviceAccountJson) {
            const credentials = JSON.parse(serviceAccountJson);
            authClient = new GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/datastore'],
            });
        } else {
            // Use application default credentials for local dev
            authClient = new GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/datastore'],
            });
        }
    }
    return authClient;
}

async function getAccessToken(): Promise<string> {
    const auth = getAuthClient();
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token || '';
}

interface FirestoreValue {
    stringValue?: string;
    integerValue?: string;
    doubleValue?: number;
    booleanValue?: boolean;
    mapValue?: { fields: Record<string, FirestoreValue> };
    arrayValue?: { values: FirestoreValue[] };
    nullValue?: null;
}

function parseFirestoreValue(value: FirestoreValue): unknown {
    if (value.stringValue !== undefined) return value.stringValue;
    if (value.integerValue !== undefined) return parseInt(value.integerValue);
    if (value.doubleValue !== undefined) return value.doubleValue;
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.nullValue !== undefined) return null;
    if (value.mapValue) {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value.mapValue.fields || {})) {
            result[key] = parseFirestoreValue(val);
        }
        return result;
    }
    if (value.arrayValue) {
        return (value.arrayValue.values || []).map(parseFirestoreValue);
    }
    return null;
}

function parseDocument(doc: { name: string; fields: Record<string, FirestoreValue> }): Record<string, unknown> {
    const id = doc.name.split('/').pop() || '';
    const data: Record<string, unknown> = { id };

    for (const [key, value] of Object.entries(doc.fields || {})) {
        data[key] = parseFirestoreValue(value);
    }

    return data;
}

export class FirestoreAdminClient {
    async getCollectionWithQuery(
        collectionName: string,
        orderByField: string,
        limitCount: number = 100
    ): Promise<Record<string, unknown>[]> {
        try {
            const token = await getAccessToken();

            const query = {
                structuredQuery: {
                    from: [{ collectionId: collectionName }],
                    orderBy: [{ field: { fieldPath: orderByField }, direction: 'DESCENDING' }],
                    limit: limitCount,
                },
            };

            const response = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            });

            if (!response.ok) {
                console.error(`Firestore query failed: ${response.status}`);
                return [];
            }

            const results = await response.json();
            return results
                .filter((r: { document?: unknown }) => r.document)
                .map((r: { document: { name: string; fields: Record<string, FirestoreValue> } }) =>
                    parseDocument(r.document)
                );
        } catch (error) {
            console.error(`Error querying ${collectionName}:`, error);
            return [];
        }
    }

    async getCollectionCount(collectionName: string): Promise<number> {
        try {
            const token = await getAccessToken();

            const query = {
                structuredQuery: {
                    from: [{ collectionId: collectionName }],
                    select: { fields: [] },
                },
            };

            const response = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            });

            if (!response.ok) return 0;

            const results = await response.json();
            return results.filter((r: { document?: unknown }) => r.document).length;
        } catch (error) {
            console.error(`Error counting ${collectionName}:`, error);
            return 0;
        }
    }
}

export const firestoreAdminClient = new FirestoreAdminClient();
