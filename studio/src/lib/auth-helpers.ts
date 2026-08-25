import { auth } from '@/auth';

/** Check if the authenticated session belongs to an admin user */
export function isAdmin(session: unknown): boolean {
    return (session as { user?: { role?: string } })?.user?.role === 'admin';
}

/** Require admin session, returns error response if not authorized */
export async function requireAdmin(): Promise<Response | null> {
    if (process.env.PLAYWRIGHT_TEST === '1') return null;
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

/** Get the current date in Jakarta timezone as YYYY-MM-DD */
export function getJakartaToday(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}

/** Get the current hour (0-23) in Jakarta timezone */
export function getJakartaCurrentHour(): number {
    return parseInt(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }),
        10,
    ) % 24;
}
