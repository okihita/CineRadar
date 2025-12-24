import { NextResponse } from 'next/server';

export async function GET() {
    // Debug endpoint to check Firebase config in production
    // IMPORTANT: Never log the actual API key, only check if it exists
    return NextResponse.json({
        hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET',
        hasAppId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        hasAuthDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        hasServiceAccountKey: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    });
}
