'use client';

import { useRouter } from 'next/navigation';
import { DailyStatsBanner } from './DailyStatsBanner';
import { MarketingMetadata } from '../types/social';

interface DailyPerformance {
    id: string;
    movie_id: string;
    title: string;
    date: string;
    total_showtimes: number;
    avg_occupancy_pct: number;
    total_seats: number;
    total_sold: number;
    cities: string[];
    marketing?: MarketingMetadata;
}

interface DailyStatsBannerWrapperProps {
    stats: DailyPerformance;
}

export function DailyStatsBannerWrapper({ stats }: DailyStatsBannerWrapperProps) {
    const router = useRouter();

    return (
        <DailyStatsBanner 
            stats={stats} 
            onMarketingUpdate={() => router.refresh()} 
        />
    );
}
