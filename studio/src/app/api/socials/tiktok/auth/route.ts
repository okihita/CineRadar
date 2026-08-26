import { NextResponse } from 'next/server';
import { firestoreRestClient } from '@/lib/firestore-rest';

interface SocialAuthDoc {
    apify_api_token?: string;
    gemini_tiktok_api_key?: string;
    status?: string;
    updated_at?: string;
    updated_by?: string;
}

export async function GET() {
    try {
        const doc = await firestoreRestClient.getDocument<SocialAuthDoc>('auth_tokens', 'socials');
        const token = doc?.apify_api_token || '';
        const isConfigured = Boolean(token && token.length > 5);
        const masked = isConfigured ? `${token.slice(0, 8)}...${token.slice(-4)}` : '';

        const geminiKey = doc?.gemini_tiktok_api_key || '';
        const isGeminiConfigured = Boolean(geminiKey && geminiKey.length > 5);
        const maskedGemini = isGeminiConfigured ? `${geminiKey.slice(0, 6)}...${geminiKey.slice(-4)}` : '';

        return NextResponse.json({
            success: true,
            isConfigured,
            maskedToken: masked,
            isGeminiConfigured,
            maskedGeminiToken: maskedGemini,
            status: doc?.status || 'inactive',
            updated_at: doc?.updated_at || null,
        });
    } catch (err: unknown) {
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to fetch auth settings',
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { apify_api_token } = body;

        if (!apify_api_token || typeof apify_api_token !== 'string') {
            return NextResponse.json({
                success: false,
                error: 'Valid apify_api_token is required',
            }, { status: 400 });
        }

        const cleanToken = apify_api_token.trim();
        const payload: SocialAuthDoc = {
            apify_api_token: cleanToken,
            status: 'active',
            updated_at: new Date().toISOString(),
            updated_by: 'studio_admin',
        };

        const updated = await firestoreRestClient.updateDocument('auth_tokens', 'socials', payload as Record<string, unknown>);
        if (!updated) {
            await firestoreRestClient.createDocument('auth_tokens', 'socials', payload as Record<string, unknown>);
        }

        return NextResponse.json({
            success: true,
            message: 'Apify API token updated in auth_tokens/socials',
            maskedToken: `${cleanToken.slice(0, 8)}...${cleanToken.slice(-4)}`,
        });
    } catch (err: unknown) {
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to update auth settings',
        }, { status: 500 });
    }
}
