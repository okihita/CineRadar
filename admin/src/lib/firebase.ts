import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'REDACTED_API_KEY',
    authDomain: 'cineradar-481014.firebaseapp.com',
    projectId: 'cineradar-481014',
    storageBucket: 'cineradar-481014.appspot.com',
    messagingSenderId: '62131014326',
    appId: '1:62131014326:web:cineradar'
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export { app, db };
