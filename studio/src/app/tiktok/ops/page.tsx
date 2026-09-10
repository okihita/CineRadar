'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Layers, FileJson } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SourcesTab } from './components/SourcesTab';
import { WorkflowTab } from './components/WorkflowTab';
import { RawTelemetryTab } from './components/RawTelemetryTab';

type TabKey = 'sources' | 'workflow' | 'raw';

function OpsHubContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab');
    const validTabs: TabKey[] = ['sources', 'workflow', 'raw'];
    const activeTab: TabKey = validTabs.includes(currentTab as TabKey)
        ? (currentTab as TabKey)
        : 'sources';

    const handleTabChange = (val: string) => {
        router.replace(`/tiktok/ops?tab=${val}`, { scroll: false });
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Top Navigation & Breadcrumb */}
            <div>
                <Link
                    href="/tiktok/explorer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Theatrical Radar
                </Link>

                <PageHeader
                    title="Ops & Pipeline Hub"
                    description="Centralized social intelligence operations: truth seed discovery, pipeline orchestration, and Firestore telemetry."
                />
            </div>

            {/* Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
                <TabsList className="bg-muted/40 p-1 rounded-xl border border-border/40 grid grid-cols-3 max-w-xl">
                    <TabsTrigger value="sources" className="gap-2 text-sm font-semibold rounded-lg">
                        <ShieldCheck className="w-4 h-4" />
                        Sources &amp; Discovery
                    </TabsTrigger>
                    <TabsTrigger value="workflow" className="gap-2 text-sm font-semibold rounded-lg">
                        <Layers className="w-4 h-4" />
                        Pipeline Topology
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="gap-2 text-sm font-semibold rounded-lg">
                        <FileJson className="w-4 h-4" />
                        Raw Telemetry
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="sources" className="focus-visible:outline-none">
                    <SourcesTab />
                </TabsContent>

                <TabsContent value="workflow" className="focus-visible:outline-none">
                    <WorkflowTab />
                </TabsContent>

                <TabsContent value="raw" className="focus-visible:outline-none">
                    <RawTelemetryTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function TikTokOpsPage() {
    return (
        <Suspense fallback={<div className="p-8 font-mono text-sm text-muted-foreground">Loading Ops &amp; Pipeline Hub...</div>}>
            <OpsHubContent />
        </Suspense>
    );
}
