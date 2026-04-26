import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Perfectly mirrors the main Cinemas page structure.
 */
export function CinemasPageSkeleton() {
  return (
    <div className="min-h-screen bg-background p-10">
      <div className="grid grid-cols-[280px_1fr] gap-10">
          <Skeleton className="h-[600px] rounded-xl" />
          <div className="space-y-6">
              <Skeleton className="h-12 rounded-xl w-64" />
              <Skeleton className="h-[450px] rounded-2xl" />
          </div>
      </div>
    </div>
  );
}

/**
 * Perfectly mirrors the CinemaDetailView header card to prevent layout shift.
 * Matches exact padding (p-6), gaps (gap-6), and element heights.
 */
export function CinemaDetailSkeleton() {
  return (
    <Card className="shadow-lg border-primary/5 overflow-hidden bg-card/30 backdrop-blur-sm">
      <CardHeader className="p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2 flex-1">
            {/* Merchant + ID Row */}
            <div className="flex items-center gap-3 h-5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <div className="flex items-center gap-1.5 h-4">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            </div>
            
            {/* Title + Meta Row - Fixed min-height to match min-h-[2rem] */}
            <div className="flex items-baseline gap-3 min-h-[2rem] pt-1">
              <Skeleton className="h-7 w-[40%]" />
              <div className="flex items-center gap-3">
                <div className="w-1 h-1 rounded-full bg-muted opacity-20" />
                <Skeleton className="h-4 w-20" />
                <div className="w-1 h-1 rounded-full bg-muted opacity-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>

            {/* Address Row */}
            <div className="flex items-center gap-2 pt-1 h-4">
              <Skeleton className="h-3.5 w-3.5 rounded-sm" />
              <Skeleton className="h-3 w-20" />
              <div className="opacity-20">|</div>
              <Skeleton className="h-3 w-[50%] max-w-sm" />
            </div>
          </div>

          {/* Technical Telemetry + Buttons */}
          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="flex items-center gap-2 h-6">
              <Skeleton className="h-6 w-[180px] rounded-full" />
              <Skeleton className="h-6 w-10 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

/**
 * Perfectly mirrors a single Studio Card in TheatreStudiosList.
 */
export function StudioCardSkeleton() {
  return (
    <div className="flex flex-col h-[400px] border rounded-xl overflow-hidden bg-card/20 border-dashed animate-pulse">
      <div className="flex items-start justify-between p-4 bg-muted/5 border-b min-h-[72px]">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <div className="opacity-20">|</div>
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
      <div className="p-8 flex-1 flex flex-col items-center justify-center gap-4">
        <Skeleton className="w-[80%] h-[200px] rounded-lg opacity-40" />
        <div className="w-full space-y-2 mt-auto">
            <Skeleton className="h-3 w-[40%]" />
            <Skeleton className="h-3 w-[60%]" />
        </div>
      </div>
    </div>
  );
}
