import { Skeleton } from "@/components/Skeleton";

interface PageLoadingStateProps {
  variant?: "dashboard" | "admin" | "default";
}

function PortalLoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-10 w-10" role="status" aria-label={label}>
        <div className="absolute inset-0 rounded-full border-2 border-outline-variant/40" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent-gold" />
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{label}</p>
    </div>
  );
}

export function PageLoadingState({ variant = "default" }: PageLoadingStateProps) {
  if (variant === "admin") {
    return (
      <div className="space-y-8 animate-fade-up">
        <header className="space-y-2">
          <Skeleton className="h-8 w-48" variant="admin" />
          <Skeleton className="h-4 w-80" variant="admin" />
        </header>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((k) => (
            <article key={k} className="rounded-xl border border-[#24292E] bg-[#15191C] p-5 space-y-3">
              <Skeleton className="h-3 w-24" variant="admin" />
              <Skeleton className="h-7 w-20" variant="admin" />
              <Skeleton className="h-3 w-16" variant="admin" />
            </article>
          ))}
        </section>
        <section className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-[#24292E] bg-[#15191C] lg:col-span-8">
            <div className="border-b border-[#24292E] px-5 py-4">
              <Skeleton className="h-5 w-32" variant="admin" />
            </div>
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((k) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-lg border border-[#24292E] bg-[#1C2126] px-4 py-3"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" variant="admin" />
                    <Skeleton className="h-3 w-16" variant="admin" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-lg" variant="admin" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-xl border border-[#24292E] bg-[#15191C] p-5 space-y-4">
              <Skeleton className="h-4 w-28" variant="admin" />
              <div className="space-y-3">
                <Skeleton className="h-1.5 w-full rounded-full" variant="admin" />
                <Skeleton className="h-1.5 w-full rounded-full" variant="admin" />
              </div>
            </div>
            <div className="rounded-xl border border-[#24292E] bg-[#15191C] p-5 space-y-3">
              <Skeleton className="h-4 w-24" variant="admin" />
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((k) => (
                  <Skeleton key={k} className="h-10 rounded-lg" variant="admin" />
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
        <section className="relative overflow-hidden rounded-lg border ink-border-8 bg-surface-container-low p-8 soft-shadow-xl sm:p-10">
          <div className="space-y-3">
            <Skeleton className="h-3 w-28" variant="portal" />
            <Skeleton className="h-9 w-[min(100%,20rem)]" variant="portal" />
            <Skeleton className="h-4 w-[min(100%,24rem)]" variant="portal" />
          </div>
        </section>
        <section className="space-y-4">
          <div className="px-1">
            <Skeleton className="h-7 w-36" variant="portal" />
            <Skeleton className="mt-2 h-4 w-64" variant="portal" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((k) => (
              <div
                key={k}
                className="flex flex-col gap-4 rounded-lg border ink-border-8 bg-surface-container-lowest p-6"
              >
                <Skeleton className="h-10 w-10 shrink-0 rounded-lg" variant="portal" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" variant="portal" />
                  <Skeleton className="h-3 w-full" variant="portal" />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="rounded-lg border ink-border-8 bg-surface-container-lowest p-6 soft-shadow-xl lg:col-span-5">
            <Skeleton className="h-6 w-40" variant="portal" />
            <Skeleton className="mt-4 h-24 w-full" variant="portal" />
            <Skeleton className="mt-4 h-11 w-full rounded-lg" variant="portal" />
          </div>
          <div className="lg:col-span-7">
            <Skeleton className="h-4 w-32" variant="portal" />
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((k) => (
                <Skeleton key={k} className="h-14 w-full rounded-lg" variant="portal" />
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <PortalLoadingSpinner />
    </div>
  );
}

export function FullPageLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative h-12 w-12" role="status" aria-label="Loading your dashboard">
          <div className="absolute inset-0 rounded-full border-2 border-outline-variant/40" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent-gold" />
        </div>
        <div>
          <p className="font-body text-sm font-medium text-on-surface">Loading your dashboard</p>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Please wait a moment…</p>
        </div>
      </div>
    </div>
  );
}
