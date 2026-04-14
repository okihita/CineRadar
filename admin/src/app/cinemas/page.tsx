'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { ChevronUp, MapPin, BarChart3 } from 'lucide-react';
import { IndonesiaMap } from '@/components/indonesia-map';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageHeader } from '@/components/PageHeader';
import { REGION_CITIES, getRegion } from '@/lib/regions';
import { formatWIBShort } from '@/lib/timeUtils';
import { useTheatres } from '@/hooks/useTheatres';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// DIRECT CLIENT IMPORTS (Prevents index.ts leakage)
import { useCinemasStore } from '@/features/cinemas/stores/useCinemasStore';
import { useFilteredTheatres } from '@/features/cinemas/hooks/useCinemasData';
import { RegionBreakdownCard } from '@/features/cinemas/components/RegionBreakdownCard';
import { ChainDistributionCard } from '@/features/cinemas/components/ChainDistributionCard';
import { TheatreSidebar } from '@/features/cinemas/components/TheatreSidebar';
import { GlobalTheatreSearch } from '@/features/cinemas/components/GlobalTheatreSearch';
import { TheatreTable } from '@/features/cinemas/components/TheatreTable';
import type { Theatre } from '@/features/cinemas/types';

function CinemasPageContent() {
  // Server state
  const { theatres, runs, loading: isLoading, refetch, metrics } = useTheatres();

  // UI state (Zustand)
  const store = useCinemasStore();

  // Derived data for sidebar facets
  const merchants = useMemo(
    () => [...new Set(theatres.map((t) => t.merchant))].filter(Boolean).sort(),
    [theatres]
  );

  const merchantBreakdown = useMemo(
    () =>
      merchants
        .map((m) => ({
          name: m,
          count: theatres.filter((t) => t.merchant === m).length,
        }))
        .sort((a, b) => b.count - a.count),
    [merchants, theatres]
  );

  // Filter theatres by merchant first (for region count calculation)
  const merchantFilteredTheatres = useMemo(
    () =>
      store.selectedMerchant === 'all'
        ? theatres
        : theatres.filter((t) => t.merchant === store.selectedMerchant),
    [theatres, store.selectedMerchant]
  );

  // Region breakdown facets
  const regionBreakdown = useMemo(() => {
    const breakdown = Object.keys(REGION_CITIES)
      .map((region) => ({
        name: region,
        count: merchantFilteredTheatres.filter((t) => getRegion(t.city) === region).length,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);

    const othersCount = merchantFilteredTheatres.filter(
      (t) => getRegion(t.city) === 'Others'
    ).length;
    if (othersCount > 0) {
      breakdown.push({ name: 'Others', count: othersCount });
    }

    return breakdown;
  }, [merchantFilteredTheatres]);

  // Filtered and sorted theatres
  const sortedTheatres = useFilteredTheatres(
    theatres,
    store.searchTerm,
    store.selectedMerchant,
    store.selectedRegion,
    store.sortByName,
    store.sortByCity,
    store.sortByCapacity,
    getRegion
  );

  // Map theatres (filtered for display)
  const mapTheatres = useMemo(
    () =>
      sortedTheatres.filter(
        (t: Theatre) => t.lat && t.lng && !isNaN(t.lat) && !isNaN(t.lng)
      ) as Theatre[],
    [sortedTheatres]
  );

  // Sync filtered IDs to store for detail page navigation
  const theatreIds = useMemo(() => sortedTheatres.map((t: Theatre) => t.theatre_id), [sortedTheatres]);
  useEffect(() => {
    store.setFilteredTheatreIds(theatreIds);
  }, [theatreIds, store]);

  // Last updated timestamp (WIB)
  const lastUpdated = runs[0]?.timestamp ? formatWIBShort(runs[0].timestamp) : null;

  // Scroll listener for back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      store.setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [store]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Loading skeleton
  if (isLoading && theatres.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground animate-pulse">
        <header className="border-b h-14" />
        <main className="container mx-auto px-6 py-10">
            <div className="grid grid-cols-[280px_1fr] gap-10">
                <div className="bg-muted/20 h-[600px] rounded-xl" />
                <div className="space-y-6">
                    <div className="bg-muted/20 h-12 rounded-xl" />
                    <div className="bg-muted/20 h-[400px] rounded-xl" />
                </div>
            </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Page Header */}
      <div className="px-6 pt-6">
        <PageHeader
          title="Cinema Intelligence"
          description="National Physical Asset Registry & Market Coverage"
          icon={<MapPin className="w-6 h-6 text-primary" />}
          metrics={metrics}
          onRefresh={refetch}
          isRefreshing={isLoading}
        >
          <Link href="/cinemas/insights">
            <Button variant="outline" size="sm" className="h-9 gap-2 font-bold uppercase tracking-widest text-[10px] border-primary/20 hover:bg-primary/5 shadow-sm">
              <BarChart3 className="w-3.5 h-3.5" />
              View Market Insights
            </Button>
          </Link>
        </PageHeader>
      </div>

      <main className="px-6 pb-10 pt-2">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10 items-start">
          
          {/* LEFT: FACETED SIDEBAR - Fixed height sticky */}
          <aside className="sticky top-6 h-[calc(100vh-3rem)] overflow-y-auto no-scrollbar">
            <TheatreSidebar 
                totalCount={theatres.length}
                merchantBreakdown={merchantBreakdown}
                regionBreakdown={regionBreakdown}
                selectedMerchant={store.selectedMerchant}
                selectedRegion={store.selectedRegion}
                onMerchantChange={store.setSelectedMerchant}
                onRegionChange={store.setSelectedRegion}
                onClearFilters={store.clearFilters}
            />
          </aside>

          {/* RIGHT: MAIN CONTENT AREA */}
          <div className="space-y-6">
            
            {/* STICKY ACTION BAR: Global Search */}
            <div className="sticky top-0 z-20 py-4 bg-background/95 backdrop-blur-md border-b border-border/50 -mx-2 px-2">
                <GlobalTheatreSearch 
                    value={store.searchTerm}
                    onChange={store.setSearchTerm}
                    isLoading={isLoading}
                    resultsCount={sortedTheatres.length}
                />
            </div>

            {/* Map & Distribution Section */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
                <Card className="overflow-hidden py-0 border shadow-sm rounded-xl min-h-[450px]">
                    <IndonesiaMap
                        theatres={mapTheatres}
                        selectedTheatre={store.selectedTheatre}
                        onTheatreSelect={store.setSelectedTheatre}
                        onViewDetails={(theatre) => window.open(`/cinemas/${theatre.theatre_id}`, '_blank')}
                        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
                        lastUpdated={lastUpdated}
                        center={store.mapCenter}
                    />
                </Card>

                <div className="flex flex-col gap-4">
                    <RegionBreakdownCard
                        regionBreakdown={regionBreakdown}
                        totalTheatres={theatres.length}
                    />
                    <ChainDistributionCard
                        theatres={theatres}
                        regionBreakdown={regionBreakdown}
                    />
                </div>
            </div>

            {/* Theatre Registry Table */}
            <div className="pt-2">
                <div className="flex items-center gap-3 mb-4 px-1">
                    <div className="h-4 w-1 bg-primary rounded-full shadow-sm" />
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">Theatre Registry</h2>
                </div>
                <TheatreTable
                    theatres={sortedTheatres}
                    totalCount={sortedTheatres.length}
                    currentPage={store.currentPage}
                    searchTerm={store.searchTerm}
                    sortByName={store.sortByName}
                    sortByCity={store.sortByCity}
                    sortByCapacity={store.sortByCapacity}
                    selectedTheatre={store.selectedTheatre}
                    onPageChange={store.setCurrentPage}
                    onToggleNameSort={store.toggleNameSort}
                    onToggleCitySort={store.toggleCitySort}
                    onToggleCapacitySort={store.toggleCapacitySort}
                    onTheatreSelect={store.setSelectedTheatre}
                    onClearFilters={store.clearFilters}
                />
            </div>
          </div>
        </div>
      </main>

      {/* Back to Top Button */}
      {store.showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:bg-primary/90 transition-all duration-200 animate-in fade-in slide-in-from-bottom-4"
          title="Back to top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// Default export with ErrorBoundary wrapper
export default function CinemasPage() {
  return (
    <ErrorBoundary>
      <CinemasPageContent />
    </ErrorBoundary>
  );
}
