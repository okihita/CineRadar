'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Handle,
    Position,
    type Node,
    type Edge,
    type NodeProps,
    MarkerType,
    useNodesState,
    useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
    Clock, Film, Bot, Database, Sparkles, LayoutDashboard,
    ArrowRight, CheckCircle2, ChevronRight,
    DollarSign, Zap, FileJson, Play,
    Activity, Layers,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Pipeline Stage Data Definitions ────────────────────────

interface PipelineStage {
    id: string;
    stepNumber: number;
    title: string;
    category: string;
    icon: React.ElementType;
    badge: string;
    badgeColor: string;
    duration: string;
    cost: string;
    description: string;
    component: string;
    inputs: string[];
    outputs: string[];
    technicalDetails: {
        runtime: string;
        apiOrModel: string;
        scriptPath: string;
        schema: string;
        failurePolicy: string;
    };
    samplePayload: string;
}

const PIPELINE_STAGES: Record<string, PipelineStage> = {
    trigger: {
        id: 'trigger',
        stepNumber: 1,
        title: 'Scheduler & Trigger',
        category: 'Orchestration',
        icon: Clock,
        badge: 'Scheduled 2x/Day',
        badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        duration: '< 1s',
        cost: '$0.00',
        description: 'Automated Cloud Scheduler cron triggers scraping runs twice daily to capture morning buzz and evening prime-time recaps.',
        component: 'Cloud Scheduler / JIT Engine',
        inputs: ['Cron Schedule (11:00 & 23:00 WIB)', 'Manual CLI Trigger'],
        outputs: ['Execution Signal', 'Run Context Timestamp'],
        technicalDetails: {
            runtime: 'GCP Cloud Scheduler & Cloud Function Gen 2',
            apiOrModel: 'Pub/Sub Event Dispatcher',
            scriptPath: 'backend/functions/dispatcher/main.py',
            schema: '{ run_id: string, trigger_time: ISO8601, run_type: "scheduled" | "manual" }',
            failurePolicy: 'Automatic retry 3x with exponential backoff (5m max)',
        },
        samplePayload: JSON.stringify({
            run_id: "crawl-2026-08-26-w1",
            trigger_window: "11:00 WIB",
            run_type: "scheduled",
            target_date: "2026-08-26"
        }, null, 2),
    },
    slate: {
        id: 'slate',
        stepNumber: 2,
        title: 'Theatrical Slate & Tag Resolver',
        category: 'Input Resolution',
        icon: Film,
        badge: '6 Active Movies',
        badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
        duration: '~2s',
        cost: '$0.00',
        description: 'Queries active Indonesian cinema showtimes from TIX.id / 21Cineplex and maps each theatrical title to its primary viral campaign hashtags.',
        component: 'Hashtag Extractor & Movie Catalog',
        inputs: ['Active Showtimes DB', 'Curated Keyword Rules', 'TIX.id Catalog'],
        outputs: ['Active Hashtags Array', 'Target Movie Metadata'],
        technicalDetails: {
            runtime: 'Python 3.13 / FastAPI Rest Endpoint',
            apiOrModel: 'TIX.id Showtimes Catalog + Firestore',
            scriptPath: 'studio/src/app/api/social-feed/sources/route.ts',
            schema: 'Array<{ movie_title: string, official_tags: string[], aliases: string[] }>',
            failurePolicy: 'Fallback to active weekly slate from local JSON cache',
        },
        samplePayload: JSON.stringify([
            { title: "Harusnya Horror", hashtag: "harusnyahorror", distributor: "MD Pictures", limit: 25 },
            { title: "Kang Mak", hashtag: "kangmak", distributor: "Falcon Pictures", limit: 25 },
            { title: "Agak Laen", hashtag: "agaklaen", distributor: "Imajinari", limit: 25 }
        ], null, 2),
    },
    scraper: {
        id: 'scraper',
        stepNumber: 3,
        title: 'Apify Actor Scraping Engine',
        category: 'Data Extraction',
        icon: Bot,
        badge: 'Capped Spend ~$0.85/day',
        badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        duration: '~25s',
        cost: '~$0.085 / run',
        description: 'Dispatches headless Apify scraping actors to collect top video statistics (views, shares, likes) and user comments without account credentials.',
        component: 'Apify TikTok Scraper Actor',
        inputs: ['Resolved Hashtags', 'Limit Parameters (25 posts/tag)', 'Comments Depth (20/post)'],
        outputs: ['Raw Video Metadata', 'Top Audience Comments', 'Engagement Metrics'],
        technicalDetails: {
            runtime: 'Apify Serverless Actor Container',
            apiOrModel: 'clockworks/tiktok-scraper + comments-scraper',
            scriptPath: 'backend/scripts/pilot_tiktok_crawler.py',
            schema: 'Array<{ id: string, text: string, diggCount: number, shareCount: number, comments: Comment[] }>',
            failurePolicy: 'Circuit breaker: Abort if spend exceeds $5.00/day; return partial records',
        },
        samplePayload: JSON.stringify({
            scraped_items: 10,
            scraped_comments: 45,
            total_views: 454000,
            total_shares: 4178,
            spend_usd: 0.1323,
            status: "SUCCEEDED"
        }, null, 2),
    },
    storage: {
        id: 'storage',
        stepNumber: 4,
        title: 'Data Lake & Ingestion Pipeline',
        category: 'Persistence',
        icon: Database,
        badge: 'JSON Snapshot + Firestore',
        badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        duration: '~3s',
        cost: '$0.00',
        description: 'Normalizes and deduplicates raw crawled video feeds into structured time-series snapshots and persists them for historical analysis.',
        component: 'Local Storage & Firestore REST',
        inputs: ['Raw Scraper Output', 'Run Context'],
        outputs: ['Normalized Social Posts', 'Aggregated Historical Docs'],
        technicalDetails: {
            runtime: 'Node.js / Python REST Client',
            apiOrModel: 'Google Cloud Firestore 2.28 + Local JSON Data Store',
            scriptPath: 'studio/src/lib/firestore-rest.ts',
            schema: 'Collection: tiktok_crawls/{date_hour} -> { videos, comments, meta }',
            failurePolicy: 'Local disk atomic write backup if Firestore is unavailable',
        },
        samplePayload: JSON.stringify({
            collection: "tiktok_crawls",
            doc_id: "2026-08-26_1100",
            saved_videos: 10,
            storage_path: "studio/src/data/tiktok_latest.json",
            synced_at: "2026-08-26T04:00:00Z"
        }, null, 2),
    },
    ai_enrichment: {
        id: 'ai_enrichment',
        stepNumber: 5,
        title: 'Gemini 2.5 Flash Intelligence & NLP',
        category: 'AI Enrichment',
        icon: Sparkles,
        badge: 'Gemini 2.5 Flash',
        badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        duration: '~8s',
        cost: '< $0.01 / run',
        description: 'Executes structured NLP analysis to compute Organic vs Promo ratios, sentiment classification, virality velocity, and generates scannable executive briefings.',
        component: '@google/generative-ai / Structured Inference',
        inputs: ['Crawled Videos & Comments', 'Historical Baseline Metrics'],
        outputs: ['Sentiment Scores', 'Organic WoM Ratio', 'Executive Briefings', 'Risk/Friction Alerts'],
        technicalDetails: {
            runtime: 'Server-side Next.js Route Handler',
            apiOrModel: 'Google Gemini 2.5 Flash (temperature: 0.2)',
            scriptPath: 'studio/src/app/api/social-feed/summarize/route.ts',
            schema: '{ share_of_voice: object, briefings: [morning, night], signals: object[] }',
            failurePolicy: 'Fallback to deterministic rule-based sentiment calculation',
        },
        samplePayload: JSON.stringify({
            sentiment_summary: { positive: 72, neutral: 18, negative: 10 },
            organic_wom_ratio: "78% (High Authentic Word-of-Mouth)",
            virality_velocity: "+24.5% vs yesterday",
            briefing_takeaway: "Strong early comedy buzz for #harusnyahorror driven by creator reaction clips."
        }, null, 2),
    },
    dashboard: {
        id: 'dashboard',
        stepNumber: 6,
        title: 'TikTok Radar & Executive Views',
        category: 'Presentation',
        icon: LayoutDashboard,
        badge: 'Interactive UI',
        badgeColor: 'bg-primary/10 text-primary border-primary/20',
        duration: '< 100ms',
        cost: '$0.00',
        description: 'Presents the synthesized cinema intelligence to studio executives: 4 KPI signals, dual structured briefings, leaderboard, and searchable comment sentiment feed.',
        component: 'Next.js 16 Client & Turbopack',
        inputs: ['Enriched Intelligence Feed', 'Historical Snapshots'],
        outputs: ['Actionable Distribution Insights', 'Live Sentiment Feed'],
        technicalDetails: {
            runtime: 'React 19 / Turbopack Client Component',
            apiOrModel: 'SWR Cache + Client State Management',
            scriptPath: 'studio/src/app/tiktok/explorer/page.tsx',
            schema: 'UI Dashboard Components & Recharts Visualizations',
            failurePolicy: 'Honest empty state for dates prior to Aug 23, 2026 pilot recording',
        },
        samplePayload: JSON.stringify({
            rendered_cards: ["Share of Voice", "Organic WoM", "Virality Velocity", "Friction Alert"],
            briefing_windows: ["Morning 11:00 WIB", "Night 23:00 WIB"],
            view_status: "Active"
        }, null, 2),
    },
};

// ─── Custom ReactFlow Stage Node Component ──────────────────

function PipelineCustomNode({ data, selected }: NodeProps) {
    const stage = PIPELINE_STAGES[data.stageId as string];
    if (!stage) return null;

    const Icon = stage.icon;

    return (
        <div
            className={cn(
                'w-[260px] rounded-xl border bg-card/95 backdrop-blur-sm p-4 transition-all duration-200 shadow-sm text-left',
                selected
                    ? 'border-primary ring-2 ring-primary/20 shadow-md'
                    : 'border-border/60 hover:border-border hover:shadow-md'
            )}
        >
            <Handle
                type="target"
                position={Position.Left}
                className="w-2.5 h-2.5 bg-muted-foreground border-2 border-background"
            />

            {/* Header: Step & Category */}
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-muted flex items-center justify-center font-mono font-bold text-sm text-muted-foreground">
                        {stage.stepNumber}
                    </span>
                    <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        {stage.category}
                    </span>
                </div>
                <Badge variant="outline" className={cn('text-sm font-medium px-2 py-0.5', stage.badgeColor)}>
                    {stage.duration}
                </Badge>
            </div>

            {/* Title & Icon */}
            <div className="flex items-center gap-2.5 mb-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                    <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground leading-tight truncate">
                        {stage.title}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                        {stage.component}
                    </p>
                </div>
            </div>

            {/* Metrics Footer */}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/40 text-sm">
                <span className="text-muted-foreground">Cost:</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {stage.cost}
                </span>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                className="w-2.5 h-2.5 bg-primary border-2 border-background"
            />
        </div>
    );
}

const nodeTypes = {
    pipelineStage: PipelineCustomNode,
};

// ─── Initial Graph State ────────────────────────────────────

const initialNodes: Node[] = [
    {
        id: 'trigger',
        type: 'pipelineStage',
        position: { x: 50, y: 150 },
        data: { stageId: 'trigger' },
    },
    {
        id: 'slate',
        type: 'pipelineStage',
        position: { x: 370, y: 150 },
        data: { stageId: 'slate' },
    },
    {
        id: 'scraper',
        type: 'pipelineStage',
        position: { x: 690, y: 150 },
        data: { stageId: 'scraper' },
    },
    {
        id: 'storage',
        type: 'pipelineStage',
        position: { x: 1010, y: 150 },
        data: { stageId: 'storage' },
    },
    {
        id: 'ai_enrichment',
        type: 'pipelineStage',
        position: { x: 1330, y: 150 },
        data: { stageId: 'ai_enrichment' },
    },
    {
        id: 'dashboard',
        type: 'pipelineStage',
        position: { x: 1650, y: 150 },
        data: { stageId: 'dashboard' },
    },
];

const initialEdges: Edge[] = [
    {
        id: 'e1-2',
        source: 'trigger',
        target: 'slate',
        animated: true,
        label: '11:00 & 23:00 WIB',
        style: { stroke: 'var(--primary)', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
    },
    {
        id: 'e2-3',
        source: 'slate',
        target: 'scraper',
        animated: true,
        label: '6 Movie Hashtags',
        style: { stroke: 'var(--primary)', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
    },
    {
        id: 'e3-4',
        source: 'scraper',
        target: 'storage',
        animated: true,
        label: 'Raw Videos & Comments',
        style: { stroke: 'var(--primary)', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
    },
    {
        id: 'e4-5',
        source: 'storage',
        target: 'ai_enrichment',
        animated: true,
        label: 'Historical Feed',
        style: { stroke: 'var(--primary)', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
    },
    {
        id: 'e5-6',
        source: 'ai_enrichment',
        target: 'dashboard',
        animated: true,
        label: 'Signals & Briefings',
        style: { stroke: 'var(--primary)', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
    },
];

// ─── Main Page Component ────────────────────────────────────

export default function TikTokWorkflowPage() {
    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [edges, , onEdgesChange] = useEdgesState(initialEdges);
    const [selectedStageId, setSelectedStageId] = useState<string>('ai_enrichment');
    const [viewMode, setViewMode] = useState<'canvas' | 'sequence'>('canvas');

    const selectedStage = PIPELINE_STAGES[selectedStageId] || PIPELINE_STAGES.ai_enrichment;

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        if (node.data?.stageId) {
            setSelectedStageId(node.data.stageId as string);
        }
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground p-6 max-w-[1600px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-4">
                <div>
                    <div className="flex items-center gap-3 mb-1.5">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">TikTok Intelligence Pipeline</h1>
                            <p className="text-muted-foreground text-sm font-medium">
                                Automated daily scraping, Gemini NLP enrichment, and sentiment aggregation workflow
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/tiktok/explorer"
                        className="px-3.5 py-1.5 rounded-lg border border-border/60 hover:bg-muted text-sm font-semibold flex items-center gap-1.5 transition-colors"
                    >
                        <Play className="w-3.5 h-3.5 text-primary" />
                        Open TikTok Radar
                    </Link>

                    <Badge variant="outline" className="px-3 py-1 text-sm font-semibold gap-1.5 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Automated Daily Runs Active
                    </Badge>
                </div>
            </div>

            {/* Metric KPI Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-muted/30 border-border/50">
                    <CardHeader className="p-4 pb-1">
                        <CardDescription className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            Execution Windows
                            <Clock className="w-4 h-4 text-primary" />
                        </CardDescription>
                        <CardTitle className="text-xl font-black text-foreground">
                            2x / Day
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                        <span className="text-sm text-muted-foreground">
                            11:00 WIB & 23:00 WIB
                        </span>
                    </CardContent>
                </Card>

                <Card className="bg-muted/30 border-border/50">
                    <CardHeader className="p-4 pb-1">
                        <CardDescription className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            End-to-End SLA
                            <Zap className="w-4 h-4 text-amber-500" />
                        </CardDescription>
                        <CardTitle className="text-xl font-black text-amber-500">
                            ~45 Seconds
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                        <span className="text-sm text-muted-foreground">
                            Trigger to UI synthesis
                        </span>
                    </CardContent>
                </Card>

                <Card className="bg-muted/30 border-border/50">
                    <CardHeader className="p-4 pb-1">
                        <CardDescription className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            Daily Cost Target
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                        </CardDescription>
                        <CardTitle className="text-xl font-black text-emerald-500">
                            ~$0.85 / $5.00
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                        <span className="text-sm text-muted-foreground">
                            Apify actor + Gemini API
                        </span>
                    </CardContent>
                </Card>

                <Card className="bg-muted/30 border-border/50">
                    <CardHeader className="p-4 pb-1">
                        <CardDescription className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            AI Model Engine
                            <Sparkles className="w-4 h-4 text-purple-500" />
                        </CardDescription>
                        <CardTitle className="text-xl font-black text-purple-500">
                            Gemini 2.5 Flash
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                        <span className="text-sm text-muted-foreground">
                            Structured WoM & Sentiment
                        </span>
                    </CardContent>
                </Card>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant={viewMode === 'canvas' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('canvas')}
                        className="rounded-lg text-sm font-semibold gap-1.5"
                    >
                        <Layers className="w-3.5 h-3.5" />
                        Interactive Node Canvas (Xyflow)
                    </Button>

                    <Button
                        variant={viewMode === 'sequence' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('sequence')}
                        className="rounded-lg text-sm font-semibold gap-1.5"
                    >
                        <Activity className="w-3.5 h-3.5" />
                        Sequence & Step Breakdown
                    </Button>
                </div>

                <span className="text-sm text-muted-foreground font-medium">
                    Click any stage node to inspect technical parameters & payloads
                </span>
            </div>

            {/* Main Visualizer Area */}
            {viewMode === 'canvas' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Xyflow Interactive Graph (2 cols) */}
                    <div className="lg:col-span-2 h-[560px] rounded-xl border border-border/60 bg-muted/10 overflow-hidden relative shadow-sm">
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onNodeClick={onNodeClick}
                            nodeTypes={nodeTypes}
                            fitView
                            fitViewOptions={{ padding: 0.2 }}
                            minZoom={0.3}
                            maxZoom={1.5}
                        >
                            <Background color="var(--border)" gap={20} size={1} />
                            <Controls className="bg-card border border-border text-foreground rounded-lg" />
                            <MiniMap
                                nodeColor="var(--primary)"
                                maskColor="rgba(0, 0, 0, 0.4)"
                                className="bg-card border border-border rounded-lg"
                            />
                        </ReactFlow>

                        <div className="absolute top-3 left-3 pointer-events-none">
                            <span className="px-2.5 py-1 rounded-md bg-background/80 backdrop-blur-sm border border-border/60 text-sm font-medium text-muted-foreground shadow-sm">
                                Interactive Flow Canvas · Pan / Zoom / Click Node
                            </span>
                        </div>
                    </div>

                    {/* Stage Inspector Drawer (1 col) */}
                    <StageInspector stage={selectedStage} />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sequence Diagram View */}
                    <div className="lg:col-span-2">
                        <SequenceDiagramView onSelectStage={setSelectedStageId} selectedStageId={selectedStageId} />
                    </div>

                    {/* Stage Inspector */}
                    <StageInspector stage={selectedStage} />
                </div>
            )}
        </div>
    );
}

// ─── Stage Inspector Component ──────────────────────────────

function StageInspector({ stage }: { stage: PipelineStage }) {
    const Icon = stage.icon;

    return (
        <Card className="border-border/60 bg-card h-full flex flex-col">
            <CardHeader className="p-5 pb-3 border-b border-border/30">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-sm">
                            {stage.stepNumber}
                        </span>
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            {stage.category}
                        </span>
                    </div>
                    <Badge variant="outline" className={cn('text-sm font-medium', stage.badgeColor)}>
                        {stage.badge}
                    </Badge>
                </div>
                <CardTitle className="text-base font-bold flex items-center gap-2 pt-1">
                    <Icon className="w-4 h-4 text-primary" />
                    {stage.title}
                </CardTitle>
                <CardDescription className="text-sm">
                    {stage.description}
                </CardDescription>
            </CardHeader>

            <CardContent className="p-5 space-y-4 flex-1 overflow-y-auto">
                {/* Inputs & Outputs Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/40 space-y-1.5">
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground block">
                            Inputs
                        </span>
                        <ul className="space-y-1 text-foreground">
                            {stage.inputs.map((inp, i) => (
                                <li key={i} className="flex items-center gap-1.5 truncate">
                                    <ChevronRight className="w-3 h-3 text-primary flex-shrink-0" />
                                    <span className="truncate">{inp}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/30 border border-border/40 space-y-1.5">
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground block">
                            Outputs
                        </span>
                        <ul className="space-y-1 text-foreground">
                            {stage.outputs.map((out, i) => (
                                <li key={i} className="flex items-center gap-1.5 truncate">
                                    <ChevronRight className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                    <span className="truncate">{out}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Technical Specifications */}
                <div className="space-y-2 text-sm">
                    <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground block">
                        Technical Execution
                    </span>

                    <div className="p-3 rounded-lg bg-muted/20 border border-border/40 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Runtime Engine:</span>
                            <span className="font-medium text-foreground">{stage.technicalDetails.runtime}</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">API / Model:</span>
                            <span className="font-mono font-semibold text-foreground">{stage.technicalDetails.apiOrModel}</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Source Code:</span>
                            <span className="font-mono text-sm text-primary truncate max-w-[200px]">{stage.technicalDetails.scriptPath}</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Failure Policy:</span>
                            <span className="font-medium text-amber-600 dark:text-amber-400 text-sm">{stage.technicalDetails.failurePolicy}</span>
                        </div>
                    </div>
                </div>

                {/* Sample JSON Payload */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <FileJson className="w-3.5 h-3.5 text-primary" />
                            Data Schema & Sample
                        </span>
                        <span className="font-mono text-sm text-muted-foreground">JSON</span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950 text-zinc-300 font-mono text-sm overflow-x-auto border border-border/40 max-h-[160px]">
                        <pre><code>{stage.samplePayload}</code></pre>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Sequence Diagram Step View Component ───────────────────

function SequenceDiagramView({
    onSelectStage,
    selectedStageId,
}: {
    onSelectStage: (id: string) => void;
    selectedStageId: string;
}) {
    const stages = Object.values(PIPELINE_STAGES);

    return (
        <Card className="border-border/60 bg-card">
            <CardHeader className="p-5 pb-3 border-b border-border/30">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Daily Execution Sequence (11:00 & 23:00 WIB)
                </CardTitle>
                <CardDescription className="text-sm">
                    Chronological step-by-step pipeline sequence from trigger to UI dashboard delivery
                </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
                <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/60">
                    {stages.map((stage) => {
                        const Icon = stage.icon;
                        const isSelected = selectedStageId === stage.id;

                        return (
                            <div
                                key={stage.id}
                                onClick={() => onSelectStage(stage.id)}
                                className={cn(
                                    'relative p-4 rounded-xl border transition-all cursor-pointer text-left',
                                    isSelected
                                        ? 'bg-primary/5 border-primary ring-1 ring-primary/20 shadow-sm'
                                        : 'bg-muted/20 border-border/50 hover:bg-muted/40 hover:border-border'
                                )}
                            >
                                {/* Step Circle Indicator */}
                                <div
                                    className={cn(
                                        'absolute -left-[31px] top-4 w-5 h-5 rounded-full border-2 flex items-center justify-center font-mono text-sm font-bold bg-background',
                                        isSelected
                                            ? 'border-primary text-primary'
                                            : 'border-muted-foreground/40 text-muted-foreground'
                                    )}
                                >
                                    {stage.stepNumber}
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-foreground">
                                                {stage.title}
                                            </h4>
                                            <p className="text-sm text-muted-foreground">
                                                {stage.component}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-semibold text-muted-foreground">
                                            {stage.duration}
                                        </span>
                                        <Badge variant="outline" className={cn('text-sm font-medium', stage.badgeColor)}>
                                            {stage.cost}
                                        </Badge>
                                    </div>
                                </div>

                                <p className="text-sm text-muted-foreground mb-3">
                                    {stage.description}
                                </p>

                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30 text-sm">
                                    <span className="text-muted-foreground font-medium">Flow:</span>
                                    <Badge variant="secondary" className="text-sm font-mono">
                                        {stage.inputs.join(', ')}
                                    </Badge>
                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                    <Badge variant="secondary" className="text-sm font-mono text-primary">
                                        {stage.outputs.join(', ')}
                                    </Badge>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
