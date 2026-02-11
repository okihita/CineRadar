'use client';

import { Film } from 'lucide-react';
import { MovieDatabaseList } from '@/features/movie-database';

export default function MovieDatabasePage() {
    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <Film className="w-6 h-6 text-primary" />
                    <h1 className="text-2xl font-bold">Movie Database</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    Browse all movies — currently showing and past titles
                </p>
            </div>

            <MovieDatabaseList />
        </div>
    );
}
