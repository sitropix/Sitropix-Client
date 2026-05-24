import type { ReactNode } from "react";
import { SxLogo } from "@/components/sx/Logo";
import { useTheme } from "@/context/ThemeContext";

const PROMISES = [
  {
    title: "Send a ticket. Get it done.",
    body: "Describe what you want changed. We handle the copy, layout, photos and publishing.",
  },
  {
    title: "Fast, not flashy.",
    body: "Most edits land within a business day. Pro plans turn around the same day.",
  },
  {
    title: "Looks like you paid more.",
    body: "Typography-led, fast, accessible sites — even on the Starter plan.",
  },
];

export function AuthShell({ children }: { children: ReactNode }) {
  const { isDark, toggleTheme } = useTheme();
  return (
    <div
      data-sx-root
      className="relative grid min-h-screen grid-cols-1 bg-[var(--surface-page)] text-[var(--text-primary)] lg:grid-cols-[1.05fr_1fr]"
    >
      {/* Left panel — brand */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[var(--color-brand-700)] p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 60% 50% at 0% 0%, rgba(242,106,71,0.18), transparent), radial-gradient(ellipse 80% 60% at 100% 100%, rgba(91,165,186,0.18), transparent)",
          }}
        />
        <div className="relative">
          <SxLogo to="/" size="lg" variant="brand" />
        </div>

        <div className="relative max-w-md">
          <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-white/70">
            Sitropix · Brand & Product Identity
          </p>
          <h2 className="mt-4 font-display text-[3rem] font-medium leading-[1.05] [letter-spacing:var(--tracking-tight)]">
            A website that just <em className="font-normal italic text-[var(--color-accent-300)]">works.</em>
          </h2>
          <p className="mt-4 max-w-sm text-sx-md leading-relaxed text-white/85">
            Managed websites for small businesses. Subscribe, send edits by ticket,
            and get a polished web presence — without ever touching a builder.
          </p>
        </div>

        <div className="relative grid gap-4">
          {PROMISES.map((p) => (
            <div
              key={p.title}
              className="rounded-sx-lg border border-white/12 bg-white/[0.06] p-4 backdrop-blur-sm"
            >
              <div className="font-ui text-sx-sm font-semibold text-white">{p.title}</div>
              <div className="mt-1 text-sx-xs leading-relaxed text-white/75">{p.body}</div>
            </div>
          ))}
        </div>

        <div className="relative text-sx-xs text-white/60">
          Maintained by{" "}
          <a
            href="https://www.draconx.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-white underline-offset-2 hover:underline"
          >
            DraconX
          </a>
          . Sitropix is a product of DraconX Inc.
        </div>
      </aside>

      {/* Right panel — content */}
      <main className="relative flex min-h-screen flex-col px-6 py-10 sm:px-10 sm:py-14 lg:px-16">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <SxLogo to="/" size="md" />
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="ml-auto inline-flex items-center gap-2 rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-1.5 font-ui text-sx-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
            aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
          >
            {isDark ? "Light mode" : "Dark mode"}
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4 text-sx-xs text-[var(--text-tertiary)]">
          <span>© {new Date().getFullYear()} Sitropix</span>
          <span className="lg:hidden">
            Maintained by{" "}
            <a
              href="https://www.draconx.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--text-brand)] hover:underline"
            >
              DraconX
            </a>
            .
          </span>
        </footer>
      </main>
    </div>
  );
}
