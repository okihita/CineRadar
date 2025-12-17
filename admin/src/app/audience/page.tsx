'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Users, BarChart3, TrendingUp } from 'lucide-react';

export default function AudiencePage() {
    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <Users className="w-6 h-6 text-primary" />
                    <h1 className="text-2xl font-bold">Audience Intelligence</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    Seat occupancy, trends, and audience analytics
                </p>
            </div>

            {/* Coming Soon */}
            <Card className="max-w-2xl mx-auto mt-20">
                <CardContent className="pt-12 pb-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                        <BarChart3 className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                        Audience Intelligence will show seat occupancy rates, booking trends,
                        and popularity metrics for movies and theatres.
                    </p>

                    <div className="grid grid-cols-3 gap-4 max-w-md mx-auto text-left">
                        <div className="p-3 rounded-lg bg-muted/50">
                            <TrendingUp className="w-4 h-4 text-primary mb-2" />
                            <p className="text-xs font-medium">Occupancy Rates</p>
                            <p className="text-xs text-muted-foreground">Per showtime</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                            <BarChart3 className="w-4 h-4 text-primary mb-2" />
                            <p className="text-xs font-medium">Top Movies</p>
                            <p className="text-xs text-muted-foreground">By demand</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                            <Users className="w-4 h-4 text-primary mb-2" />
                            <p className="text-xs font-medium">Peak Times</p>
                            <p className="text-xs text-muted-foreground">By theatre</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
