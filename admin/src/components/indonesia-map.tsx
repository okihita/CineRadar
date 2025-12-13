'use client';

import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { Theatre } from '@/types';

interface IndonesiaMapProps {
    theatres: Theatre[];
    selectedTheatre: Theatre | null;
    onTheatreSelect: (theatre: Theatre) => void;
    apiKey: string;
}

export function IndonesiaMap({ theatres, selectedTheatre, onTheatreSelect, apiKey }: IndonesiaMapProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        if (selectedTheatre) {
            setSelectedId(selectedTheatre.theatre_id);
        } else {
            setSelectedId(null);
        }
    }, [selectedTheatre]);

    const validTheatres = theatres.filter(t => typeof t.lat === 'number' && typeof t.lng === 'number');

    return (
        <div className="relative w-full aspect-[2/1] bg-muted/30 rounded-lg overflow-hidden border border-border/50">
            <APIProvider apiKey={apiKey}>
                <Map
                    mapId="DEMO_MAP_ID"
                    defaultCenter={{ lat: -2.5, lng: 118 }}
                    defaultZoom={5}
                    gestureHandling={'greedy'}
                    mapTypeControl={false}
                    style={{ width: '100%', height: '100%' }}
                >
                    {validTheatres.map((theatre) => (
                        <AdvancedMarker
                            key={theatre.theatre_id}
                            position={{ lat: theatre.lat!, lng: theatre.lng! }}
                            onClick={() => {
                                setSelectedId(theatre.theatre_id);
                                onTheatreSelect(theatre);
                            }}
                            title={theatre.name}
                        >
                            <Pin
                                background={
                                    theatre.merchant === 'XXI' ? '#f59e0b' :
                                        theatre.merchant === 'CGV' ? '#dc2626' :
                                            '#2563eb'
                                }
                                borderColor={'#ffffff'}
                                glyphColor={'#ffffff'}
                                scale={selectedId === theatre.theatre_id ? 1.2 : 0.8}
                            />
                        </AdvancedMarker>
                    ))}
                </Map>
            </APIProvider>
        </div>
    );
}
