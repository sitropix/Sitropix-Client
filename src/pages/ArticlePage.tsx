import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Skeleton } from "@/components/Skeleton";
import { fetchKBArticleById, fetchKBCategories } from "@/services/supportApi";
import type { KBArticle, KBCategory } from "@/types/support";
import { SxButton } from "@/components/sx/Button";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
    new Date(iso),
  );
}

export function ArticlePage() {
  const { id } = useParams();
  const [article, setArticle] = useState<KBArticle | null>(null);
  const [category, setCategory] = useState<KBCategory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!id) return;
      setLoading(true);
      try {
        const a = await fetchKBArticleById(id);
        const cats = await fetchKBCategories();
        const cat = cats.find((c) => c.id === a.categoryId) ?? null;
        if (!cancelled) {
          setArticle(a);
          setCategory(cat);
          document.title = `${a.title} · Sitropix`;
        }
      } catch {
        if (!cancelled) {
          setArticle(null);
          setCategory(null);
          document.title = "Article not found · Sitropix";
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div data-sx-root className="flex flex-col gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-[min(100%,36rem)] max-w-xl" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (!article) {
    return (
      <div
        data-sx-root
        className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center"
      >
        <h1 className="font-display text-sx-xl font-medium text-[var(--text-primary)]">
          Article not found
        </h1>
        <p className="mt-2 text-sx-sm text-[var(--text-secondary)]">
          The link may be outdated. Head back to the help center.
        </p>
        <div className="mt-6">
          <Link to="/help">
            <SxButton variant="secondary">Back to help center</SxButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article data-sx-root className="flex flex-col gap-6">
      <Link
        to={category ? `/help?cat=${category.id}` : "/help"}
        className="inline-flex items-center gap-1 self-start font-mono text-sx-xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] hover:text-[var(--text-brand)]"
      >
        ← {category?.name ?? "Help center"}
      </Link>

      <header className="border-b border-[var(--border-subtle)] pb-6">
        <h1 className="font-display text-sx-xl font-medium leading-tight text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)] sm:text-sx-2xl">
          {article.title}
        </h1>
        <p className="mt-4 max-w-3xl text-sx-md leading-relaxed text-[var(--text-secondary)]">
          {article.excerpt}
        </p>
        <div className="mt-5 flex flex-wrap gap-6 font-mono text-sx-xs text-[var(--text-tertiary)]">
          <span>Updated {formatDate(article.updatedAt)}</span>
          <span>{article.readTimeMinutes} min read</span>
        </div>
      </header>

      <div className="max-w-3xl whitespace-pre-wrap text-sx-md leading-relaxed text-[var(--text-primary)]">
        {article.content}
      </div>

      <aside className="mt-2 rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-5">
        <p className="font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
          Still stuck?
        </p>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          Open a ticket and we'll take it from there.
        </p>
        <div className="mt-4">
          <Link to="/tickets/new">
            <SxButton variant="secondary">Open a ticket</SxButton>
          </Link>
        </div>
      </aside>
    </article>
  );
}
