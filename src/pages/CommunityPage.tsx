import { useEffect } from "react";
import { Link } from "react-router-dom";
import { SxButton } from "@/components/sx/Button";
import { SxLogo } from "@/components/sx/Logo";

export function CommunityPage() {
  useEffect(() => {
    document.title = "Community · Sitropix";
  }, []);

  return (
    <div
      data-sx-root
      className="min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)]"
    >
      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <div className="mx-auto flex h-16 max-w-[var(--container-wide)] items-center justify-between px-6">
          <SxLogo to="/" size="md" />
          <nav className="flex items-center gap-2 text-sx-sm">
            <Link to="/login">
              <SxButton variant="ghost" size="sm">
                Sign in
              </SxButton>
            </Link>
            <Link to="/signup">
              <SxButton variant="primary" size="sm">
                Get started
              </SxButton>
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[var(--container-narrow)] px-6 py-16">
        <div className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Community
        </div>
        <h1 className="mt-3 font-display text-sx-3xl font-medium leading-tight text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)]">
          Community is on the way.
        </h1>
        <p className="mt-5 max-w-xl text-sx-md leading-relaxed text-[var(--text-secondary)]">
          We're building a small, moderated space for tips, examples, and release notes. While we get it ready, the help center covers the most common questions, and you can always open a ticket for anything specific to your site.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/help">
            <SxButton variant="secondary">Browse the help center</SxButton>
          </Link>
          <Link to="/tickets/new">
            <SxButton variant="primary">Open a ticket</SxButton>
          </Link>
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
