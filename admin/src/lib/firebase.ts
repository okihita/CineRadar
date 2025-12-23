/**
 * Firebase Firestore client using Firebase Web SDK
 * Uses Firestore security rules for access control
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    Firestore,
    DocumentData,
    getCountFromServer,
} from 'firebase/firestore';

// Firebase config from environment variables
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cineradar-481014',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
let db: Firestore;

function getFirebaseApp(): FirebaseApp {
    if (!app) {
        app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    }
    return app;
}

function getDb(): Firestore {
    if (!db) {
        db = getFirestore(getFirebaseApp());
    }
    return db;
}

export class FirestoreClient {
    async getCollection(collectionName: string): Promise<DocumentData[]> {
        try {
            const db = getDb();
            const snapshot = await getDocs(collection(db, collectionName));
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error(`Error getting collection ${collectionName}:`, error);
            return [];
        }
    }

    async getCollectionWithQuery(collectionName: string, orderByField?: string, limitCount?: number): Promise<DocumentData[]> {
        try {
            const db = getDb();
            const collRef = collection(db, collectionName);

            // Build query with optional orderBy and limit
            let q;
            if (orderByField && limitCount) {
                q = query(collRef, orderBy(orderByField, 'desc'), limit(limitCount));
            } else if (orderByField) {
                q = query(collRef, orderBy(orderByField, 'desc'));
            } else if (limitCount) {
                q = query(collRef, limit(limitCount));
            } else {
                q = query(collRef);
            }

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error(`Error getting collection ${collectionName} with query:`, error);
            return [];
        }
    }

    async getCollectionCount(collectionName: string): Promise<number> {
        try {
            const db = getDb();
            const collRef = collection(db, collectionName);
            const snapshot = await getCountFromServer(collRef);
            return snapshot.data().count;
        } catch (error) {
            console.error(`Error getting count for ${collectionName}:`, error);
            return 0;
        }
    }

    async getSampleDocument(collectionName: string): Promise<DocumentData | null> {
        const docs = await this.getCollectionWithQuery(collectionName, undefined, 1);
        return docs.length > 0 ? docs[0] : null;
    }
}

export const firestoreClient = new FirestoreClient();
