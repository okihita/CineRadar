/**
 * User Management API
 *
 * GET  /api/users       — list all users (optionally filter by status)
 * POST /api/users       — approve, reject, or update a user's role
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { firestoreRestClient } from '@/lib/firestore-rest';

interface AdminUserDoc {
    id: string;
    email?: string;
    name?: string;
    role?: string;
    status?: string;
    registered_at?: number;
}

export const revalidate = 0;

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can list users
    if ((session as unknown as { user?: { role?: string } }).user?.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    try {
        const users = await firestoreRestClient.getCollection<AdminUserDoc>('admin_users');

        // Sort: pending first, then by registered_at descending
        const statusOrder: Record<string, number> = { pending: 0, approved: 1, rejected: 2, suspended: 3 };
        users.sort((a, b) => {
            const sa = statusOrder[a.status || 'approved'] ?? 9;
            const sb = statusOrder[b.status || 'approved'] ?? 9;
            if (sa !== sb) return sa - sb;
            return (b.registered_at || 0) - (a.registered_at || 0);
        });

        return NextResponse.json({ success: true, data: users });
    } catch (error) {
        console.error('Error listing users:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can manage users
    if ((session as unknown as { user?: { role?: string } }).user?.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { email, action, role } = body as { email: string; action: string; role?: string };

        if (!email || !action) {
            return NextResponse.json({ success: false, error: 'Missing email or action' }, { status: 400 });
        }

        const validActions = ['approve', 'reject', 'suspend', 'update_role'];
        if (!validActions.includes(action)) {
            return NextResponse.json({ success: false, error: `Invalid action. Use: ${validActions.join(', ')}` }, { status: 400 });
        }

        const updates: Record<string, unknown> = {};

        switch (action) {
            case 'approve':
                updates.status = 'approved';
                updates.approved_at = Date.now();
                break;
            case 'reject':
                updates.status = 'rejected';
                updates.rejected_at = Date.now();
                break;
            case 'suspend':
                updates.status = 'suspended';
                updates.suspended_at = Date.now();
                break;
            case 'update_role':
                if (!role || !['admin', 'viewer'].includes(role)) {
                    return NextResponse.json({ success: false, error: 'Invalid role. Use: admin, viewer' }, { status: 400 });
                }
                updates.role = role;
                break;
        }

        const success = await firestoreRestClient.updateDocument('admin_users', email, updates);

        if (!success) {
            return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: { email, action, updates } });
    } catch (error) {
        console.error('Error managing user:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
