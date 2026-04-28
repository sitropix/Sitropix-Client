import { Skeleton } from "@/components/Skeleton";

interface PageLoadingStateProps {
  variant?: "dashboard" | "admin" | "default";
}

export function PageLoadingState({ variant = "default" }: PageLoadingStateProps) {
  if (variant === "admin") {
    return (
      <div className="space-y-8 animate-fade-up">
        <header className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </header>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((k) => (
            <article key={k} className="rounded-xl border border-[#24292E] bg-[#15191C] p-5 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-16" />
            </article>
          ))}
        </section>
        <section className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-[#24292E] bg-[#15191C] lg:col-span-8">
            <div className="border-b border-[#24292E] px-5 py-4">
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((k) => (
                <div key={k} className="flex items-center justify-between rounded-lg border border-[#24292E] bg-[#1C2126] px-4 py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-xl border border-[#24292E] bg-[#15191C] p-5 space-y-4">
              <Skeleton className="h-4 w-28" />
              <div className="space-y-3">
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            </div>
            <div className="rounded-xl border border-[#24292E] bg-[#15191C] p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((k) => (
                  <Skeleton key={k} className="h-10 rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (variant === "dashboard") {
    return (
      <div className="space-y-8 animate-fade-up">
        <Skeleton className="h-4 w-40" />
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c1016]/90 p-8">
          <div className="space-y-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-80" />
            <Skeleton className="h-4 w-96" />
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#0c1016]/90">
          <div className="border-b border-white/10 px-6 py-5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((k) => (
              <div key={k} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#0c1016]/90 p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-10 w-48 rounded-full" />
          </div>
        </section>
        <section className="space-y-3">
          <Skeleton className="h-5 w-20" />
          <div className="space-y-2">
            {[0, 1, 2].map((k) => (
              <Skeleton key={k} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand-lime" />
        </div>
        <p className="text-sm text-ink-muted">Loading...</p>
      </div>
    </div>
  );
}

export function FullPageLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand-lime" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-white">Loading your dashboard</p>
          <p className="mt-1 text-xs text-ink-muted">Please wait a moment...</p>
        </div>
      </div>
    </div>
  );
}
