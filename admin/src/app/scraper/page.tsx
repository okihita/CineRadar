/**
 * Scraper Monitor Page - Redirect to today
 * This page redirects to /scraper/{today} for shareable URLs
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Helper to get today's date in YYYY-MM-DD format using Jakarta timezone
const getTodayDate = () => {
    const now = new Date();
    const wibOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    };
    const parts = new Intl.DateTimeFormat('en-CA', wibOptions).formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    return `${year}-${month}-${day}`;
};

export default function ScraperPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace(`/scraper/${getTodayDate()}`);
    }, [router]);

    return (
        <div className="p-6">
            <div className="h-48 bg-muted animate-pulse rounded-lg" />
        </div>
    );
}
