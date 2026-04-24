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
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-[min(100%,28rem)] max-w-md" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-7 w-20 rounded-full" />
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
