'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { ChevronUp, MapPin } from 'lucide-react';
import { IndonesiaMap } from '@/components/indonesia-map';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageHeader } from '@/components/PageHeader';
import { getRegion } from '@/lib/regions';
import { formatWIBShort } from '@/lib/timeUtils';
import { useTheatres } from '@/hooks/useTheatres';

// DIRECT CLIENT IMPORTS
import { useCinemasStore } from '@/features/cinemas/stores/useCinemasStore';
import { useFilteredTheatres } from '@/features/cinemas/hooks/useCinemasData';
import { useCinemaAnalytics } from '@/features/cinemas/hooks/useCinemaAnalytics';
import { RegionBreakdownCard } from '@/features/cinemas/components/RegionBreakdownCard';
import { ChainDistributionCard } from '@/features/cinemas/components/ChainDistributionCard';
import { TheatreSidebar } from '@/features/cinemas/components/TheatreSidebar';
import { GlobalTheatreSearch } from '@/features/cinemas/components/GlobalTheatreSearch';
import { TheatreTable } from '@/features/cinemas/components/TheatreTable';
import type { Theatre } from '@/features/cinemas/types';

function CinemasPageContent() {
  // 1. DATA LAYER
  const { theatres, runs, loading: isLoading, refetch, metrics } = useTheatres();
  const store = useCinemasStore();

  // 2. ANALYTICS LAYER (Refactored to Hook)
  const { merchantBreakdown, regionBreakdown } = useCinemaAnalytics(theatres, store.selectedMerchant);

  // 3. FILTER & SYNC LAYER (Refactored to Hook with Auto-Sync)
  const sortedTheatres = useFilteredTheatres(
    theatres,
    store.searchTerm,
    store.selectedMerchant,
    store.selectedRegion,
    store.sortByName,
    store.sortByCity,
    store.sortByCapacity,
    getRegion,
    store.setFilteredTheatreIds
  );

  // 4. PRESENTATION LOGIC
  const mapTheatres = useMemo(
    () => sortedTheatres.filter((t: Theatre) => t.lat && t.lng && !isNaN(t.lat) && !isNaN(t.lng)),
    [sortedTheatres]
  );

  const lastUpdated = runs[0]?.timestamp ? formatWIBShort(runs[0].timestamp) : null;

  // Scroll visibility
  useEffect(() => {
    const handleScroll = () => store.setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [store]);

  const scrollToTop = useCallback(() => window.scrollTo({ top: 0, behavior: 'smooth' }), []);

  // Loading skeleton
  if (isLoading && theatres.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground animate-pulse p-10">
        <div className="grid grid-cols-[280px_1fr] gap-10">
            <div className="bg-muted/20 h-[600px] rounded-xl" />
            <div className="space-y-6">
                <div className="bg-muted/20 h-12 rounded-xl w-64" />
                <div className="bg-muted/20 h-[450px] rounded-2xl" />
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <div className="px-6 pt-6">
        <PageHeader
          title="Cinema Intelligence"
          description="National Physical Asset Registry & Market Coverage"
          icon={<MapPin className="w-6 h-6 text-primary" />}
          metrics={metrics}
          onRefresh={refetch}
          isRefreshing={isLoading}
        />
      </div>

      <main className="px-6 pb-10 pt-2">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10 items-start">
          
          {/* CONTROL RAIL */}
          <aside className="sticky top-6 h-[calc(100vh-3rem)] overflow-y-auto no-scrollbar">
            <TheatreSidebar 
                totalCount={theatres.length}
                merchantBreakdown={merchantBreakdown}
                regionBreakdown={regionBreakdown}
                selectedMerchant={store.selectedMerchant}
                selectedRegion={store.selectedRegion}
                onMerchantChange={store.setSelectedMerchant}
                onRegionChange={store.setSelectedRegion}
                onMapCenter={store.setMapCenter}
                onClearFilters={store.clearFilters}
            />
          </aside>

          {/* ASSET REGISTRY */}
          <div className="space-y-6">
            <div className="sticky top-0 z-20 py-4 bg-background/95 backdrop-blur-md border-b border-border/50 -mx-2 px-2">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="hidden xl:flex flex-col shrink-0">
                        <h2 className="text-sm font-black uppercase tracking-tighter leading-none">Cinema Intelligence</h2>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Registry Control</span>
                    </div>
                    <GlobalTheatreSearch 
                        value={store.searchTerm}
                        onChange={store.setSearchTerm}
                        isLoading={isLoading}
                        resultsCount={sortedTheatres.length}
                    />
                </div>
            </div>

            <Card className="overflow-hidden border shadow-lg rounded-2xl aspect-[21/9] min-h-[500px] relative group">
                <IndonesiaMap
                    theatres={mapTheatres}
                    selectedTheatre={store.selectedTheatre}
                    onTheatreSelect={store.setSelectedTheatre}
                    onViewDetails={(theatre: Theatre) => window.open(`/cinemas/${theatre.theatre_id}`, '_blank')}
                    apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
                    lastUpdated={lastUpdated}
                    center={store.mapCenter}
                >
                    <div className="absolute top-4 right-4 z-10 w-64 pointer-events-none">
                        <div className="pointer-events-auto bg-background/60 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-right-4 duration-700">
                            <ChainDistributionCard theatres={theatres} regionBreakdown={regionBreakdown} />
                        </div>
                    </div>
                    <div className="absolute bottom-4 right-4 z-10 w-64 pointer-events-none">
                        <div className="pointer-events-auto bg-background/60 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            <RegionBreakdownCard regionBreakdown={regionBreakdown} totalTheatres={theatres.length} />
                        </div>
                    </div>
                </IndonesiaMap>
            </Card>

            <div className="pt-4">
                <div className="flex items-center gap-3 mb-6 px-1">
                    <div className="h-4 w-1 bg-primary rounded-full shadow-sm" />
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">Physical Asset Registry</h2>
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

export default function CinemasPage() {
  return (
    <ErrorBoundary>
      <CinemasPageContent />
    </ErrorBoundary>
  );
}
