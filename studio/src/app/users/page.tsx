'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users as UsersIcon, CheckCircle2, XCircle, ShieldCheck, ShieldAlert, UserCog, Clock, Ban, Pause } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

interface AdminUser {
    id: string;
    email?: string;
    name?: string;
    role?: string;
    status?: string;
    registered_at?: number;
    approved_at?: number;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }> = {
    pending: { label: 'Pending', icon: Clock, badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    approved: { label: 'Approved', icon: CheckCircle2, badgeClass: 'bg-green-500/10 text-green-600 border-green-500/20' },
    rejected: { label: 'Rejected', icon: XCircle, badgeClass: 'bg-red-500/10 text-red-600 border-red-500/20' },
    suspended: { label: 'Suspended', icon: Pause, badgeClass: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
};

function formatDate(ts: number | undefined) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function UsersPage() {
    const { data: session } = useSession();
    const isAdmin = (session as unknown as { user?: { role?: string } })?.user?.role === 'admin';

    const { data, isLoading, mutate } = useSWR<{ success: boolean; data: AdminUser[] }>(
        isAdmin ? '/api/users' : null,
        fetcher
    );
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const users = data?.success ? data.data : [];

    const pendingUsers = users.filter(u => u.status === 'pending');
    const activeUsers = users.filter(u => u.status === 'approved');
    const otherUsers = users.filter(u => u.status !== 'pending' && u.status !== 'approved');

    async function handleAction(email: string, action: string, role?: string) {
        setActionLoading(email + action);
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, action, role }),
            });
            const result = await res.json();
            if (result.success) {
                mutate();
                const actionLabels: Record<string, string> = {
                    approve: 'approved',
                    reject: 'rejected',
                    suspend: 'suspended',
                    unsuspend: 'reactivated',
                    update_role: `promoted to ${role ?? 'admin'}`,
                };
                toast.success(`User ${actionLabels[action] ?? action}`, { description: email });
            } else {
                toast.error(result.error || 'Action failed');
            }
        } catch {
            toast.error('Network error');
        } finally {
            setActionLoading(null);
        }
    }

    if (!isAdmin) {
        return (
            <div className="p-6">
                <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed rounded-xl bg-muted/5">
                    <ShieldAlert className="w-12 h-12 text-muted-foreground/20" />
                    <p className="text-muted-foreground font-medium">Admin access required</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
            <PageHeader
                title="User Management"
                description="Review registrations, manage roles, and control access."
                icon={<UsersIcon className="w-6 h-6 text-primary" />}
            />

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/10 rounded-lg">
                                <Clock className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-black">{pendingUsers.length}</p>
                                <p className="text-xs text-muted-foreground font-medium">Pending Approval</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-black">{activeUsers.length}</p>
                                <p className="text-xs text-muted-foreground font-medium">Active Users</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted/30 rounded-lg">
                                <UsersIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-2xl font-black">{users.length}</p>
                                <p className="text-xs text-muted-foreground font-medium">Total Registered</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading users...</p>
                </div>
            ) : (
                <>
                    {/* Pending Users */}
                    {pendingUsers.length > 0 && (
                        <Card className="border-amber-500/20">
                            <CardHeader className="pb-3 border-b border-amber-500/10 bg-amber-500/5">
                                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    Awaiting Approval ({pendingUsers.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                            <th className="p-4 text-left">User</th>
                                            <th className="p-4 text-left">Registered</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingUsers.map(user => (
                                            <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                <td className="p-4">
                                                    <p className="font-medium">{user.name || 'Unknown'}</p>
                                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                                </td>
                                                <td className="p-4 text-muted-foreground text-xs">{formatDate(user.registered_at)}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 text-xs gap-1.5 border-green-500/20 text-green-600 hover:bg-green-500/10"
                                                            disabled={actionLoading === user.id + 'approve'}
                                                            onClick={() => handleAction(user.email!, 'approve')}
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 text-xs gap-1.5 border-red-500/20 text-red-600 hover:bg-red-500/10"
                                                            disabled={actionLoading === user.id + 'reject'}
                                                            onClick={() => handleAction(user.email!, 'reject')}
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" />
                                                            Reject
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}

                    {/* Active Users */}
                    <Card>
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-green-500" />
                                Active Users ({activeUsers.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                        <th className="p-4 text-left">User</th>
                                        <th className="p-4 text-left">Role</th>
                                        <th className="p-4 text-left">Registered</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeUsers.map(user => {
                                        const sc = STATUS_CONFIG[user.status || 'approved'] || STATUS_CONFIG.approved;
                                        const isCurrentUser = user.email === (session as unknown as { user?: { email?: string } })?.user?.email;
                                        return (
                                            <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                <td className="p-4">
                                                    <p className="font-medium">
                                                        {user.name || 'Unknown'}
                                                        {isCurrentUser && <span className="ml-2 text-[10px] text-primary font-normal">(you)</span>}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                                </td>
                                                <td className="p-4">
                                                    <Badge variant="outline" className={user.role === 'admin' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted/50'}>
                                                        {user.role === 'admin' ? <ShieldCheck className="w-3 h-3 mr-1" /> : <UserCog className="w-3 h-3 mr-1" />}
                                                        {user.role || 'viewer'}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 text-muted-foreground text-xs">{formatDate(user.registered_at)}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {!isCurrentUser && (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 text-xs"
                                                                    disabled={actionLoading === user.id + 'update_role'}
                                                                    onClick={() => handleAction(user.email!, 'update_role', user.role === 'admin' ? 'viewer' : 'admin')}
                                                                >
                                                                    {user.role === 'admin' ? 'Demote' : 'Promote'}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-500/10"
                                                                    disabled={actionLoading === user.id + 'suspend'}
                                                                    onClick={() => handleAction(user.email!, 'suspend')}
                                                                >
                                                                    <Ban className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {activeUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-muted-foreground text-sm">No active users</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>

                    {/* Rejected / Suspended Users */}
                    {otherUsers.length > 0 && (
                        <Card className="border-border/50 opacity-80">
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground">
                                    <ShieldAlert className="w-4 h-4" />
                                    Other ({otherUsers.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                            <th className="p-4 text-left">User</th>
                                            <th className="p-4 text-left">Status</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {otherUsers.map(user => {
                                            const sc = STATUS_CONFIG[user.status || 'rejected'] || STATUS_CONFIG.rejected;
                                            const StatusIcon = sc.icon;
                                            return (
                                                <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                    <td className="p-4">
                                                        <p className="font-medium">{user.name || 'Unknown'}</p>
                                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                                    </td>
                                                    <td className="p-4">
                                                        <Badge variant="outline" className={sc.badgeClass}>
                                                            <StatusIcon className="w-3 h-3 mr-1" />
                                                            {sc.label}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 text-xs text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                                                disabled={actionLoading === user.id + 'approve'}
                                                                onClick={() => handleAction(user.email!, 'approve')}
                                                            >
                                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                                                Re-approve
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
