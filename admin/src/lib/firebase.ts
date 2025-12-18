/**
 * GCP Firestore REST API client
 */

const PROJECT_ID = 'cineradar-481014';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export class FirestoreClient {
    private baseUrl = FIRESTORE_BASE_URL;

    async getCollection(collectionName: string): Promise<any[]> {
        const allDocs: any[] = [];
        let pageToken: string | undefined;

        do {
            const params = new URLSearchParams({ pageSize: '500' });
            if (pageToken) params.append('pageToken', pageToken);

            const response = await fetch(`${this.baseUrl}/${collectionName}?${params}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (data.documents) {
                allDocs.push(...data.documents.map((doc: any) => ({
                    id: doc.name.split('/').pop(),
                    ...this.convertFirestoreFields(doc.fields || {})
                })));
            }
            pageToken = data.nextPageToken;
        } while (pageToken);

        return allDocs;
    }

    async getCollectionWithQuery(collectionName: string, orderBy?: string, limit?: number): Promise<any[]> {
        const params = new URLSearchParams();
        if (orderBy) params.append('orderBy', `${orderBy} desc`);
        if (limit) params.append('pageSize', limit.toString());

        const response = await fetch(`${this.baseUrl}/${collectionName}?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        return (data.documents || []).map((doc: any) => ({
            id: doc.name.split('/').pop(),
            ...this.convertFirestoreFields(doc.fields || {})
        }));
    }

    private convertFirestoreFields(fields: any): any {
        const result: any = {};
        for (const [key, value] of Object.entries(fields)) {
            const v = value as any;
            if (v.stringValue !== undefined) result[key] = v.stringValue;
            else if (v.integerValue !== undefined) result[key] = parseInt(v.integerValue);
            else if (v.doubleValue !== undefined) result[key] = parseFloat(v.doubleValue);
            else if (v.booleanValue !== undefined) result[key] = v.booleanValue;
            else if (v.nullValue !== undefined) result[key] = null;
            else if (v.timestampValue !== undefined) result[key] = new Date(v.timestampValue);
            else if (v.arrayValue !== undefined) result[key] = v.arrayValue.values?.map((x: any) => this.convertFirestoreFields({ t: x }).t) || [];
            else if (v.mapValue !== undefined) result[key] = this.convertFirestoreFields(v.mapValue.fields || {});
        }
        return result;
    }

    async getCollectionCount(collectionName: string): Promise<number> {
        let count = 0;
        let pageToken: string | undefined;

        do {
            const params = new URLSearchParams({ pageSize: '500' });
            if (pageToken) params.append('pageToken', pageToken);

            const response = await fetch(`${this.baseUrl}/${collectionName}?${params}`);
            if (!response.ok) return 0;

            const data = await response.json();
            count += data.documents?.length || 0;
            pageToken = data.nextPageToken;
        } while (pageToken);

        return count;
    }

    async getSampleDocument(collectionName: string): Promise<any | null> {
        const docs = await this.getCollectionWithQuery(collectionName, undefined, 1);
        return docs.length > 0 ? docs[0] : null;
    }
}

export const firestoreClient = new FirestoreClient();

