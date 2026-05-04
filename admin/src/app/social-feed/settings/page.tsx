'use client';

import { useState, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, Settings, Plus, Trash2, Loader2, Search, ExternalLink, Check, X, GripVertical } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { YouTubeIcon } from '@/components/BrandIcons';
import { cn } from '@/lib/utils';
import type { SourceCategory } from '@/lib/firestore-social';

// ─── Types ──────────────────────────────────────────────

interface Source {
    id: string;
    platform: string;
    display_name: string;
    handle: string;
    category: SourceCategory;
    verified: boolean;
    avatar_url: string;
    url: string;
    active: boolean;
    notes: string;
    subscriber_count: number;
    frequency: string;
    added_at: string;
    last_fetched_at: string;
    sort_order: number;
}

interface LookupResult {
    channel_id: string;
    display_name: string;
    handle: string;
    avatar_url: string;
    subscriber_count: number;
    video_count: number;
}

// ─── Constants ──────────────────────────────────────────

const COLUMNS: { value: SourceCategory; label: string; bg: string }[] = [
    { value: 'distributor', label: 'Distributors & Studios', bg: 'bg-purple-500/[0.04]' },
    { value: 'streaming', label: 'Streaming', bg: 'bg-blue-500/[0.04]' },
    { value: 'cinema_chain', label: 'Cinema Chains', bg: 'bg-orange-500/[0.04]' },
    { value: 'critic', label: 'Critics & Reviewers', bg: 'bg-emerald-500/[0.04]' },
    { value: 'community', label: 'Community & Fandom', bg: 'bg-pink-500/[0.04]' },
    { value: 'news', label: 'News & Trade', bg: 'bg-cyan-500/[0.04]' },
];

const COLUMN_MAP = Object.fromEntries(COLUMNS.map(c => [c.value, c]));

function formatSubscribers(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
}

// ─── Source Card (draggable) ────────────────────────────

function SourceCard({
    source,
    savingId,
    deletingId,
    editId,
    editNotes,
    onToggleActive,
    onDelete,
    onEditNotes,
    onSaveNotes,
    setEditId,
    setEditNotes,
}: {
    source: Source;
    savingId: string | null;
    deletingId: string | null;
    editId: string | null;
    editNotes: string;
    onToggleActive: (s: Source) => void;
    onDelete: (s: Source) => void;
    onEditNotes: (s: Source) => void;
    onSaveNotes: (id: string) => void;
    setEditId: (id: string | null) => void;
    setEditNotes: (v: string) => void;
}) {
    const isSaving = savingId === source.id;

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', source.id);
        e.dataTransfer.effectAllowed = 'move';
        const el = e.currentTarget as HTMLElement;
        requestAnimationFrame(() => {
            if (el) el.style.opacity = '0.4';
        });
    };

    const handleDragEnd = (e: React.DragEvent) => {
        const el = e.currentTarget as HTMLElement;
        if (el) el.style.opacity = '1';
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={cn(
                'group relative bg-card border border-border/60 rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all hover:border-border hover:shadow-sm',
                !source.active && 'opacity-40',
                isSaving && 'pointer-events-none',
            )}
        >
            {/* Drag handle + header */}
            <div className="flex items-start gap-2">
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground/20 mt-1 flex-shrink-0 group-hover:text-muted-foreground/50 transition-colors" />

                {/* Avatar */}
                {source.avatar_url ? (
                    <Image src={source.avatar_url} alt="" width={36} height={36} className="rounded-lg flex-shrink-0" unoptimized />
                ) : (
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-muted-foreground">{source.display_name[0]}</span>
                    </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">{source.display_name}</span>
                        <YouTubeIcon className="w-3 h-3 text-red-500 flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="font-mono truncate">{source.handle}</span>
                        {source.subscriber_count > 0 && (
                            <>
                                <span className="text-muted-foreground/20">·</span>
                                <span className="font-mono">{formatSubscribers(source.subscriber_count)}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Actions (show on hover) */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {source.url && (
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-muted-foreground/30 hover:text-foreground hover:bg-muted/50">
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                    <button
                        onClick={() => onToggleActive(source)}
                        className={cn(
                            'p-1 rounded transition-colors',
                            source.active ? 'text-green-500 hover:bg-green-500/10' : 'text-muted-foreground/30 hover:text-foreground hover:bg-muted/50',
                        )}
                        title={source.active ? 'Deactivate' : 'Activate'}
                    >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-[10px] font-bold">{source.active ? 'ON' : 'OFF'}</span>}
                    </button>
                    <button
                        onClick={() => onDelete(source)}
                        className="p-1 rounded text-muted-foreground/20 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                    >
                        {deletingId === source.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                </div>
            </div>

            {/* Notes */}
            {editId === source.id ? (
                <div className="flex items-center gap-1 mt-2 ml-5">
                    <Input
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        placeholder="Notes..."
                        className="h-6 text-[11px]"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') onSaveNotes(source.id); if (e.key === 'Escape') setEditId(null); }}
                    />
                    <button onClick={() => onSaveNotes(source.id)} className="p-0.5 text-green-600 hover:bg-green-500/10 rounded"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditId(null)} className="p-0.5 text-muted-foreground hover:bg-muted rounded"><X className="w-3 h-3" /></button>
                </div>
            ) : source.notes ? (
                <p
                    className="text-[10px] text-muted-foreground/40 mt-1 ml-5 truncate cursor-pointer hover:text-muted-foreground/70"
                    onClick={() => onEditNotes(source)}
                >
                    {source.notes}
                </p>
            ) : null}
        </div>
    );
}

// ─── Kanban Column (drop target) ────────────────────────

function KanbanColumn({
    column,
    sources,
    dropTarget,
    dropInsertIndex,
    onDragOver,
    onDragLeave,
    onDrop,
    onCardDragOver,
    onCardDragLeave,
    renderCard,
}: {
    column: typeof COLUMNS[number];
    sources: Source[];
    dropTarget: string | null;
    dropInsertIndex: number | null;
    onDragOver: (e: React.DragEvent, category: SourceCategory) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent, category: SourceCategory) => void;
    onCardDragOver: (e: React.DragEvent, category: SourceCategory, index: number) => void;
    onCardDragLeave: () => void;
    renderCard: (source: Source, showInsertAbove: boolean) => React.ReactNode;
}) {
    const activeInCol = sources.filter(s => s.active).length;
    const inactiveInCol = sources.length - activeInCol;
    const isTarget = dropTarget === column.value;

    return (
        <div
            className={cn(
                'flex flex-col rounded-xl min-w-[260px] transition-colors border border-border/30',
                column.bg,
                isTarget && 'ring-2 ring-primary/30 bg-primary/[0.06]',
            )}
            onDragOver={e => onDragOver(e, column.value)}
            onDragLeave={onDragLeave}
            onDrop={e => onDrop(e, column.value)}
        >
            {/* Column header */}
            <div className="px-3 pt-3 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/80">{column.label}</h3>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {sources.length} source{sources.length !== 1 ? 's' : ''}
                    {inactiveInCol > 0 && <span className="text-muted-foreground/30"> · {inactiveInCol} inactive</span>}
                </p>
            </div>

            {/* Cards */}
            <div className="flex-1 px-2 pb-2 overflow-y-auto min-h-[120px]">
                {sources.length === 0 && (
                    <div className="flex items-center justify-center h-[120px] border border-dashed border-border/30 rounded-lg">
                        <p className="text-[10px] text-muted-foreground/30">Drop sources here</p>
                    </div>
                )}
                {sources.map((source, i) => {
                    const showInsertAbove = isTarget && dropInsertIndex === i;
                    return (
                        <div
                            key={source.id}
                            onDragOver={e => onCardDragOver(e, column.value, i)}
                            onDragLeave={onCardDragLeave}
                        >
                            {showInsertAbove && (
                                <div className="h-0.5 bg-primary rounded-full my-1 mx-1" />
                            )}
                            {renderCard(source, false)}
                        </div>
                    );
                })}
                {/* Insert at end */}
                {isTarget && dropInsertIndex === sources.length && sources.length > 0 && (
                    <div className="h-0.5 bg-primary rounded-full my-1 mx-1" />
                )}
            </div>
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────

export default function SourceSettingsPage() {
    const { data: session } = useSession();
    const isAdmin = (session as unknown as { user?: { role?: string } })?.user?.role === 'admin';

    const { data, isLoading, mutate } = useSWR<{ success: boolean; data: { sources: Source[] } }>(
        '/api/social-feed/sources',
        fetcher,
    );

    const sources = data?.success ? data.data.sources : [];

    // ── State ──
    const [savingId, setSavingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editNotes, setEditNotes] = useState('');

    // Drag state
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null);
    const dragCounterRef = useRef(0);

    // Add source state
    const [lookupId, setLookupId] = useState('');
    const [looking, setLooking] = useState(false);
    const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
    const [lookupError, setLookupError] = useState('');
    const [newCategory, setNewCategory] = useState<SourceCategory>('critic');
    const [creating, setCreating] = useState(false);

    // ── Handlers ──

    const toggleActive = useCallback(async (source: Source) => {
        setSavingId(source.id);
        try {
            const res = await fetch('/api/social-feed/sources', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: source.id, active: !source.active }),
            });
            if (res.ok) mutate();
        } finally {
            setSavingId(null);
        }
    }, [mutate]);

    const updateCategory = useCallback(async (sourceId: string, category: SourceCategory) => {
        setSavingId(sourceId);
        try {
            const res = await fetch('/api/social-feed/sources', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: sourceId, category }),
            });
            if (res.ok) mutate();
        } finally {
            setSavingId(null);
        }
    }, [mutate]);

    const saveNotes = useCallback(async (sourceId: string) => {
        setSavingId(sourceId);
        try {
            const res = await fetch('/api/social-feed/sources', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: sourceId, notes: editNotes }),
            });
            if (res.ok) {
                mutate();
                setEditId(null);
            }
        } finally {
            setSavingId(null);
        }
    }, [mutate, editNotes]);

    const deleteSource = useCallback(async (source: Source) => {
        if (!confirm(`Delete "${source.display_name}"? This removes it from the source list. Existing posts are NOT affected.`)) return;
        setDeletingId(source.id);
        try {
            const res = await fetch(`/api/social-feed/sources/${encodeURIComponent(source.id)}`, { method: 'DELETE' });
            if (res.ok) mutate();
        } finally {
            setDeletingId(null);
        }
    }, [mutate]);

    const lookupChannel = useCallback(async () => {
        if (!lookupId.trim()) return;
        setLooking(true);
        setLookupError('');
        setLookupResult(null);
        try {
            const res = await fetch(`/api/social-feed/sources/lookup?q=${encodeURIComponent(lookupId.trim())}`);
            const data = await res.json();
            if (data.success) {
                setLookupResult(data.data);
            } else {
                setLookupError(data.error || 'Lookup failed');
            }
        } catch {
            setLookupError('Network error');
        } finally {
            setLooking(false);
        }
    }, [lookupId]);

    const createSource = useCallback(async () => {
        if (!lookupResult) return;
        setCreating(true);
        try {
            const res = await fetch('/api/social-feed/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: 'youtube',
                    platform_id: lookupResult.channel_id,
                    display_name: lookupResult.display_name,
                    handle: lookupResult.handle,
                    category: newCategory,
                    avatar_url: lookupResult.avatar_url,
                    url: `https://youtube.com/${lookupResult.handle}`,
                    subscriber_count: lookupResult.subscriber_count,
                }),
            });
            const data = await res.json();
            if (data.success) {
                mutate();
                setAddDialogOpen(false);
                setLookupId('');
                setLookupResult(null);
            } else {
                alert(data.error || 'Failed to create source');
            }
        } finally {
            setCreating(false);
        }
    }, [lookupResult, newCategory, mutate]);

    // ── Drag & Drop ──

    const handleDragOver = useCallback((e: React.DragEvent, category: SourceCategory) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTarget(category);
    }, []);

    const handleDragLeave = useCallback(() => {
        // Use counter to handle child element flickering
        dragCounterRef.current--;
        if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setDropTarget(null);
        }
    }, []);

    const handleDragEnter = useCallback(() => {
        dragCounterRef.current++;
    }, []);

    const handleCardDragOver = useCallback((e: React.DragEvent, category: SourceCategory, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget(category);
        setDropInsertIndex(index);
    }, []);

    const handleCardDragLeave = useCallback(() => {
        setDropInsertIndex(null);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent, newCategory: SourceCategory) => {
        e.preventDefault();
        dragCounterRef.current = 0;
        setDropTarget(null);
        setDropInsertIndex(null);

        const sourceId = e.dataTransfer.getData('text/plain');
        if (!sourceId) return;

        const source = sources.find(s => s.id === sourceId);
        if (!source) return;

        const sameCategory = source.category === newCategory;

        // Build the current target column list (sorted by sort_order) from sources directly
        const colSources = sources
            .filter(s => s.category === newCategory)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        const insertIdx = dropInsertIndex ?? colSources.length;

        // Build the new order for the target column
        let targetList = colSources.filter(s => s.id !== sourceId);
        if (sameCategory) {
            // Reorder within same column
            targetList.splice(insertIdx, 0, source);
        } else {
            // Move to different column
            targetList.splice(Math.min(insertIdx, targetList.length), 0, source);
        }

        // Batch update sort_order for all cards in the column
        const updates = targetList.map((s, i) => ({ id: s.id, sort_order: i }));

        // Update category + sort_order for the moved source, and sort_order for the rest
        await Promise.all([
            // Update category if changed
            ...(!sameCategory ? [updateCategory(sourceId, newCategory)] : []),
            // Update sort_order for all cards in column
            ...updates.map(u =>
                fetch('/api/social-feed/sources', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: u.id, sort_order: u.sort_order }),
                })
            ),
        ]);

        mutate();
    }, [sources, dropInsertIndex, updateCategory, mutate]);

    // ── Filter & group ──
    const filtered = sources.filter(s =>
        !searchQuery ||
        s.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const grouped = Object.fromEntries(
        COLUMNS.map(c => [c.value, filtered.filter(s => s.category === c.value).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))])
    ) as Record<SourceCategory, Source[]>;

    const activeCount = sources.filter(s => s.active).length;

    // ── Card renderer ──
    const renderCard = useCallback((source: Source, _showInsertAbove: boolean) => (
        <SourceCard
            key={source.id}
            source={source}
            savingId={savingId}
            deletingId={deletingId}
            editId={editId}
            editNotes={editNotes}
            onToggleActive={toggleActive}
            onDelete={deleteSource}
            onEditNotes={(s) => { setEditId(s.id); setEditNotes(s.notes); }}
            onSaveNotes={saveNotes}
            setEditId={setEditId}
            setEditNotes={setEditNotes}
        />
    ), [savingId, deletingId, editId, editNotes, toggleActive, deleteSource, saveNotes]);

    // ── Admin Gate ──
    if (!isAdmin) {
        return (
            <div className="p-6">
                <PageHeader title="Source Settings" description="Manage social feed sources" icon={<Settings className="w-6 h-6 text-muted-foreground" />} />
                <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed rounded-xl bg-muted/5">
                    <ShieldAlert className="w-12 h-12 text-muted-foreground/20" />
                    <p className="text-muted-foreground font-medium">Admin access required</p>
                    <p className="text-xs text-muted-foreground/60">Only administrators can manage sources.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Fixed header */}
            <div className="flex-shrink-0 px-6 pt-6 pb-4 space-y-4">
                <PageHeader title="Source Settings" description={`${sources.length} sources · ${activeCount} active`} icon={<Settings className="w-6 h-6 text-muted-foreground" />}>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search sources..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 pr-3 py-2 text-sm bg-muted/30 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 w-64"
                        />
                    </div>
                    <Button onClick={() => setAddDialogOpen(true)} size="sm" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Source
                    </Button>
                </PageHeader>
            </div>

            {/* Kanban board — takes remaining height */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/30" />
                </div>
            ) : (
                <div className="flex-1 px-6 pb-6 overflow-x-auto">
                    <div className="grid grid-cols-6 gap-3 h-full min-w-[1560px]">
                        {COLUMNS.map(column => (
                            <KanbanColumn
                                key={column.value}
                                column={column}
                                sources={grouped[column.value]}
                                dropTarget={dropTarget}
                                dropInsertIndex={dropInsertIndex}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onCardDragOver={handleCardDragOver}
                                onCardDragLeave={handleCardDragLeave}
                                renderCard={renderCard}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Add Source Dialog ── */}
            {addDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setAddDialogOpen(false)}>
                    <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">Add YouTube Source</h2>
                            <button onClick={() => setAddDialogOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
                        </div>

                        {/* Step 1: Lookup */}
                        <div className="space-y-3">
                            <label className="text-xs font-medium text-muted-foreground">YouTube Channel</label>
                            <div className="flex gap-2">
                                <Input
                                    value={lookupId}
                                    onChange={e => { setLookupId(e.target.value); setLookupResult(null); setLookupError(''); }}
                                    placeholder="Channel ID, @handle, or youtube.com URL"
                                    className="font-mono text-sm"
                                    onKeyDown={e => { if (e.key === 'Enter') lookupChannel(); }}
                                />
                                <Button onClick={lookupChannel} disabled={looking || !lookupId.trim()} size="sm" className="gap-2 flex-shrink-0">
                                    {looking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    Look Up
                                </Button>
                            </div>
                            {lookupError && <p className="text-xs text-red-500">{lookupError}</p>}
                        </div>

                        {/* Step 2: Preview + confirm */}
                        {lookupResult && (
                            <>
                                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50">
                                    {lookupResult.avatar_url ? (
                                        <Image src={lookupResult.avatar_url} alt="" width={48} height={48} className="rounded-lg" unoptimized />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center"><span className="font-bold">{lookupResult.display_name[0]}</span></div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{lookupResult.display_name}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{lookupResult.handle}</p>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                                            <span>{formatSubscribers(lookupResult.subscriber_count)} subs</span>
                                            <span>{lookupResult.video_count} videos</span>
                                        </div>
                                    </div>
                                    <YouTubeIcon className="w-5 h-5 text-red-500" />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                                    <select
                                        value={newCategory}
                                        onChange={e => setNewCategory(e.target.value as SourceCategory)}
                                        className="w-full text-sm border border-border/50 rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        {COLUMNS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                                    <Button size="sm" onClick={createSource} disabled={creating} className="gap-2">
                                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        Add Source
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
