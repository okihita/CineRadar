/**
 * Firestore REST API Client
 * Uses direct HTTP calls to Firestore REST API with service account authentication
 * Works reliably in Vercel serverless functions (no gRPC/native module issues)
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
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim()?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Missing Firebase credentials: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY');
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
    bytesValue?: string; // Base64 encoded bytes
    mapValue?: { fields: Record<string, FirestoreValue> };
    arrayValue?: { values?: FirestoreValue[] };
    nullValue?: null;
}

function parseValue(value: FirestoreValue): unknown {
    if ('stringValue' in value) return value.stringValue;
    if ('integerValue' in value) {
        const val = value.integerValue!;
        const num = parseInt(val);
        // If the number is too large for JS to handle precisely, keep it as a string
        return (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) ? val : num;
    }
    if ('doubleValue' in value) return value.doubleValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('timestampValue' in value) return value.timestampValue;
    if ('bytesValue' in value) return value.bytesValue; // Return base64 string directly
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
     * Unified fetch helper with auth and cache: 'no-store'
     */
    private async _fetch(url: string | URL, options: RequestInit = {}): Promise<Response> {
        const token = await getAccessToken();
        const headers: HeadersInit = {
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        };

        // Only add Content-Type if there's a body or it's a mutation
        if (options.body || ['POST', 'PATCH', 'PUT'].includes(options.method || '')) {
            (headers as Record<string, string>)['Content-Type'] = 'application/json';
        }

        return fetch(url.toString(), {
            ...options,
            headers,
            cache: 'no-store',
        });
    }

    /**
     * Get all documents from a collection (with pagination to get ALL docs)
     */
    async getCollection(collectionName: string, maskFields?: string[]): Promise<Record<string, unknown>[]> {
        try {
            const allDocuments: Record<string, unknown>[] = [];
            let pageToken: string | undefined;

            do {
                const url = new URL(`${FIRESTORE_BASE_URL}/${collectionName}`);
                url.searchParams.set('pageSize', '500');

                if (maskFields && maskFields.length > 0) {
                    maskFields.forEach(field => {
                        url.searchParams.append('mask.fieldPaths', field);
                    });
                }

                if (pageToken) {
                    url.searchParams.set('pageToken', pageToken);
                }

                const response = await this._fetch(url);

                if (!response.ok) {
                    console.error(`Failed to get ${collectionName}: ${response.status}`);
                    break;
                }

                const data = await response.json();
                const documents = (data.documents || []).map(parseDocument);
                allDocuments.push(...documents);

                pageToken = data.nextPageToken;
            } while (pageToken);

            return allDocuments;
        } catch (error) {
            console.error(`Error getting ${collectionName}:`, error);
            return [];
        }
    }

    /**
     * Query collection with ordering and limit
     */
    async getCollectionWithQuery(
        collectionName: string,
        orderByField: string,
        limitCount: number = 100
    ): Promise<Record<string, unknown>[]> {
        try {
            const query = {
                structuredQuery: {
                    from: [{ collectionId: collectionName }],
                    orderBy: [{ field: { fieldPath: orderByField }, direction: 'DESCENDING' }],
                    limit: limitCount,
                },
            };

            const response = await this._fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
                method: 'POST',
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
     * Get collection document count
     */
    async getCollectionCount(collectionName: string): Promise<number> {
        try {
            const query = {
                structuredAggregationQuery: {
                    structuredQuery: {
                        from: [{ collectionId: collectionName }],
                    },
                    aggregations: [{ alias: 'count', count: {} }],
                },
            };

            const response = await this._fetch(`${FIRESTORE_BASE_URL}:runAggregationQuery`, {
                method: 'POST',
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
     * Get documents from a collection group (recursive)
     */
    async getCollectionGroup(collectionId: string): Promise<Record<string, unknown>[]> {
        try {
            const allDocuments: Record<string, unknown>[] = [];
            let lastDocName: string | undefined;
            const PAGE_SIZE = 1000;

            while (true) {
                const query: Record<string, unknown> = {
                    structuredQuery: {
                        from: [{ collectionId: collectionId, allDescendants: true }],
                        orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
                        limit: PAGE_SIZE,
                    },
                };

                if (lastDocName) {
                    (query.structuredQuery as Record<string, unknown>).startAt = {
                        values: [{ referenceValue: lastDocName }],
                        before: false
                    };
                }

                const response = await this._fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
                    method: 'POST',
                    body: JSON.stringify(query),
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.error(`Collection group query failed: ${response.status} - ${errText}`);
                    break;
                }

                const results = await response.json();
                if (!Array.isArray(results) || results.length === 0) {
                    break;
                }
                
                const resultsInPage = results.length;
                for (const r of results) {
                    if (r.document) {
                        const parsed = parseDocument(r.document);
                        const pathParts = r.document.name.split('/');
                        if (pathParts.length >= 4) {
                            parsed._parent_id = pathParts[pathParts.length - 3];
                            parsed._path = r.document.name;
                        }
                        allDocuments.push(parsed);
                        lastDocName = r.document.name;
                    }
                }

                if (resultsInPage < PAGE_SIZE) {
                    break;
                }
            }

            return allDocuments;
        } catch (error) {
            console.error(`Error querying collection group ${collectionId}:`, error);
            return [];
        }
    }

    /**
     * Get a single document
     */
    async getDocument(collectionName: string, documentId: string): Promise<Record<string, unknown> | null> {
        try {
            const response = await this._fetch(`${FIRESTORE_BASE_URL}/${collectionName}/${documentId}`);

            if (response.status === 404) {
                return null;
            }

            if (!response.ok) {
                console.error(`Failed to get ${collectionName}/${documentId}: ${response.status}`);
                return null;
            }

            const doc = await response.json();
            return parseDocument(doc);
        } catch (error) {
            console.error(`Error getting ${collectionName}/${documentId}:`, error);
            return null;
        }
    }

    /**
     * Get a single sample document from a collection
     */
    async getSampleDocument(collectionName: string): Promise<Record<string, unknown> | null> {
        const docs = await this.getCollectionWithQuery(collectionName, '__name__', 1);
        return docs.length > 0 ? docs[0] : null;
    }

    /**
     * Get all documents from a sub-collection (with optional field masking)
     */
    async getSubCollection(collectionPath: string, maskFields?: string[]): Promise<Record<string, unknown>[]> {
        try {
            const allDocuments: Record<string, unknown>[] = [];
            let pageToken: string | undefined;

            do {
                const url = new URL(`${FIRESTORE_BASE_URL}/${collectionPath}`);
                url.searchParams.set('pageSize', '500');
                
                if (maskFields && maskFields.length > 0) {
                    maskFields.forEach(field => {
                        url.searchParams.append('mask.fieldPaths', field);
                    });
                }

                if (pageToken) {
                    url.searchParams.set('pageToken', pageToken);
                }

                const response = await this._fetch(url);

                if (!response.ok) {
                    console.error(`Failed to get sub-collection ${collectionPath}: ${response.status}`);
                    break;
                }

                const data = await response.json();
                const documents = (data.documents || []).map(parseDocument);
                allDocuments.push(...documents);

                pageToken = data.nextPageToken;
            } while (pageToken);

            return allDocuments;
        } catch (error) {
            console.error(`Error getting sub-collection ${collectionPath}:`, error);
            return [];
        }
    }

    /**
     * Convert JavaScript value to Firestore value format
     */
    private toFirestoreValue(value: unknown): FirestoreValue {
        if (value === null || value === undefined) {
            return { nullValue: null };
        }
        if (typeof value === 'string') {
            return { stringValue: value };
        }
        if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                return { integerValue: value.toString() };
            }
            return { doubleValue: value };
        }
        if (typeof value === 'boolean') {
            return { booleanValue: value };
        }
        if (value instanceof Date) {
            return { timestampValue: value.toISOString() };
        }
        if (Array.isArray(value)) {
            return {
                arrayValue: {
                    values: value.map(v => this.toFirestoreValue(v)),
                },
            };
        }
        if (typeof value === 'object') {
            const fields: Record<string, FirestoreValue> = {};
            for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
                fields[k] = this.toFirestoreValue(v);
            }
            return { mapValue: { fields } };
        }
        return { stringValue: String(value) };
    }

    /**
     * Update a document (merge mode)
     */
    async updateDocument(
        collectionName: string,
        documentId: string,
        data: Record<string, unknown>
    ): Promise<boolean> {
        try {
            const fields: Record<string, FirestoreValue> = {};
            for (const [key, value] of Object.entries(data)) {
                fields[key] = this.toFirestoreValue(value);
            }

            const response = await this._fetch(
                `${FIRESTORE_BASE_URL}/${collectionName}/${documentId}?updateMask.fieldPaths=${Object.keys(data).join('&updateMask.fieldPaths=')}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ fields }),
                }
            );

            const responseText = await response.text();
            console.log(`[Firestore PATCH] ${collectionName}/${documentId} status: ${response.status}`, responseText.substring(0, 500));

            if (!response.ok) {
                console.error(`Failed to update ${collectionName}/${documentId}: ${response.status}`, responseText);
                return false;
            }

            return true;
        } catch (error) {
            console.error(`Error updating ${collectionName}/${documentId}:`, error);
            return false;
        }
    }
}

export const firestoreRestClient = new FirestoreRestClient();
