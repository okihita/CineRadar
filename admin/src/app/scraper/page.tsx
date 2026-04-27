/**
 * Scraper Monitor Page - Redirect to today
 * This page redirects to /scraper/{today} for shareable URLs
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { getTodayJakarta } from '@/lib/timeUtils';

export default function ScraperPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace(`/scraper/${getTodayJakarta()}`);
    }, [router]);

    return (
        <div className="p-6">
            <Skeleton className="h-48 w-full rounded-lg" />
        </div>
    );
}
