/**
 * Cinema Intelligence Page
 * Theatre locations, chains, and coverage across Indonesia
 *
 * Refactored: 759 lines → ~150 lines
 * - Feature-based folder structure (/features/cinemas/)
 * - Zustand for UI state only (useCinemasStore)
 * - useTheatres() for server state (existing hook with caching)
 * - Extracted components: DonutChart, ChainDistributionCard, RegionBreakdownCard,
 *   TheatreFilters, TheatreTable, TheatreDetailPanel
 */
'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { ChevronUp, MapPin } from 'lucide-react';
import { IndonesiaMap } from '@/components/indonesia-map';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageHeader } from '@/components/PageHeader';
import { REGION_CITIES, getRegion, REGION_CENTERS } from '@/lib/regions';
import { formatWIBShort } from '@/lib/timeUtils';
import { useTheatres } from '@/hooks/useTheatres';

// Feature imports
import {
  useCinemasStore,
  useFilteredTheatres,
  RegionBreakdownCard,
  ChainDistributionCard,
  TheatreFilters,
  TheatreTable,
  TheatreDetailPanel,
  type Theatre,
} from '@/features/cinemas';

function CinemasPageContent() {
  // Server state (existing hook with caching)
  const { theatres, runs, loading: isLoading } = useTheatres();

  // UI state (Zustand)
  const store = useCinemasStore();

  // Derived data
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

  // Region breakdown
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
    getRegion
  );

  // Map theatres (filtered for display)
  const mapTheatres = useMemo(
    () =>
      sortedTheatres.filter(
        (t) => t.lat && t.lng && !isNaN(t.lat) && !isNaN(t.lng)
      ) as Theatre[],
    [sortedTheatres]
  );

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
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground animate-pulse">
        <div className="bg-muted/50 border-b h-10" />
        <header className="border-b h-14" />
        <main className="container mx-auto px-4 py-4 space-y-4">
          <div className="rounded-lg border bg-card">
            <div className="py-3 px-4 border-b">
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
            <div className="p-4">
              <div className="h-[300px] bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-sm text-muted-foreground">Loading map...</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Page Header */}
      <div className="px-6 pt-6">
        <PageHeader
          title="Cinema Intelligence"
          description="Theatre locations, chains, and coverage across Indonesia"
          icon={<MapPin className="w-6 h-6 text-primary" />}
          showMockBadge={false}
        />
      </div>

      <main className="px-6 pb-6 pt-4 space-y-4">
        {/* Map + KPI Cards Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
          {/* Map Card */}
          <Card className="overflow-hidden py-0">
            <IndonesiaMap
              theatres={mapTheatres}
              selectedTheatre={store.selectedTheatre}
              onTheatreSelect={store.setSelectedTheatre}
              apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
              lastUpdated={lastUpdated}
              center={store.mapCenter}
            />
          </Card>

          {/* KPI Cards - Vertical Stack */}
          <div className="flex flex-col gap-3">
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

        {/* Filters */}
        <TheatreFilters
          totalCount={theatres.length}
          merchantBreakdown={merchantBreakdown}
          regionBreakdown={regionBreakdown}
          selectedMerchant={store.selectedMerchant}
          selectedRegion={store.selectedRegion}
          searchTerm={store.searchTerm}
          onMerchantChange={store.setSelectedMerchant}
          onRegionChange={store.setSelectedRegion}
          onMapCenter={store.setMapCenter}
          onClearFilters={store.clearFilters}
        />

        {/* Table + Detail Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <TheatreTable
              theatres={sortedTheatres}
              totalCount={sortedTheatres.length}
              currentPage={store.currentPage}
              searchTerm={store.searchTerm}
              sortByName={store.sortByName}
              sortByCity={store.sortByCity}
              selectedTheatre={store.selectedTheatre}
              onPageChange={store.setCurrentPage}
              onSearchChange={store.setSearchTerm}
              onToggleNameSort={store.toggleNameSort}
              onToggleCitySort={store.toggleCitySort}
              onTheatreSelect={store.setSelectedTheatre}
              onClearFilters={store.clearFilters}
            />
          </div>
          <div className="lg:col-span-1">
            <TheatreDetailPanel
              theatre={store.selectedTheatre}
              apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
            />
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
