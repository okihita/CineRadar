'use client';

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Unhandled error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center p-8">
                <h2 className="text-xl font-semibold text-destructive mb-2">Something went wrong</h2>
                <p className="text-muted-foreground mb-4">{error.message}</p>
                <button
                    onClick={reset}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
