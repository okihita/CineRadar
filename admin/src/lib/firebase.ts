/**
 * GCP Firestore REST API client
 */

const PROJECT_ID = 'cineradar-481014';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export class FirestoreClient {
    private baseUrl = FIRESTORE_BASE_URL;

    async getCollection(collectionName: string): Promise<any[]> {
        try {
            const response = await fetch(`${this.baseUrl}/${collectionName}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (!data.documents) {
                return [];
            }

            return data.documents.map((doc: any) => {
                const id = doc.name.split('/').pop();
                const fields = this.convertFirestoreFields(doc.fields || {});
                return { id, ...fields };
            });
        } catch (error) {
            console.error(`Error fetching ${collectionName}:`, error);
            throw error;
        }
    }

    async getCollectionWithQuery(collectionName: string, orderBy?: string, limit?: number): Promise<any[]> {
        try {
            let url = `${this.baseUrl}/${collectionName}`;
            const params = new URLSearchParams();
            
            if (orderBy) {
                params.append('orderBy', `${orderBy} desc`);
            }
            if (limit) {
                params.append('pageSize', limit.toString());
            }
            
            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (!data.documents) {
                return [];
            }

            return data.documents.map((doc: any) => {
                const id = doc.name.split('/').pop();
                const fields = this.convertFirestoreFields(doc.fields || {});
                return { id, ...fields };
            });
        } catch (error) {
            console.error(`Error fetching ${collectionName} with query:`, error);
            throw error;
        }
    }

    private convertFirestoreFields(fields: any): any {
        const result: any = {};
        
        for (const [key, value] of Object.entries(fields)) {
            if (typeof value === 'object' && value !== null) {
                const fieldValue = value as any;
                
                if (fieldValue.stringValue !== undefined) {
                    result[key] = fieldValue.stringValue;
                } else if (fieldValue.integerValue !== undefined) {
                    result[key] = parseInt(fieldValue.integerValue);
                } else if (fieldValue.doubleValue !== undefined) {
                    result[key] = parseFloat(fieldValue.doubleValue);
                } else if (fieldValue.booleanValue !== undefined) {
                    result[key] = fieldValue.booleanValue;
                } else if (fieldValue.timestampValue !== undefined) {
                    result[key] = new Date(fieldValue.timestampValue);
                } else if (fieldValue.arrayValue !== undefined) {
                    result[key] = fieldValue.arrayValue.values?.map((v: any) => this.convertFirestoreFields({ temp: v }).temp) || [];
                } else if (fieldValue.mapValue !== undefined) {
                    result[key] = this.convertFirestoreFields(fieldValue.mapValue.fields || {});
                } else {
                    result[key] = fieldValue;
                }
            }
        }
        
        return result;
    }
}

export const firestoreClient = new FirestoreClient();
