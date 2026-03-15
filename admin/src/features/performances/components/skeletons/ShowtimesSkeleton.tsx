import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function ShowtimesSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 mt-6">
      {/* National Allocation Skeleton */}
      <Card className="mb-6 border-dashed">
        <CardHeader className="pb-4">
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm font-medium">
              Crunching national data across 80+ cities...
            </p>
            <p className="text-xs opacity-50">
              This may take a moment for massive blockbusters.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Showtime Table Skeleton */}
      <Card className="border-dashed">
        <CardHeader className="pb-4 border-b">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
