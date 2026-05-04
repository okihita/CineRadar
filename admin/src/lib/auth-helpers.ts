import { auth } from '@/auth';

/** Check if the authenticated session belongs to an admin user */
export function isAdmin(session: unknown): boolean {
    return (session as { user?: { role?: string } })?.user?.role === 'admin';
}

/** Require admin session, returns error response if not authorized */
export async function requireAdmin(): Promise<Response | null> {
    const session = await auth();
    if (!session) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    if (!isAdmin(session)) return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    return null;
}

/** Extract the hour of day (0-23) in Jakarta timezone from an ISO timestamp */
export function getJakartaHour(isoTimestamp: string): number {
    const hour = new Date(isoTimestamp).toLocaleString('en-US', {
        timeZone: 'Asia/Jakarta',
        hour: 'numeric',
        hour12: false,
    });
    return parseInt(hour, 10) % 24;
}
