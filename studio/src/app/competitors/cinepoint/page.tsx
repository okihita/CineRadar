'use client';

import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, Library, Trophy, Target } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/cinepoint/PageShell';

import { useBoxOfficeData } from './_components/useBoxOfficeData';
import { InsightsTab } from './_components/InsightsTab';
import { CatalogTab } from './_components/CatalogTab';
import { HallOfFameTab } from './_components/HallOfFameTab';

type BoxOfficeTabKey = 'insights' | 'catalog' | 'hall-of-fame';

function BoxOfficeAndCatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const validTabs: BoxOfficeTabKey[] = ['insights', 'catalog', 'hall-of-fame'];
  const activeTab: BoxOfficeTabKey = validTabs.includes(currentTab as BoxOfficeTabKey)
    ? (currentTab as BoxOfficeTabKey)
    : 'insights';

  const boxOffice = useBoxOfficeData();

  // Preload Hall of Fame data if navigating directly to it
  useEffect(() => {
    if (activeTab === 'hall-of-fame' && !boxOffice.yearsData && !boxOffice.yearsLoading) {
      boxOffice.loadYears();
    }
  }, [activeTab, boxOffice]);

  const handleTabChange = (val: string) => {
    if (val === 'hall-of-fame' && !boxOffice.yearsData && !boxOffice.yearsLoading) {
      boxOffice.loadYears();
    }
    router.replace(`/competitors/cinepoint?tab=${val}`, { scroll: false });
  };

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tighter">Box Office &amp; Catalog</h1>
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold opacity-60">
              Admissions insights, movie database sync &amp; annual hall of fame
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/competitors/cinepoint/analysis">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 px-4 text-sm font-black uppercase tracking-wider rounded-xl border-border/60 hover:bg-muted transition-all"
            >
              <Target className="w-3.5 h-3.5" />
              Talent &amp; Predictor
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-muted/40 p-1 rounded-xl border border-border/40 grid grid-cols-3 max-w-xl">
          <TabsTrigger value="insights" className="gap-2 text-sm font-semibold rounded-lg">
            <BarChart3 className="w-4 h-4" />
            Box Office Insights
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-2 text-sm font-semibold rounded-lg">
            <Library className="w-4 h-4" />
            Movie Catalog
          </TabsTrigger>
          <TabsTrigger value="hall-of-fame" className="gap-2 text-sm font-semibold rounded-lg">
            <Trophy className="w-4 h-4" />
            Hall of Fame
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="focus-visible:outline-none">
          <InsightsTab boxOffice={boxOffice} />
        </TabsContent>

        <TabsContent value="catalog" className="focus-visible:outline-none">
          <CatalogTab />
        </TabsContent>

        <TabsContent value="hall-of-fame" className="focus-visible:outline-none">
          <HallOfFameTab
            yearsLoading={boxOffice.yearsLoading}
            yearsError={boxOffice.yearsError}
            yearsData={boxOffice.yearsData}
            loadYears={boxOffice.loadYears}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CinePointBoxOfficeCatalogPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading box office & catalog..." />}>
      <BoxOfficeAndCatalogContent />
    </Suspense>
  );
}
