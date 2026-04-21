'use client';

import React, { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import { Theatre } from '@/types';
import { ExternalLink, Navigation } from 'lucide-react';
import { createPieChartSvg } from '@/lib/mapUtils';

interface CinemaRegistryMapProps {
    theatres: Theatre[];
    selectedTheatre: Theatre | null;
    onTheatreSelect: (theatre: Theatre) => void;
    onViewDetails?: (theatre: Theatre) => void;
    apiKey: string;
    lastUpdated?: string | null;
    center?: { lat: number; lng: number; zoom: number } | null;
    children?: React.ReactNode;
}

// Inner component that uses the map
function ClusteredMarkers({ theatres, selectedTheatre, onTheatreSelect }: {
    theatres: Theatre[];
    selectedTheatre: Theatre | null;
    onTheatreSelect: (theatre: Theatre) => void;
}) {
    const map = useMap();
    // Wait for marker library to load before creating markers
    const markerLib = useMapsLibrary('marker');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markerLibRef = useRef<any>(null);
    const [clusterer, setClusterer] = useState<MarkerClusterer | null>(null);

    const selectedId = selectedTheatre?.theatre_id ?? null;

    // Keep markerLib in ref so renderer callback can access it
    useEffect(() => {
        markerLibRef.current = markerLib;
    }, [markerLib]);

    // Create clusterer once (after markerLib is ready)
    useEffect(() => {
        if (!map || !markerLib) return;

        const newClusterer = new MarkerClusterer({
            map,
            // Disable clustering at zoom 15+ so individual markers are visible
            algorithm: new SuperClusterAlgorithm({ radius: 80, maxZoom: 14 }),
            renderer: {
                render: ({ count, position, markers: clusterMarkers }) => {
                    // Count by chain
                    let xxi = 0, cgv = 0, cine = 0;
                    clusterMarkers?.forEach(m => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const theatre = (m as any)._theatre as Theatre;
                        if (theatre?.merchant === 'XXI') xxi++;
                        else if (theatre?.merchant === 'CGV') cgv++;
                        else cine++;
                    });

                    const size = Math.min(60, 35 + Math.log2(count) * 8);
                    const svg = createPieChartSvg(xxi, cgv, cine, count, size);
                    const tooltipText = `${count} theatres\nXXI: ${xxi} (${Math.round(xxi / count * 100)}%)\nCGV: ${cgv} (${Math.round(cgv / count * 100)}%)\nCinépolis: ${cine} (${Math.round(cine / count * 100)}%)`;
                    const content = createMarkerContent(svg, tooltipText);

                    // Use markerLib from ref (guaranteed available since we check in useEffect deps)
                    const lib = markerLibRef.current!;
                    const marker = new lib.AdvancedMarkerElement({
                        position,
                        content,
                        zIndex: 1000,
                    });

                    return marker;
                }
            }
        });

        setClusterer(newClusterer);
        return () => {
            newClusterer.clearMarkers();
            // MarkerClusterer cleanup - setMap is available but not in types
            (newClusterer as unknown as { setMap: (map: null) => void }).setMap(null);
        };
    }, [map, markerLib]);

    // Update markers when theatres change
    useEffect(() => {
        // Wait for both clusterer and marker library to be ready
        if (!clusterer || !map || !markerLib) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newMarkers: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markerRecord: Record<string, any> = {};

        theatres.forEach(theatre => {
            if (typeof theatre.lat !== 'number' || typeof theatre.lng !== 'number') return;

            const isSelected = selectedId === theatre.theatre_id;
            const color = theatre.merchant === 'XXI' ? '#CFAB7A' :
                theatre.merchant === 'CGV' ? '#E03C31' : '#002069';

            // Use markerLib.AdvancedMarkerElement (guaranteed to be loaded)
            const marker = new markerLib.AdvancedMarkerElement({
                position: { lat: theatre.lat, lng: theatre.lng },
                title: theatre.name,
                content: createPinContent(color, isSelected, markerLib),
            });

            // Store theatre data on marker
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (marker as any)._theatre = theatre;

            marker.addListener('click', () => onTheatreSelect(theatre));

            newMarkers.push(marker);
            markerRecord[theatre.theatre_id] = marker;
        });

        clusterer.clearMarkers();
        clusterer.addMarkers(newMarkers);

    }, [clusterer, theatres, selectedId, onTheatreSelect, map, markerLib]);

    return null;
}

function createMarkerContent(svg: string, tooltipText?: string): HTMLDivElement {
    const div = document.createElement('div');
    div.innerHTML = svg;
    div.style.cursor = 'pointer';
    div.style.position = 'relative';

    if (tooltipText) {
        // Create custom tooltip with 300ms delay
        const tooltip = document.createElement('div');
        tooltip.textContent = tooltipText;
        tooltip.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 11px;
            white-space: pre-line;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.15s ease, visibility 0.15s ease;
            transition-delay: 0s;
            pointer-events: none;
            z-index: 9999;
            min-width: 140px;
            text-align: left;
            margin-bottom: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        div.appendChild(tooltip);

        div.addEventListener('mouseenter', () => {
            tooltip.style.transitionDelay = '300ms';
            tooltip.style.opacity = '1';
            tooltip.style.visibility = 'visible';
        });
        div.addEventListener('mouseleave', () => {
            tooltip.style.transitionDelay = '0s';
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'hidden';
        });
    }

    return div;
}

// Create pin with Google Maps PinElement (native teardrop shape) + Clapperboard glyph
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createPinContent(color: string, isSelected: boolean, markerLib: any): HTMLElement {
    // Create clapperboard glyph SVG
    const glyphSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    glyphSvg.setAttribute('width', '16');
    glyphSvg.setAttribute('height', '16');
    glyphSvg.setAttribute('viewBox', '0 0 24 24');
    glyphSvg.setAttribute('fill', 'none');
    glyphSvg.setAttribute('stroke', 'white');
    glyphSvg.setAttribute('stroke-width', '2');
    glyphSvg.setAttribute('stroke-linecap', 'round');
    glyphSvg.setAttribute('stroke-linejoin', 'round');
    // Lucide Clapperboard path
    glyphSvg.innerHTML = `
        <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/>
        <path d="m6.2 5.3 3.1 3.9"/>
        <path d="m12.4 3.4 3.1 4"/>
        <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>
    `;

    // Use markerLib.PinElement for native teardrop shape
    const pin = new markerLib.PinElement({
        background: color,
        borderColor: '#ffffff',
        glyphColor: 'white',
        scale: isSelected ? 1.3 : 1.0,
    });

    // Modern way to set the glyph to avoid deprecation warning
    pin.glyph = glyphSvg;

    return pin.element;
}


// Map overlay: zoom indicator + last updated (top-left)
function MapOverlay({ lastUpdated }: { lastUpdated?: string | null }) {
    const map = useMap();
    const [zoom, setZoom] = useState(5.5);

    useEffect(() => {
        if (!map) return;
        const handler = () => setZoom(map.getZoom() || 5.5);
        map.addListener('zoom_changed', handler);
        handler();
    }, [map]);

    return (
        <div className="absolute top-2 left-2 flex flex-col gap-1">
            <div className="bg-background/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono text-muted-foreground border border-border/50">
                Zoom: {zoom.toFixed(1)}×
            </div>
            {lastUpdated && (
                <div className="bg-background/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-muted-foreground border border-border/50">
                    Updated: {lastUpdated}
                </div>
            )}
        </div>
    );
}

// Map controller for external center/zoom control
function MapController({ center }: { center?: { lat: number; lng: number; zoom: number } | null }) {
    const map = useMap();

    useEffect(() => {
        if (!map || !center) return;
        map.panTo({ lat: center.lat, lng: center.lng });
        map.setZoom(center.zoom);
    }, [map, center]);

    return null;
}

export function CinemaRegistryMap({ 
    theatres, 
    selectedTheatre, 
    onTheatreSelect, 
    onViewDetails, 
    apiKey, 
    lastUpdated,
    center,
    children 
}: CinemaRegistryMapProps) {

    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const checkDarkMode = () => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        };
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const handleGetDirections = (theatre: Theatre) => {
        const destination = theatre.place_id
            ? `place_id:${theatre.place_id}`
            : `${theatre.lat},${theatre.lng}`;
        window.open(
            `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
            '_blank'
        );
    };

    if (!apiKey) {
        return (
            <div className="w-full aspect-[2/1] bg-muted/30 flex items-center justify-center border border-dashed border-red-300 rounded-lg">
                <div className="text-center p-6 bg-background/80 backdrop-blur rounded-lg shadow-sm">
                    <div className="text-red-500 font-bold mb-2">Configuration Error</div>
                    <p className="text-sm text-gray-600 mb-2">Google Maps API Key is missing.</p>
                    <p className="text-xs text-gray-400 font-mono bg-gray-100 p-1.5 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full aspect-[2/1] bg-muted/30 overflow-hidden">
            <APIProvider apiKey={apiKey}>
                <Map
                    mapId="DEMO_MAP_ID"
                    defaultCenter={{ lat: -2.5, lng: 118 }}
                    defaultZoom={5.5}
                    gestureHandling={'greedy'}
                    mapTypeControl={false}
                    colorScheme={isDarkMode ? 'DARK' : 'LIGHT'}
                    style={{ width: '100%', height: '100%' }}
                >
                    <ClusteredMarkers
                        theatres={theatres}
                        selectedTheatre={selectedTheatre}
                        onTheatreSelect={onTheatreSelect}
                    />
                    <MapOverlay lastUpdated={lastUpdated} />
                    <MapController center={center} />
                    
                    {/* Floating Overlays */}
                    {children}

                    {/* Info Window with Quick Actions */}
                    {selectedTheatre && selectedTheatre.lat && selectedTheatre.lng && (
                        <InfoWindow
                            position={{ lat: selectedTheatre.lat, lng: selectedTheatre.lng }}
                            onCloseClick={() => onTheatreSelect(null as unknown as Theatre)}
                            pixelOffset={[0, -20]}
                        >
                            <div className="p-1 min-w-[240px] max-w-[300px]">
                                {/* Header: Chain badge + Name */}
                                <div className="flex items-start gap-1.5 mb-1">
                                    <span
                                        className="px-1.5 py-0.5 text-[10px] font-bold rounded text-white flex-shrink-0"
                                        style={{
                                            backgroundColor: selectedTheatre.merchant === 'XXI' ? '#CFAB7A' :
                                                selectedTheatre.merchant === 'CGV' ? '#E03C31' : '#002069'
                                        }}
                                    >
                                        {selectedTheatre.merchant}
                                    </span>
                                    <span className="font-semibold text-sm text-gray-900 leading-tight">{selectedTheatre.name}</span>
                                </div>

                                {/* Location: City + Address inline */}
                                <p className="text-[11px] text-gray-600 mb-1.5 line-clamp-2">
                                    {selectedTheatre.city}{selectedTheatre.address ? ` · ${selectedTheatre.address}` : ''}
                                </p>

                                {/* Room Types - inline, smaller */}
                                {selectedTheatre.room_types && selectedTheatre.room_types.length > 0 && (
                                    <div className="flex flex-wrap gap-0.5 mb-1.5">
                                        {selectedTheatre.room_types.slice(0, 5).map(type => (
                                            <span key={type} className="px-1 py-0.5 text-[9px] bg-gray-100 text-gray-600 rounded">
                                                {type}
                                            </span>
                                        ))}
                                        {selectedTheatre.room_types.length > 5 && (
                                            <span className="px-1 py-0.5 text-[9px] text-gray-400">
                                                +{selectedTheatre.room_types.length - 5}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Compact Action Buttons */}
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => onViewDetails?.(selectedTheatre)}
                                        className="flex-[1.5] flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-bold bg-primary text-white rounded hover:bg-primary/90 transition-colors uppercase tracking-tight"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Intelligence
                                    </button>
                                    <button
                                        onClick={() => handleGetDirections(selectedTheatre)}
                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                    >
                                        <Navigation className="w-3 h-3" />
                                        Directions
                                    </button>
                                    <button
                                        onClick={() => window.open(
                                            selectedTheatre.place_id
                                                ? `https://www.google.com/maps/place/?q=place_id:${selectedTheatre.place_id}`
                                                : `https://www.google.com/maps?q=${selectedTheatre.lat},${selectedTheatre.lng}`,
                                            '_blank'
                                        )}
                                        className="flex items-center justify-center px-2 py-1 text-[11px] font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                                        title="Open in Google Maps"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </InfoWindow>
                    )}
                </Map>
            </APIProvider>
        </div>
    );
}
