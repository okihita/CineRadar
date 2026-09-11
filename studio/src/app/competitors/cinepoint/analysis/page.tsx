'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Target, Star, Clapperboard } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageLoader, PageError } from '@/components/cinepoint/PageShell';
import { useAnalysisData } from '@/lib/cinepoint';

import { PredictorTab } from './_components/PredictorTab';
import { ActorsTab } from './_components/ActorsTab';
import { DirectorsTab } from './_components/DirectorsTab';

type AnalysisTabKey = 'predictor' | 'actors' | 'directors';

function TalentAndPredictorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const validTabs: AnalysisTabKey[] = ['predictor', 'actors', 'directors'];
  const activeTab: AnalysisTabKey = validTabs.includes(currentTab as AnalysisTabKey)
    ? (currentTab as AnalysisTabKey)
    : 'predictor';

  const { movies, loading, error } = useAnalysisData();

  const handleTabChange = (val: string) => {
    router.replace(`/competitors/cinepoint/analysis?tab=${val}`, { scroll: false });
  };

  if (loading) {
    return <PageLoader message="Loading talent & predictive analysis..." />;
  }

  if (error) {
    return (
      <div className="px-6 py-8">
        <PageError error={error} />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tighter">Talent &amp; Predictor</h1>
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold opacity-60">
              Success factor forecasting, actor bankability &amp; director performance
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-muted/40 p-1 rounded-xl border border-border/40 grid grid-cols-3 max-w-xl">
          <TabsTrigger value="predictor" className="gap-2 text-sm font-semibold rounded-lg">
            <Target className="w-4 h-4" />
            Success Predictor
          </TabsTrigger>
          <TabsTrigger value="actors" className="gap-2 text-sm font-semibold rounded-lg">
            <Star className="w-4 h-4" />
            Actor Database
          </TabsTrigger>
          <TabsTrigger value="directors" className="gap-2 text-sm font-semibold rounded-lg">
            <Clapperboard className="w-4 h-4" />
            Director Database
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predictor" className="focus-visible:outline-none">
          <PredictorTab movies={movies} />
        </TabsContent>

        <TabsContent value="actors" className="focus-visible:outline-none">
          <ActorsTab movies={movies} />
        </TabsContent>

        <TabsContent value="directors" className="focus-visible:outline-none">
          <DirectorsTab movies={movies} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CinePointAnalysisPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading talent & predictive suite..." />}>
      <TalentAndPredictorContent />
    </Suspense>
  );
}
