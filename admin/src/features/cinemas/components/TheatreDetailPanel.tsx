/**
 * Theatre Detail Panel component
 * Shows selected theatre information with map embed
 */
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getRegion } from '@/lib/regions';
import type { Theatre } from '../types';

interface TheatreDetailPanelProps {
    theatre: Theatre | null;
    apiKey: string;
}

export function TheatreDetailPanel({ theatre, apiKey }: TheatreDetailPanelProps) {
    const handleOpenInMaps = () => {
        if (!theatre) return;

        const url = theatre.place_id
            ? `https://www.google.com/maps/place/?q=place_id:${theatre.place_id}`
            : `https://www.google.com/maps?q=${theatre.lat},${theatre.lng}`;

        window.open(url, '_blank');
    };

    return (
        <Card className="sticky top-16" data-details-panel>
            <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Theatre Details</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
                {theatre ? (
                    <div className="space-y-4">
                        {/* Map embed */}
                        <div className="rounded-lg overflow-hidden border aspect-video">
                            <iframe
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                loading="lazy"
                                allowFullScreen
                                referrerPolicy="no-referrer-when-downgrade"
                                src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(
                                    theatre.name + ' ' + theatre.city + ' Indonesia'
                                )}`}
                            />
                        </div>

                        {/* Info */}
                        <div>
                            <h3 className="font-semibold">{theatre.name}</h3>
                            <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${theatre.merchant === 'XXI'
                                        ? 'bg-amber-500 text-white'
                                        : theatre.merchant === 'CGV'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-blue-600 text-white'
                                    }`}
                            >
                                {theatre.merchant}
                            </span>
                        </div>

                        <div className="space-y-2 text-sm">
                            <div>
                                <p className="text-xs text-muted-foreground">Address</p>
                                <p className="text-sm">{theatre.address || '-'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <p className="text-xs text-muted-foreground">City</p>
                                    <p className="text-sm font-medium">{theatre.city}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Region</p>
                                    <p className="text-sm font-medium">{getRegion(theatre.city)}</p>
                                </div>
                            </div>
                        </div>

                        <Button size="sm" className="w-full text-xs" onClick={handleOpenInMaps}>
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
    );
}
