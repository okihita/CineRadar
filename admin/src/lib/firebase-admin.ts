/**
 * Firebase Admin SDK Client using REST API
 * Uses direct JWT signing for Vercel compatibility (no gRPC, no google-auth-library issues)
 */

import jwt from 'jsonwebtoken';
import { TIME_CONSTANTS } from './constants';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!PROJECT_ID) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable');
}
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Token cache
let cachedToken: { token: string; expiry: number } | null = null;

async function getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (cachedToken && Date.now() < cachedToken.expiry - TIME_CONSTANTS.TOKEN_BUFFER) {
        return cachedToken.token;
    }

    // Read from split environment variables (cleaner than Base64)
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        console.error('Missing Firebase credentials');
        throw new Error('Missing Firebase service account credentials');
    }

    const serviceAccount = {
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey,
    };

    // Create JWT for Google OAuth2
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600, // 1 hour
        scope: 'https://www.googleapis.com/auth/datastore',
    };

    const signedJwt = jwt.sign(payload, serviceAccount.private_key, { algorithm: 'RS256' });

    // Exchange JWT for access token (30 second timeout)
    const response = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: signedJwt,
        }),
    }, 30000);

    if (!response) {
        throw new Error('Token exchange failed: Request timeout');
    }

    if (!response.ok) {
        const error = await response.text();
        console.error('Token exchange failed:', error);
        throw new Error('Failed to get access token');
    }

    const data = await response.json();

    // Cache the token
    cachedToken = {
        token: data.access_token,
        expiry: Date.now() + (data.expires_in * 1000),
    };

    return cachedToken.token;
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

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms`);
        }
        throw error;
    }
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries: number = TIME_CONSTANTS.MAX_RETRIES): Promise<Response | null> {
    const { RETRY_DELAY_BASE } = TIME_CONSTANTS;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fetchWithTimeout(url, options, TIME_CONSTANTS.FIREBASE_REQUEST_TIMEOUT);
        } catch (error) {
            if (attempt === maxRetries - 1) {
                console.error(`Fetch failed after ${maxRetries} attempts for ${url}:`, error);
                return null;
            }

            const delay = RETRY_DELAY_BASE * Math.pow(2, attempt) * (0.9 + 0.1 * Math.random());
            console.warn(`Fetch attempt ${attempt + 1} failed for ${url}, retrying in ${Math.round(delay)}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    return null;
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

            const response = await fetchWithRetry(`${FIRESTORE_BASE_URL}:runQuery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            });

            if (!response) {
                console.error(`Firestore query failed for ${collectionName}: All retries exhausted`);
                return [];
            }

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

    async getSubCollection(fullPath: string): Promise<Record<string, unknown>[]> {
        try {
            const token = await getAccessToken();

            // fullPath: "movie_performance/123/days"
            const parts = fullPath.split('/');
            const collectionId = parts.pop();
            const parentPath = parts.join('/'); // "movie_performance/123"

            // Target the parent document for the runQuery
            const url = `${FIRESTORE_BASE_URL}/${parentPath}:runQuery`;

            const query = {
                structuredQuery: {
                    from: [{ collectionId: collectionId }],
                    // No default order, return all
                },
            };

            const response = await fetchWithRetry(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            });

            if (!response) {
                console.error(`Firestore subcollection query failed for ${fullPath}: All retries exhausted`);
                return [];
            }

            if (!response.ok) {
                console.error(`Firestore subcollection query failed: ${response.status}`);
                return [];
            }

            const results = await response.json();
            return results
                .filter((r: { document?: unknown }) => r.document)
                .map((r: { document: { name: string; fields: Record<string, FirestoreValue> } }) =>
                    parseDocument(r.document)
                );
        } catch (error) {
            console.error(`Error querying subcollection ${fullPath}:`, error);
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

            const response = await fetchWithRetry(`${FIRESTORE_BASE_URL}:runQuery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            });

            if (!response) {
                console.error(`Firestore count query failed for ${collectionName}: All retries exhausted`);
                return 0;
            }

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
