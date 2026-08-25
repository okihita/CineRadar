import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="px-6 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-3.5 rounded" />
              <Skeleton className="h-2.5 w-24" />
            </div>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-2 w-16" />
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="rounded-xl border border-border/50 p-6">
        <Skeleton className="h-3 w-48 mb-6" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>

      {/* Recent days nav */}
      <div className="rounded-xl border border-border/50 p-3">
        <div className="flex gap-1">
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 h-10 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}
