'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { IndonesiaMap } from '@/components/indonesia-map';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ArrowUp, ArrowDown, X, ChevronUp, Download } from 'lucide-react';
import { REGION_CITIES, getRegion } from '@/lib/regions';
import { useTheatres, useFilters, useDarkMode } from '@/hooks';

const ITEMS_PER_PAGE = 15;

function DashboardContent() {
  // Data from custom hooks
  const { theatres, runs, loading } = useTheatres();
  const {
    searchTerm, setSearchTerm,
    selectedMerchant, setSelectedMerchant,
    selectedRegion, setSelectedRegion,
    sortByName, sortByCity,
    toggleNameSort, toggleCitySort,
    sortedTheatres, mapTheatres,
  } = useFilters({ theatres });
  const { darkMode, setDarkMode } = useDarkMode(false);

  // Local UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTheatre, setSelectedTheatre] = useState<typeof theatres[0] | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Derived data
  const merchants = useMemo(() => [...new Set(theatres.map(t => t.merchant))].filter(Boolean).sort(), [theatres]);
  const cities = useMemo(() => [...new Set(theatres.map(t => t.city))].sort(), [theatres]);

  // Filter theatres by merchant first (for region count calculation)
  const merchantFilteredTheatres = useMemo(() =>
    selectedMerchant === 'all' ? theatres : theatres.filter(t => t.merchant === selectedMerchant),
    [theatres, selectedMerchant]
  );

  // Region breakdown - filtered by selected chain
  const regionBreakdown = Object.keys(REGION_CITIES).map(region => ({
    name: region,
    count: merchantFilteredTheatres.filter(t => getRegion(t.city) === region).length
  })).filter(r => r.count > 0).sort((a, b) => b.count - a.count);

  const othersCount = merchantFilteredTheatres.filter(t => getRegion(t.city) === 'Others').length;
  if (othersCount > 0) {
    regionBreakdown.push({ name: 'Others', count: othersCount });
  }

  // Merchant breakdown
  const merchantBreakdown = merchants.map(m => ({
    name: m,
    count: theatres.filter(t => t.merchant === m).length,
  })).sort((a, b) => b.count - a.count);

  // Region breakdown per merchant (for hover stats)
  const getMerchantRegionBreakdown = (merchantName: string) => {
    const merchantTheatres = theatres.filter(t => t.merchant === merchantName);
    const regions: Record<string, number> = {};
    merchantTheatres.forEach(t => {
      const region = getRegion(t.city);
      regions[region] = (regions[region] || 0) + 1;
    });
    return Object.entries(regions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name}: ${Math.round((count / merchantTheatres.length) * 100)}%`)
      .join(', ');
  };

  // Last updated timestamp
  const lastUpdated = runs[0]?.timestamp
    ? new Date(runs[0].timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    : null;

  // Pagination
  const totalPages = Math.ceil(sortedTheatres.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedTheatres = sortedTheatres.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  // Scroll listener for back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to selected theatre row when marker is clicked
  useEffect(() => {
    if (selectedTheatre && tableContainerRef.current) {
      const row = tableContainerRef.current.querySelector(`[data-theatre-id="${selectedTheatre.theatre_id}"]`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedTheatre]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Export filtered theatres to CSV
  const exportToCSV = useCallback(() => {
    const headers = ['Name', 'Chain', 'City', 'Region', 'Address'];
    const rows = sortedTheatres.map(t => [
      t.name,
      t.merchant,
      t.city,
      getRegion(t.city),
      t.address || ''
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `theatres-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedTheatres]);

  // Keyboard navigation for table
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!paginatedTheatres.length) return;

    const currentIndex = selectedTheatre
      ? paginatedTheatres.findIndex(t => t.theatre_id === selectedTheatre.theatre_id)
      : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < paginatedTheatres.length - 1 ? currentIndex + 1 : 0;
      setSelectedTheatre(paginatedTheatres[nextIndex]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : paginatedTheatres.length - 1;
      setSelectedTheatre(paginatedTheatres[prevIndex]);
    } else if (e.key === 'Enter' && selectedTheatre) {
      // Scroll details panel into view
      const detailsPanel = document.querySelector('[data-details-panel]');
      if (detailsPanel) {
        detailsPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [paginatedTheatres, selectedTheatre]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Loading theatre data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* KPI Ticker Bar */}
      <div className="bg-muted/50 border-b text-xs">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-6 overflow-x-auto">
          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="font-mono font-medium">{theatres.length}</span>
              <span className="text-muted-foreground">THEATRES</span>
            </div>
            <div className="h-3 w-px bg-border"></div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium">{cities.length}</span>
              <span className="text-muted-foreground">CITIES</span>
            </div>
            <div className="h-3 w-px bg-border"></div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium">{merchants.length}</span>
              <span className="text-muted-foreground">CHAINS</span>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            {merchantBreakdown.map(m => (
              <div
                key={m.name}
                className="flex items-center gap-1.5 cursor-help"
                title={`${m.name} distribution: ${getMerchantRegionBreakdown(m.name)}`}
              >
                <span className={`w-2 h-2 rounded-sm ${m.name === 'XXI' ? 'bg-amber-500' :
                  m.name === 'CGV' ? 'bg-red-500' :
                    'bg-blue-500'
                  }`}></span>
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground">{Math.round((m.count / theatres.length) * 100)}%</span>
              </div>
            ))}
            {lastUpdated && (
              <>
                <div className="h-3 w-px bg-border"></div>
                <span className="text-muted-foreground">Updated: {lastUpdated}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <svg className="w-4 h-4 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">CineRadar</h1>
                <p className="text-xs text-muted-foreground">Theatre Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Theme</span>
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 space-y-4">
        {/* Full Width Map */}
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Coverage Map</CardTitle>
              {selectedTheatre && (
                <div className="flex items-center gap-2 text-xs">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded font-medium ${selectedTheatre.merchant === 'XXI' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                    selectedTheatre.merchant === 'CGV' ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                      'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                    }`}>
                    {selectedTheatre.merchant}
                  </span>
                  <span className="font-medium">{selectedTheatre.name}</span>
                  <span className="text-muted-foreground">• {selectedTheatre.city}</span>
                  <button
                    onClick={() => setSelectedTheatre(null)}
                    className="text-muted-foreground hover:text-foreground ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <IndonesiaMap
              theatres={mapTheatres}
              selectedTheatre={selectedTheatre}
              onTheatreSelect={setSelectedTheatre}
              apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
            />
          </CardContent>
        </Card>

        {/* Filters - below map */}
        <Card>
          <CardContent className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-4">
              {/* Chain Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">CHAIN</label>
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant={selectedMerchant === 'all' ? 'default' : 'outline'}
                    className="cursor-pointer text-xs px-3 py-1"
                    onClick={() => setSelectedMerchant('all')}
                  >
                    All ({theatres.length})
                  </Badge>
                  {merchantBreakdown.map((m) => (
                    <span
                      key={m.name}
                      className={`inline-flex items-center cursor-pointer text-xs px-3 py-1 rounded-md font-medium transition-colors ${selectedMerchant === m.name
                        ? m.name === 'XXI' ? 'bg-amber-500 text-white'
                          : m.name === 'CGV' ? 'bg-red-600 text-white'
                            : 'bg-blue-600 text-white'
                        : 'border hover:bg-muted'
                        }`}
                      onClick={() => setSelectedMerchant(m.name)}
                    >
                      {m.name} ({m.count})
                    </span>
                  ))}
                </div>
              </div>

              <div className="h-4 w-px bg-border hidden sm:block"></div>

              {/* Region Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">REGION</label>
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant={selectedRegion === 'all' ? 'default' : 'outline'}
                    className="cursor-pointer text-xs px-3 py-1"
                    onClick={() => setSelectedRegion('all')}
                  >
                    All
                  </Badge>
                  {regionBreakdown.map((r) => (
                    <Badge
                      key={r.name}
                      variant={selectedRegion === r.name ? 'default' : 'outline'}
                      className="cursor-pointer text-xs px-3 py-1"
                      onClick={() => setSelectedRegion(r.name)}
                    >
                      {r.name} ({r.count})
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Clear button */}
              {(selectedMerchant !== 'all' || selectedRegion !== 'all' || searchTerm) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs ml-auto"
                  onClick={() => {
                    setSelectedMerchant('all');
                    setSelectedRegion('all');
                    setSearchTerm('');
                  }}
                >
                  Clear All
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Row: Table + Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Theatre Table */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-sm flex-shrink-0">
                    Theatres
                    <span className="font-normal text-muted-foreground ml-2">
                      {sortedTheatres.length} results
                    </span>
                  </CardTitle>
                  {/* Search - above table */}
                  <div className="relative max-w-xs">
                    <Input
                      placeholder="Search theatre, city..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8 text-sm pr-8"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={exportToCSV}
                    title="Export filtered results to CSV"
                  >
                    <Download className="w-3 h-3" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div
                  ref={tableContainerRef}
                  className="overflow-x-auto max-h-[500px] overflow-y-auto focus:outline-none"
                  tabIndex={0}
                  onKeyDown={handleKeyDown}
                >
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow className="text-xs">
                        <TableHead
                          className="pl-4 py-2 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={toggleNameSort}
                        >
                          <span className="inline-flex items-center gap-1">
                            Theatre
                            {sortByName === 'asc' && <ArrowUp className="w-3 h-3" />}
                            {sortByName === 'desc' && <ArrowDown className="w-3 h-3" />}
                          </span>
                        </TableHead>
                        <TableHead className="py-2">Chain</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 select-none py-2"
                          onClick={toggleCitySort}
                        >
                          <span className="inline-flex items-center gap-1">
                            City
                            {sortByCity === 'asc' && <ArrowUp className="w-3 h-3" />}
                            {sortByCity === 'desc' && <ArrowDown className="w-3 h-3" />}
                          </span>
                        </TableHead>
                        <TableHead className="text-right pr-4 py-2"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTheatres.length > 0 ? paginatedTheatres.map((theatre, index) => (
                        <TableRow
                          key={theatre.theatre_id}
                          data-theatre-id={theatre.theatre_id}
                          className={`cursor-pointer text-sm transition-colors ${selectedTheatre?.theatre_id === theatre.theatre_id
                            ? 'bg-primary/10 border-l-2 border-l-primary'
                            : index % 2 === 0
                              ? 'bg-transparent hover:bg-muted/50'
                              : 'bg-muted/20 hover:bg-muted/50'
                            }`}
                          onClick={() => setSelectedTheatre(theatre)}
                        >
                          <TableCell className="pl-4 py-2">
                            <p className="font-medium text-sm">{theatre.name}</p>
                          </TableCell>
                          <TableCell className="py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${theatre.merchant === 'XXI' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                              theatre.merchant === 'CGV' ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                                'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                              }`}>
                              {theatre.merchant}
                            </span>
                          </TableCell>
                          <TableCell className="py-2">
                            <p className="text-sm">{theatre.city}</p>
                            <p className="text-xs text-muted-foreground">{getRegion(theatre.city)}</p>
                          </TableCell>
                          <TableCell className="text-right pr-4 py-2">
                            <span className="text-xs text-muted-foreground">→</span>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-12">
                            <div className="text-muted-foreground">
                              <p className="text-sm font-medium mb-2">No theatres found</p>
                              <p className="text-xs mb-4">Try adjusting your filters or search term</p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  setSelectedMerchant('all');
                                  setSelectedRegion('all');
                                  setSearchTerm('');
                                }}
                              >
                                Clear all filters
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t text-xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      ←
                    </Button>
                    <span className="text-muted-foreground">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detail Panel - responsive bottom sheet on mobile */}
          <div className="lg:col-span-1 max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:z-40 max-lg:transition-transform max-lg:duration-300" style={{ transform: selectedTheatre ? 'translateY(0)' : 'translateY(100%)' }}>
            <Card className="sticky top-16 max-lg:rounded-b-none max-lg:border-b-0" data-details-panel>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Details</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {selectedTheatre ? (
                  <div className="space-y-4">
                    {/* Map */}
                    <div className="rounded-lg overflow-hidden border aspect-video">
                      <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&q=${encodeURIComponent(selectedTheatre.name + ' ' + selectedTheatre.city + ' Indonesia')}`}
                      />
                    </div>

                    {/* Info */}
                    <div>
                      <h3 className="font-semibold">{selectedTheatre.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${selectedTheatre.merchant === 'XXI' ? 'bg-amber-500 text-white' :
                        selectedTheatre.merchant === 'CGV' ? 'bg-red-600 text-white' :
                          'bg-blue-600 text-white'
                        }`}>
                        {selectedTheatre.merchant}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Address</p>
                        <p className="text-sm">{selectedTheatre.address || '-'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">City</p>
                          <p className="text-sm font-medium">{selectedTheatre.city}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Region</p>
                          <p className="text-sm font-medium">{getRegion(selectedTheatre.city)}</p>
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => window.open(
                        selectedTheatre.place_id
                          ? `https://www.google.com/maps/place/?q=place_id:${selectedTheatre.place_id}`
                          : `https://www.google.com/maps?q=${selectedTheatre.lat},${selectedTheatre.lng}`,
                        '_blank'
                      )}
                    >
                      Open in Maps →
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Select a theatre</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Scrape History Section */}
        <Card className="mt-6">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Scrape History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="text-right">Movies</TableHead>
                  <TableHead className="text-right">Cities</TableHead>
                  <TableHead className="text-right">Theatres</TableHead>
                  <TableHead className="text-right">Pre-sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                      No scrape history yet
                    </TableCell>
                  </TableRow>
                ) : (
                  runs.map((run) => (
                    <TableRow key={run.id || run.timestamp}>
                      <TableCell className="font-mono text-xs">{run.date}</TableCell>
                      <TableCell>
                        <Badge variant={run.status === 'success' ? 'default' : run.status === 'partial' ? 'secondary' : 'destructive'} className="text-xs">
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{run.movies}</TableCell>
                      <TableCell className="text-right font-mono">{run.cities}</TableCell>
                      <TableCell className="text-right font-mono">
                        {run.theatres_success}/{run.theatres_total}
                      </TableCell>
                      <TableCell className="text-right font-mono">{run.presales || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Back to Top Button */}
      {showBackToTop && (
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
export default function AdminDashboard() {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
}
