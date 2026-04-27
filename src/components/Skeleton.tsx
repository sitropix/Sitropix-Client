export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg bg-white/[0.06] animate-pulse ${className}`}
      aria-hidden
    />
  );
}

export function TicketRowSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1016]/95 shadow-glass ring-1 ring-white/[0.04] md:flex">
      <div className="min-w-0 flex-1 space-y-3 border-b border-white/10 p-5 md:border-b-0 md:border-r md:p-6">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-[min(100%,24rem)]" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="w-full shrink-0 space-y-2 bg-black/25 p-5 md:w-[220px] md:border-l md:border-white/10 md:p-6">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

export function ArticleCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="mb-2 h-5 w-4/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="mt-1 h-3 w-5/6" />
    </div>
  );
}
