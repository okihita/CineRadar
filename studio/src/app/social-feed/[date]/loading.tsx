import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Fixed header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-56 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <div className="grid grid-cols-6 gap-3 h-full">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/30 p-3 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-2 w-24" />
              <div className="space-y-2 mt-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
