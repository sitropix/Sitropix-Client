import { useEffect } from "react";
import { Link } from "react-router-dom";
import { SxButton } from "@/components/sx/Button";
import { SxLogo } from "@/components/sx/Logo";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Not found · Sitropix";
  }, []);

  return (
    <div
      data-sx-root
      className="flex min-h-screen flex-col bg-[var(--surface-page)] text-[var(--text-primary)]"
    >
      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <div className="mx-auto flex h-16 max-w-[var(--container-wide)] items-center px-6">
          <SxLogo to="/" size="md" />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <div className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            404 · Page not found
          </div>
          <h1 className="mt-3 font-display text-sx-3xl font-medium leading-tight text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)]">
            That page doesn't exist.
          </h1>
          <p className="mt-4 text-sx-md leading-relaxed text-[var(--text-secondary)]">
            The URL might be old, or the page may have moved. Head back to your dashboard or the home page.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/">
              <SxButton variant="primary">Back to home</SxButton>
            </Link>
            <Link to="/dashboard">
              <SxButton variant="secondary">Open dashboard</SxButton>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-card)] py-8">
        <div className="mx-auto flex max-w-[var(--container-wide)] flex-wrap items-center justify-between gap-3 px-6 text-sx-xs text-[var(--text-tertiary)]">
          <span>© {new Date().getFullYear()} Sitropix</span>
          <span>
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
        </div>
      </footer>
    </div>
  );
}
