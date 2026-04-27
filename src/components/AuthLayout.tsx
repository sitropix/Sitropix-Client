import { Link, Outlet } from "react-router-dom";
import { Logo } from "@/components/Logo";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-white/10 px-4 py-4 sm:px-6">
        <Link to="/" className="inline-flex w-fit rounded-lg outline-none ring-brand-lime/40 transition hover:opacity-90 focus-visible:ring-2">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-12">
        <Outlet />
      </main>
      <footer className="mt-auto border-t border-white/[0.07] bg-black/20">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="text-sm font-semibold text-white">Sitropix</p>
          <p className="mt-1 max-w-md text-xs text-ink-muted">Premium support for teams shipping in the US and globally.</p>
        </div>
      </footer>
    </div>
  );
}
