import Link from 'next/link';
import { FileQuestion, Film, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                <div className="relative bg-card border border-border p-6 rounded-2xl shadow-2xl rotate-3 transform transition-transform hover:rotate-0 duration-500">
                    <Film className="w-24 h-24 text-primary" />
                    <div className="absolute -bottom-3 -right-3 bg-destructive text-destructive-foreground p-2 rounded-lg shadow-lg rotate-12">
                        <FileQuestion className="w-8 h-8" />
                    </div>
                </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
                Scene Not Found
            </h1>

            <p className="text-xl text-muted-foreground max-w-md mb-8">
                The page you&apos;re looking for has been cut from the final edit. It might have been moved, deleted, or never existed in the script.
            </p>

            <div className="flex gap-4">
                <Button asChild size="lg" className="gap-2">
                    <Link href="/">
                        <Home className="w-4 h-4" />
                        Return to Dashboard
                    </Link>
                </Button>
            </div>

            <div className="mt-12 text-sm text-muted-foreground font-mono">
                Error Code: 404_MISSING_REEL
            </div>
        </div>
    );
}
