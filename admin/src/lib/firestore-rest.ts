/**
 * Firestore REST API Client
 * Uses direct HTTP calls to Firestore REST API with service account authentication
 * Works reliably in Vercel serverless functions (no gRPC/native module issues)
 */

import jwt from 'jsonwebtoken';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cineradar-481014';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Token cache
let cachedToken: { token: string; expiry: number } | null = null;

async function getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (cachedToken && Date.now() < cachedToken.expiry - 300000) {
        return cachedToken.token;
    }

    const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (!base64Key) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 not set');
    }

    const serviceAccount = JSON.parse(Buffer.from(base64Key, 'base64').toString());

    // Create JWT for Google OAuth2
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/datastore',
    };

    const signedJwt = jwt.sign(payload, serviceAccount.private_key, { algorithm: 'RS256' });

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: signedJwt,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    cachedToken = {
        token: data.access_token,
        expiry: Date.now() + (data.expires_in * 1000),
    };

    return cachedToken.token;
}

// Parse Firestore value types
interface FirestoreValue {
    stringValue?: string;
    integerValue?: string;
    doubleValue?: number;
    booleanValue?: boolean;
    timestampValue?: string;
    mapValue?: { fields: Record<string, FirestoreValue> };
    arrayValue?: { values?: FirestoreValue[] };
    nullValue?: null;
}

function parseValue(value: FirestoreValue): unknown {
    if ('stringValue' in value) return value.stringValue;
    if ('integerValue' in value) return parseInt(value.integerValue!);
    if ('doubleValue' in value) return value.doubleValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('timestampValue' in value) return value.timestampValue;
    if ('nullValue' in value) return null;
    if ('mapValue' in value && value.mapValue?.fields) {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value.mapValue.fields)) {
            result[k] = parseValue(v);
        }
        return result;
    }
    if ('arrayValue' in value) {
        return (value.arrayValue?.values || []).map(parseValue);
    }
    return null;
}

function parseDocument(doc: { name: string; fields?: Record<string, FirestoreValue> }): Record<string, unknown> {
    const id = doc.name.split('/').pop() || '';
    const data: Record<string, unknown> = { id };

    if (doc.fields) {
        for (const [key, value] of Object.entries(doc.fields)) {
            data[key] = parseValue(value);
        }
    }

    return data;
}

export class FirestoreRestClient {
    /**
     * Get all documents from a collection
     */
    async getCollection(collectionName: string): Promise<Record<string, unknown>[]> {
        try {
            const token = await getAccessToken();

            const response = await fetch(`${FIRESTORE_BASE_URL}/${collectionName}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) {
                console.error(`Failed to get ${collectionName}: ${response.status}`);
                return [];
            }

            const data = await response.json();
            return (data.documents || []).map(parseDocument);
        } catch (error) {
            console.error(`Error getting ${collectionName}:`, error);
            return [];
        }
    }

    /**
     * Query collection with ordering and limit using Firestore REST runQuery
     */
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
                console.error(`Query failed for ${collectionName}: ${response.status}`);
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

    /**
     * Get collection document count using aggregation query
     */
    async getCollectionCount(collectionName: string): Promise<number> {
        try {
            const token = await getAccessToken();

            const query = {
                structuredAggregationQuery: {
                    structuredQuery: {
                        from: [{ collectionId: collectionName }],
                    },
                    aggregations: [{ alias: 'count', count: {} }],
                },
            };

            const response = await fetch(`${FIRESTORE_BASE_URL}:runAggregationQuery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            });

            if (!response.ok) {
                console.error(`Count failed for ${collectionName}: ${response.status}`);
                return 0;
            }

            const results = await response.json();
            const countResult = results[0]?.result?.aggregateFields?.count?.integerValue;
            return countResult ? parseInt(countResult) : 0;
        } catch (error) {
            console.error(`Error counting ${collectionName}:`, error);
            return 0;
        }
    }

    /**
     * Get a single sample document from a collection
     */
    async getSampleDocument(collectionName: string): Promise<Record<string, unknown> | null> {
        const docs = await this.getCollectionWithQuery(collectionName, '__name__', 1);
        return docs.length > 0 ? docs[0] : null;
    }
}

export const firestoreRestClient = new FirestoreRestClient();
