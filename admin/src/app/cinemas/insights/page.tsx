'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageHeader } from '@/components/PageHeader';
import { BarChart3, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { InsightsDashboard } from '@/features/cinemas/components/InsightsDashboard';

function InsightsPageContent() {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
            {/* Page Header */}
            <div className="px-6 pt-6">
                <div className="flex items-center gap-4 mb-2">
                    <Link href="/cinemas">
                        <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-foreground">
                            <ChevronLeft className="w-4 h-4" /> Back to Registry
                        </Button>
                    </Link>
                </div>
                <PageHeader
                    title="Market Intelligence"
                    description="High-level operational insights derived from national physical asset data."
                    icon={<BarChart3 className="w-6 h-6 text-primary" />}
                />
            </div>

            <main className="px-6 pb-6 pt-4">
                <InsightsDashboard />
            </main>
        </div>
    );
}

export default function InsightsPage() {
    return (
        <ErrorBoundary>
            <InsightsPageContent />
        </ErrorBoundary>
    );
}
