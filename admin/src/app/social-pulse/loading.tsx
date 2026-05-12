import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-7 w-52" />
      <Skeleton className="h-3 w-64" />
      <div className="rounded-xl border border-border/50 p-4">
        <div className="flex gap-4 mb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    </div>
  )
}
