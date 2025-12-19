'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IndonesiaMap } from '@/components/indonesia-map';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageHeader } from '@/components/PageHeader';
import { ArrowUp, ArrowDown, X, ChevronUp, Download, MapPin } from 'lucide-react';
import { REGION_CITIES, getRegion } from '@/lib/regions';
import { useTheatres, useFilters } from '@/hooks';
import { formatWIBShort } from '@/lib/timeUtils';

const ITEMS_PER_PAGE = 15;

// Region center coordinates for map panning
const REGION_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  'Jawa': { lat: -7.0, lng: 110.4, zoom: 7 },
  'Sumatera': { lat: -0.5, lng: 101.5, zoom: 6 },
  'Kalimantan': { lat: 0.5, lng: 116.5, zoom: 6 },
  'Sulawesi': { lat: -2.0, lng: 121.0, zoom: 6.5 },
  'Bali & NT': { lat: -8.5, lng: 118.0, zoom: 7 },
  'Papua & Maluku': { lat: -3.5, lng: 135.0, zoom: 6 },
  'all': { lat: -2.5, lng: 118, zoom: 5.5 },
};

// Helper function for SVG donut arc
function describeDonutArc(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  const toRad = (deg: number) => (deg - 90) * Math.PI / 180;
  const outerStart = { x: cx + outerR * Math.cos(toRad(startAngle)), y: cy + outerR * Math.sin(toRad(startAngle)) };
  const outerEnd = { x: cx + outerR * Math.cos(toRad(endAngle)), y: cy + outerR * Math.sin(toRad(endAngle)) };
  const innerStart = { x: cx + innerR * Math.cos(toRad(endAngle)), y: cy + innerR * Math.sin(toRad(endAngle)) };
  const innerEnd = { x: cx + innerR * Math.cos(toRad(startAngle)), y: cy + innerR * Math.sin(toRad(startAngle)) };
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${outerStart.x} ${outerStart.y} A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerStart.x} ${innerStart.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y} Z`;
}

// Helper function to highlight search matches
function highlightText(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm.trim()) return text;
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{part}</mark> : part
  );
}

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

  // Local UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTheatre, setSelectedTheatre] = useState<typeof theatres[0] | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
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

  // Last updated timestamp (WIB)
  const lastUpdated = runs[0]?.timestamp
    ? formatWIBShort(runs[0].timestamp)
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
      <div className="min-h-screen bg-background text-foreground animate-pulse">
        {/* Skeleton KPI Ticker */}
        <div className="bg-muted/50 border-b h-10"></div>

        {/* Skeleton Header */}
        <header className="border-b h-14"></header>

        <main className="container mx-auto px-4 py-4 space-y-4">
          {/* Skeleton Map */}
          <div className="rounded-lg border bg-card">
            <div className="py-3 px-4 border-b">
              <div className="h-4 w-24 bg-muted rounded"></div>
            </div>
            <div className="p-4">
              <div className="h-[300px] bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <span className="text-sm text-muted-foreground">Loading map...</span>
                </div>
              </div>
            </div>
          </div>

          {/* Skeleton Filters */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex gap-4">
              <div className="h-8 w-24 bg-muted rounded"></div>
              <div className="h-8 w-20 bg-muted rounded"></div>
              <div className="h-8 w-20 bg-muted rounded"></div>
              <div className="h-8 w-20 bg-muted rounded"></div>
            </div>
          </div>

          {/* Skeleton Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-lg border bg-card">
              <div className="py-3 px-4 border-b flex justify-between">
                <div className="h-4 w-20 bg-muted rounded"></div>
                <div className="h-8 w-40 bg-muted rounded"></div>
              </div>
              <div className="p-4 space-y-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-4 w-32 bg-muted rounded"></div>
                    <div className="h-6 w-16 bg-muted rounded"></div>
                    <div className="h-4 w-24 bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border bg-card h-[300px]"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Page Header - no mock badge since this uses real Firestore data */}
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
          {/* Map Card - no vertical padding */}
          <Card className="overflow-hidden py-0">
            <IndonesiaMap
              theatres={mapTheatres}
              selectedTheatre={selectedTheatre}
              onTheatreSelect={setSelectedTheatre}
              apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
              lastUpdated={lastUpdated}
              center={mapCenter}
            />
          </Card>

          {/* KPI Cards - Vertical Stack */}
          <div className="flex flex-col gap-3">
            {/* Cities with Region Pie Chart */}
            <Card className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">THEATRES BY REGION</p>
                <p className="text-lg font-bold font-mono">{theatres.length}</p>
              </div>
              {/* Region Donut Chart - Full Width */}
              <div className="flex justify-center mb-3">
                <svg width="160" height="160" viewBox="0 0 160 160">
                  {(() => {
                    const total = theatres.length || 1;
                    let currentAngle = 0;
                    const colors = ['#0d9488', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#65a30d']; // Region colors: teal, purple, pink, orange, cyan, lime
                    return regionBreakdown.map((r, i) => {
                      const ratio = r.count / total;
                      const angle = ratio * 360;
                      const path = describeDonutArc(80, 80, 65, 40, currentAngle, currentAngle + angle);
                      currentAngle += angle;
                      return (
                        <g key={r.name}>
                          <path d={path} fill={colors[i % colors.length]} className="cursor-help">
                            <title>{r.name}: {r.count} ({Math.round(ratio * 100)}%)</title>
                          </path>
                        </g>
                      );
                    });
                  })()}
                  <text x="80" y="85" textAnchor="middle" className="fill-foreground text-lg font-bold">{theatres.length}</text>
                </svg>
              </div>
              {/* Legend - Single Column with Full Names */}
              <div className="space-y-1 text-xs">
                {regionBreakdown.map((r, i) => {
                  const colors = ['#0d9488', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#65a30d']; // Region colors
                  const percentage = Math.round((r.count / (theatres.length || 1)) * 100);
                  return (
                    <div key={r.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colors[i] }}></span>
                        <span className="text-muted-foreground">{r.name}</span>
                      </div>
                      <span className="font-mono text-foreground">{r.count} <span className="text-muted-foreground">({percentage}%)</span></span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Chain Distribution by Region - consolidated */}
            <Card className="p-3">
              <p className="text-xs text-muted-foreground mb-2">CHAIN DISTRIBUTION</p>
              <div className="space-y-2.5 text-sm">
                {/* Indonesia total row */}
                {(() => {
                  const xxi = theatres.filter(t => t.merchant === 'XXI').length;
                  const cgv = theatres.filter(t => t.merchant === 'CGV').length;
                  const cine = theatres.filter(t => t.merchant === 'Cinépolis').length;
                  const total = theatres.length || 1;
                  return (
                    <div className="pb-2 border-b border-border/50 mb-2">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-foreground">Indonesia</span>
                        <span className="font-mono font-bold">{theatres.length}</span>
                      </div>
                      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted mb-1.5">
                        <div style={{ width: `${(xxi / total) * 100}%`, backgroundColor: '#CFAB7A' }} />
                        <div style={{ width: `${(cgv / total) * 100}%`, backgroundColor: '#E03C31' }} />
                        <div style={{ width: `${(cine / total) * 100}%`, backgroundColor: '#002069' }} />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#CFAB7A' }}>XXI: {xxi}</span>
                        <span style={{ color: '#E03C31' }}>CGV: {cgv}</span>
                        <span style={{ color: '#002069' }}>Cinépolis: {cine}</span>
                      </div>
                    </div>
                  );
                })()}
                {/* Region rows */}
                {regionBreakdown.map(r => {
                  const regionTheatres = theatres.filter(t => getRegion(t.city) === r.name);
                  const xxi = regionTheatres.filter(t => t.merchant === 'XXI').length;
                  const cgv = regionTheatres.filter(t => t.merchant === 'CGV').length;
                  const cine = regionTheatres.filter(t => t.merchant === 'Cinépolis').length;
                  const total = regionTheatres.length || 1;
                  return (
                    <div key={r.name}>
                      <div className="flex justify-between mb-0.5 text-xs">
                        <span className="text-muted-foreground">{r.name}</span>
                        <div className="flex gap-2 font-mono">
                          <span style={{ color: '#CFAB7A' }}>{xxi}</span>
                          <span style={{ color: '#E03C31' }}>{cgv}</span>
                          <span style={{ color: '#002069' }}>{cine}</span>
                          <span className="text-foreground font-medium">{r.count}</span>
                        </div>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                        <div style={{ width: `${(xxi / total) * 100}%`, backgroundColor: '#CFAB7A' }} />
                        <div style={{ width: `${(cgv / total) * 100}%`, backgroundColor: '#E03C31' }} />
                        <div style={{ width: `${(cine / total) * 100}%`, backgroundColor: '#002069' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>


          </div>
        </div>

        {/* Filters - below map */}
        <Card>
          <CardContent className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-4">
              {/* Filters - Stacked layout */}
              <div className="flex flex-col gap-2 flex-1">
                {/* Chain Filter Row */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground w-14">CHAIN</label>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center cursor-pointer text-xs px-3 py-1 rounded-md font-medium transition-colors ${selectedMerchant === 'all' ? 'bg-foreground text-background' : 'border hover:bg-muted'}`}
                      onClick={() => setSelectedMerchant('all')}
                    >
                      All ({theatres.length})
                    </span>
                    {merchantBreakdown.map((m) => {
                      const colors: Record<string, { bg: string; border: string }> = {
                        'XXI': { bg: '#CFAB7A', border: '#CFAB7A' },
                        'CGV': { bg: '#E03C31', border: '#E03C31' },
                        'Cinépolis': { bg: '#002069', border: '#002069' },
                      };
                      const c = colors[m.name] || { bg: '#666', border: '#666' };
                      const isSelected = selectedMerchant === m.name;
                      return (
                        <span
                          key={m.name}
                          className="inline-flex items-center cursor-pointer text-xs px-3 py-1 rounded-md font-medium transition-colors"
                          style={{
                            backgroundColor: isSelected ? c.bg : 'transparent',
                            color: isSelected ? 'white' : 'inherit',
                            border: `1px solid ${c.border}`,
                          }}
                          onClick={() => setSelectedMerchant(m.name)}
                        >
                          {m.name} ({m.count})
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Region Filter Row */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground w-14">REGION</label>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center cursor-pointer text-xs px-3 py-1 rounded-md font-medium transition-colors ${selectedRegion === 'all' ? 'bg-foreground text-background' : 'border hover:bg-muted'}`}
                      onClick={() => {
                        setSelectedRegion('all');
                        setMapCenter(REGION_CENTERS['all']);
                      }}
                    >
                      All
                    </span>
                    {regionBreakdown.map((r, i) => {
                      const colors = ['#0d9488', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#65a30d'];
                      const c = colors[i];
                      const isSelected = selectedRegion === r.name;
                      return (
                        <span
                          key={r.name}
                          className="inline-flex items-center cursor-pointer text-xs px-3 py-1 rounded-md font-medium transition-colors"
                          style={{
                            backgroundColor: isSelected ? c : 'transparent',
                            color: isSelected ? 'white' : 'inherit',
                            border: `1px solid ${c}`,
                          }}
                          onClick={() => {
                            setSelectedRegion(r.name);
                            setMapCenter(REGION_CENTERS[r.name] || REGION_CENTERS['all']);
                          }}
                        >
                          {r.name} ({r.count})
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Clear button with X icon */}
              {(selectedMerchant !== 'all' || selectedRegion !== 'all' || searchTerm) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 flex-shrink-0"
                  onClick={() => {
                    setSelectedMerchant('all');
                    setSelectedRegion('all');
                    setSearchTerm('');
                    setMapCenter(REGION_CENTERS['all']);
                  }}
                >
                  <X className="w-3 h-3" />
                  Clear
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
                            <p className="font-medium text-sm">{highlightText(theatre.name, searchTerm)}</p>
                          </TableCell>
                          <TableCell className="py-2">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: theatre.merchant === 'XXI' ? 'rgba(207,171,122,0.2)' :
                                  theatre.merchant === 'CGV' ? 'rgba(224,60,49,0.2)' : 'rgba(0,32,105,0.2)',
                                color: theatre.merchant === 'XXI' ? '#CFAB7A' :
                                  theatre.merchant === 'CGV' ? '#E03C31' : '#002069'
                              }}
                            >
                              {theatre.merchant}
                            </span>
                          </TableCell>
                          <TableCell className="py-2">
                            <p className="text-sm">{highlightText(theatre.city, searchTerm)}</p>
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

          {/* Detail Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-16" data-details-panel>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Theatre Details</CardTitle>
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
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm">Click a theatre on the map or table to view details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

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
