'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Map } from 'lucide-react';
import { ShowtimeSnapshot } from './ShowtimeTable';
import { useCityAggregation } from '../hooks/useCityAggregation';
import { CityPotentialRadar } from './CityPotentialRadar';

interface NationalSeatAllocationProps {
    showtimes: ShowtimeSnapshot[];
}

export function NationalSeatAllocation({ showtimes }: NationalSeatAllocationProps) {
    const cityStats = useCityAggregation(showtimes);

    if (showtimes.length === 0) return null;

    return (
        <Card className="mb-6">
            <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Map className="w-5 h-5 text-primary" />
                    National Allocation & Core Markets
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Map will go here in Step 3/4 */}
                <div className="w-full">
                    <CityPotentialRadar cityStats={cityStats} />
                </div>
            </CardContent>
        </Card>
    );
}
