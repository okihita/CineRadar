'use client';

import { Card, CardContent } from '@/components/ui/card';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Skeleton Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="overflow-hidden border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3.5 h-3.5 rounded bg-muted/40 animate-pulse" />
                <div className="h-2.5 w-24 rounded bg-muted/30 animate-pulse" />
              </div>
              <div className="h-7 w-20 rounded bg-muted/40 animate-pulse mb-2" />
              <div className="h-2 w-16 rounded bg-muted/20 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Skeleton Chart */}
      <Card className="overflow-hidden border-border/50">
        <CardContent className="p-6">
          <div className="h-3 w-48 rounded bg-muted/30 animate-pulse mb-6" />
          <div className="h-[300px] rounded-xl bg-muted/10 animate-pulse" />
        </CardContent>
      </Card>
      {/* Skeleton Quick Nav */}
      <Card className="overflow-hidden border-border/50">
        <CardContent className="p-3">
          <div className="flex gap-1">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="flex-1 h-10 rounded-md bg-muted/20 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
