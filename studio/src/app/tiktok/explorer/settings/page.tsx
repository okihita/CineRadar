'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ArrowLeft,
    ShieldCheck,
    Building2,
    Plus,
    Trash2,
    CheckCircle2,
    XCircle,
    Hash,
    Save
} from 'lucide-react';
import { fetcher } from '@/lib/api';
import { toast } from 'sonner';

interface TruthSource {
    id: string;
    handle: string;
    name: string;
    category: 'exhibitor' | 'studio' | 'tracker';
    active: boolean;
    verified: boolean;
    priority: 'high' | 'medium' | 'low';
    notes: string;
}

interface SourcesApiResponse {
    success: boolean;
    sources: TruthSource[];
    overrides: Record<string, string[]>;
}

export default function TikTokDiscoverySettingsPage() {
    const { data, mutate, isLoading } = useSWR<SourcesApiResponse>(
        '/api/socials/tiktok/sources',
        fetcher
    );

    const [filterCategory, setFilterCategory] = useState<'all' | 'exhibitor' | 'studio' | 'tracker'>('all');
    const [newHandle, setNewHandle] = useState('');
    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState<'exhibitor' | 'studio' | 'tracker'>('studio');
    const [newNotes, setNewNotes] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    // Manual Overrides State
    const [overrideMovie, setOverrideMovie] = useState('');
    const [overrideTags, setOverrideTags] = useState('');
    const [isSavingOverride, setIsSavingOverride] = useState(false);

    const sources = data?.sources || [];
    const overrides = data?.overrides || {};

    const filteredSources = filterCategory === 'all'
        ? sources
        : sources.filter((s) => s.category === filterCategory);

    const activeCount = sources.filter((s) => s.active).length;

    // Toggle active status
    const handleToggle = async (source: TruthSource) => {
        try {
            const res = await fetch('/api/socials/tiktok/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle_source', source: { id: source.id } }),
            });
            const result = await res.json();
            if (result.success) {
                toast.success(`@${source.handle} is now ${source.active ? 'disabled' : 'active'}`);
                mutate();
            } else {
                toast.error(result.error || 'Failed to update source');
            }
        } catch {
            toast.error('Network error updating source');
        }
    };

    // Delete source
    const handleDelete = async (source: TruthSource) => {
        if (!confirm(`Delete @${source.handle} from truth seed accounts?`)) return;
        try {
            const res = await fetch('/api/socials/tiktok/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_source', source: { id: source.id } }),
            });
            const result = await res.json();
            if (result.success) {
                toast.success(`Deleted @${source.handle}`);
                mutate();
            } else {
                toast.error(result.error || 'Failed to delete source');
            }
        } catch {
            toast.error('Network error deleting source');
        }
    };

    // Add source
    const handleAddSource = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newHandle.trim()) {
            toast.error('Please specify a TikTok @handle');
            return;
        }

        setIsAdding(true);
        try {
            const res = await fetch('/api/socials/tiktok/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add_source',
                    source: {
                        handle: newHandle,
                        name: newName || newHandle,
                        category: newCategory,
                        notes: newNotes,
                        verified: true,
                        priority: 'high',
                    },
                }),
            });
            const result = await res.json();
            if (result.success) {
                toast.success(`Added @${newHandle.replace(/^@/, '')} to truth sources`);
                setNewHandle('');
                setNewName('');
                setNewNotes('');
                mutate();
            } else {
                toast.error(result.error || 'Failed to add source');
            }
        } catch {
            toast.error('Network error adding source');
        } finally {
            setIsAdding(false);
        }
    };

    // Save override
    const handleSaveOverride = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!overrideMovie.trim()) {
            toast.error('Please specify the exact Movie Title');
            return;
        }

        setIsSavingOverride(true);
        const tags = overrideTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

        try {
            const res = await fetch('/api/socials/tiktok/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'set_override',
                    override: {
                        movieTitle: overrideMovie,
                        hashtags: tags,
                    },
                }),
            });
            const result = await res.json();
            if (result.success) {
                toast.success(`Updated hashtags for "${overrideMovie.toUpperCase()}"`);
                setOverrideMovie('');
                setOverrideTags('');
                mutate();
            } else {
                toast.error(result.error || 'Failed to save override');
            }
        } catch {
            toast.error('Network error saving override');
        } finally {
            setIsSavingOverride(false);
        }
    };

    // Delete override
    const handleDeleteOverride = async (movieTitle: string) => {
        try {
            const res = await fetch('/api/socials/tiktok/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'set_override',
                    override: {
                        movieTitle,
                        hashtags: [],
                    },
                }),
            });
            const result = await res.json();
            if (result.success) {
                toast.success(`Removed override for "${movieTitle}"`);
                mutate();
            }
        } catch {
            toast.error('Network error removing override');
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Header with Back Navigation */}
            <div className="flex items-center justify-between gap-4">
                <Link
                    href="/tiktok/explorer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to TikTok Radar
                </Link>
            </div>

            <PageHeader
                title="Hashtag Discovery Settings"
                description="Manage authoritative truth seed accounts and manual hashtag overrides for morning 08:00 WIB theatrical discovery."
                icon={<ShieldCheck className="w-6 h-6 text-primary" />}
            />

            {/* Top Stat Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <Card className="bg-card border-border/60 p-4 space-y-1">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        Active Truth Accounts
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    </span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black font-mono text-foreground">
                            {activeCount}
                        </span>
                        <span className="text-sm text-muted-foreground">
                            of {sources.length} configured
                        </span>
                    </div>
                </Card>

                <Card className="bg-card border-border/60 p-4 space-y-1">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        Discovery Coverage
                        <Building2 className="w-4 h-4 text-indigo-500" />
                    </span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black font-mono text-foreground">
                            3 Exhibitors · 7 Studios
                        </span>
                    </div>
                </Card>

                <Card className="bg-card border-border/60 p-4 space-y-1">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        Manual Overrides
                        <Hash className="w-4 h-4 text-amber-500" />
                    </span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black font-mono text-foreground">
                            {Object.keys(overrides).length}
                        </span>
                        <span className="text-sm text-muted-foreground">
                            custom title mappings
                        </span>
                    </div>
                </Card>
            </div>

            {/* Main Tabs */}
            <Tabs defaultValue="sources" className="space-y-4">
                <TabsList className="bg-muted/40 p-0.5 rounded-lg border border-border/40">
                    <TabsTrigger value="sources" className="gap-2 text-sm font-semibold px-3.5 py-1.5 rounded-md">
                        <Building2 className="w-4 h-4" />
                        Truth Seed Accounts ({sources.length})
                    </TabsTrigger>
                    <TabsTrigger value="overrides" className="gap-2 text-sm font-semibold px-3.5 py-1.5 rounded-md">
                        <Hash className="w-4 h-4" />
                        Custom Hashtag Overrides ({Object.keys(overrides).length})
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: TRUTH SEED ACCOUNTS */}
                <TabsContent value="sources" className="space-y-4">
                    {/* Add New Source Card */}
                    <Card className="border-border/60 bg-card p-4 sm:p-5">
                        <CardHeader className="p-0 pb-3">
                            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Plus className="w-4 h-4 text-primary" />
                                Add New Truth Seed Account
                            </CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">
                                CineRadar will inspect recent posts from this TikTok account every morning at 08:00 WIB to discover campaign tags.
                            </CardDescription>
                        </CardHeader>
                        <form onSubmit={handleAddSource} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                            <div>
                                <label className="block text-sm font-semibold text-muted-foreground mb-1">
                                    TikTok @Handle
                                </label>
                                <Input
                                    placeholder="e.g. cinema.21"
                                    value={newHandle}
                                    onChange={(e) => setNewHandle(e.target.value)}
                                    className="bg-muted/20 text-sm h-9"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-muted-foreground mb-1">
                                    Display Name
                                </label>
                                <Input
                                    placeholder="e.g. Cinema XXI"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="bg-muted/20 text-sm h-9"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-muted-foreground mb-1">
                                    Category
                                </label>
                                <select
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value as 'exhibitor' | 'studio' | 'tracker')}
                                    className="w-full bg-muted/20 border border-input rounded-md px-3 text-sm h-9 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="exhibitor">Exhibitor (Cinema Chain)</option>
                                    <option value="studio">Production House / Studio</option>
                                    <option value="tracker">Film Critic / Tracker</option>
                                </select>
                            </div>

                            <div className="flex items-end">
                                <Button
                                    type="submit"
                                    disabled={isAdding}
                                    className="w-full gap-2 text-sm font-semibold h-9 rounded-lg"
                                >
                                    <Plus className="w-4 h-4" />
                                    {isAdding ? 'Adding...' : 'Add Account'}
                                </Button>
                            </div>
                        </form>
                    </Card>

                    {/* Filter Pills */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                            {(['all', 'exhibitor', 'studio', 'tracker'] as const).map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setFilterCategory(cat)}
                                    className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors capitalize ${
                                        filterCategory === cat
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'bg-muted/40 hover:bg-muted text-muted-foreground border border-border/40'
                                    }`}
                                >
                                    {cat === 'all' ? `All Accounts (${sources.length})` : cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sources Table */}
                    <Card className="border-border/60 bg-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/40 text-muted-foreground text-sm font-bold uppercase tracking-wider border-b border-border/40">
                                    <tr>
                                        <th className="p-3 pl-4">Seed Account</th>
                                        <th className="p-3">Category</th>
                                        <th className="p-3">Priority</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Purpose / Notes</th>
                                        <th className="p-3 pr-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                                                Loading truth seed accounts...
                                            </td>
                                        </tr>
                                    ) : filteredSources.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                                                No accounts found in this category.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredSources.map((source) => (
                                            <tr key={source.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3 pl-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                                                            {source.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-foreground">
                                                                {source.name}
                                                            </div>
                                                            <div className="text-sm font-mono text-muted-foreground">
                                                                @{source.handle}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <Badge variant="outline" className="text-sm font-medium capitalize">
                                                        {source.category}
                                                    </Badge>
                                                </td>
                                                <td className="p-3">
                                                    <Badge
                                                        variant="secondary"
                                                        className={`text-sm font-medium uppercase ${
                                                            source.priority === 'high'
                                                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                                                : 'bg-muted text-muted-foreground'
                                                        }`}
                                                    >
                                                        {source.priority}
                                                    </Badge>
                                                </td>
                                                <td className="p-3">
                                                    <button
                                                        onClick={() => handleToggle(source)}
                                                        className="inline-flex items-center gap-1.5 text-sm font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                                                    >
                                                        {source.active ? (
                                                            <>
                                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                                <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <XCircle className="w-4 h-4 text-muted-foreground" />
                                                                <span className="text-muted-foreground">Disabled</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="p-3 text-muted-foreground text-sm max-w-xs truncate">
                                                    {source.notes || '—'}
                                                </td>
                                                <td className="p-3 pr-4 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(source)}
                                                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 h-8 px-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </TabsContent>

                {/* TAB 2: MANUAL HASHTAG OVERRIDES */}
                <TabsContent value="overrides" className="space-y-4">
                    {/* Add Override Form */}
                    <Card className="border-border/60 bg-card p-4 sm:p-5">
                        <CardHeader className="p-0 pb-3">
                            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Hash className="w-4 h-4 text-primary" />
                                Set Manual Movie Hashtags
                            </CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">
                                Override or supplement automated tag discovery for specific theatrical releases.
                            </CardDescription>
                        </CardHeader>
                        <form onSubmit={handleSaveOverride} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                            <div>
                                <label className="block text-sm font-semibold text-muted-foreground mb-1">
                                    Movie Title (Exact)
                                </label>
                                <Input
                                    placeholder="e.g. HARUSNYA HORROR"
                                    value={overrideMovie}
                                    onChange={(e) => setOverrideMovie(e.target.value)}
                                    className="bg-muted/20 text-sm h-9 uppercase"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-muted-foreground mb-1">
                                    Hashtags (Comma-Separated)
                                </label>
                                <Input
                                    placeholder="e.g. harusnyahorror, filmharusnyahorror"
                                    value={overrideTags}
                                    onChange={(e) => setOverrideTags(e.target.value)}
                                    className="bg-muted/20 text-sm h-9 font-mono"
                                />
                            </div>

                            <div className="flex items-end">
                                <Button
                                    type="submit"
                                    disabled={isSavingOverride}
                                    className="w-full gap-2 text-sm font-semibold h-9 rounded-lg"
                                >
                                    <Save className="w-4 h-4" />
                                    {isSavingOverride ? 'Saving...' : 'Save Override'}
                                </Button>
                            </div>
                        </form>
                    </Card>

                    {/* Overrides Table */}
                    <Card className="border-border/60 bg-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/40 text-muted-foreground text-sm font-bold uppercase tracking-wider border-b border-border/40">
                                    <tr>
                                        <th className="p-3 pl-4">Theatrical Movie Title</th>
                                        <th className="p-3">Configured Campaign Hashtags</th>
                                        <th className="p-3 pr-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {Object.keys(overrides).length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-sm text-muted-foreground">
                                                No manual overrides configured. All titles use automated 08:00 WIB seed discovery.
                                            </td>
                                        </tr>
                                    ) : (
                                        Object.entries(overrides).map(([title, tags]) => (
                                            <tr key={title} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3 pl-4 font-bold text-foreground">
                                                    {title}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {tags.map((tag) => (
                                                            <Badge
                                                                key={tag}
                                                                variant="outline"
                                                                className="font-mono text-sm font-medium bg-primary/5 text-primary border-primary/20"
                                                            >
                                                                #{tag}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-3 pr-4 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteOverride(title)}
                                                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 h-8 px-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
