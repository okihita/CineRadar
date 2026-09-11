import { redirect } from 'next/navigation';
import { getTodayJakarta } from '@/lib/timeUtils';

export const dynamic = 'force-dynamic';

/**
 * TikTok Explorer Route - Date-Based URL Redirect
 *
 * Redirects /tiktok/explorer -> /tiktok/explorer/{today}
 * For date-specific views, access /tiktok/explorer/YYYY-MM-DD directly
 */
export default function TikTokExplorerRedirect() {
    const today = getTodayJakarta();
    redirect(`/tiktok/explorer/${today}`);
}
