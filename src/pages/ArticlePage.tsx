import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Skeleton } from "@/components/Skeleton";
import { fetchKBArticleById, fetchKBCategories } from "@/services/supportApi";
import type { KBArticle, KBCategory } from "@/types/support";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(iso));
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
        }
      } catch {
        if (!cancelled) {
          setArticle(null);
          setCategory(null);
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
      <div className="space-y-4">
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
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <h1 className="text-xl font-semibold text-white">Article not found</h1>
        <p className="mt-2 text-sm text-ink-muted">The link may be outdated.</p>
        <Link to="/kb" className="mt-6 inline-block text-sm font-semibold text-brand-lime underline">
          Back to knowledge base
        </Link>
      </div>
    );
  }

  return (
    <article className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Home", to: "/dashboard" },
          { label: "Knowledge base", to: "/kb" },
          { label: category?.name ?? "Article", to: category ? `/kb?cat=${category.id}` : "/kb" },
          { label: article.title },
        ]}
      />
      <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-lime">
          {category?.name ?? "Guide"}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{article.title}</h1>
        <p className="mt-4 max-w-3xl text-base text-ink-muted">{article.excerpt}</p>
        <dl className="mt-6 flex flex-wrap gap-6 text-sm text-ink-muted">
          <div>
            <dt className="text-ink-subtle">Updated</dt>
            <dd className="mt-1 font-medium text-white">{formatDate(article.updatedAt)}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">Reading time</dt>
            <dd className="mt-1 font-medium text-white">{article.readTimeMinutes} minutes</dd>
          </div>
        </dl>
      </header>

      <div className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
        {article.content}
      </div>

      <div className="rounded-2xl border border-brand-lime/20 bg-brand-lime/[0.06] p-6">
        <p className="text-sm font-semibold text-white">Still stuck?</p>
        <p className="mt-1 text-sm text-ink-muted">We can pull diagnostics on your behalf — include timestamps.</p>
        <Link
          to="/ticket"
          className="mt-4 inline-flex rounded-full bg-brand-lime px-5 py-2 text-sm font-semibold text-canvas transition hover:bg-brand-lime-dim"
        >
          Contact support
        </Link>
      </div>
    </article>
  );
}
