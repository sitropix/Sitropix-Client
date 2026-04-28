import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AISuggestionsPanel } from "@/components/AISuggestionsPanel";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ArticleCardSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { useKnowledgeBase } from "@/hooks/useKnowledgeBase";
import type { KBArticle } from "@/types/support";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

function ArticleCard({ article, categoryName }: { article: KBArticle; categoryName: string }) {
  return (
    <Link
      to={`/kb/article/${article.id}`}
      className="group block rounded-2xl border border-zinc-300 bg-white p-6 transition hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-50 hover:shadow-lift"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{categoryName}</p>
      <h3 className="mt-2 text-lg font-semibold text-zinc-900 group-hover:text-zinc-700">{article.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{article.excerpt}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
        <span>Updated {formatDate(article.updatedAt)}</span>
        <span>{article.readTimeMinutes} min read</span>
      </div>
    </Link>
  );
}

export function KnowledgeBasePage() {
  const [params] = useSearchParams();
  const qParam = params.get("q") ?? "";
  const catParam = params.get("cat") ?? undefined;

  const { categories, articles, loading, error, load } = useKnowledgeBase();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(catParam);
  const [localQ, setLocalQ] = useState(qParam);

  useEffect(() => {
    setSelectedCategory(catParam);
  }, [catParam]);

  useEffect(() => {
    setLocalQ(qParam);
  }, [qParam]);

  useEffect(() => {
    void load(selectedCategory);
  }, [load, selectedCategory]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const visibleArticles = useMemo(() => {
    const needle = localQ.trim().toLowerCase();
    if (!needle) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(needle) ||
        a.excerpt.toLowerCase().includes(needle) ||
        (categoryNameById.get(a.categoryId) ?? "").toLowerCase().includes(needle),
    );
  }, [articles, localQ, categoryNameById]);

  const totalArticleCount = useMemo(
    () => categories.reduce((sum, c) => sum + c.articleCount, 0),
    [categories],
  );

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Knowledge base" }]} />
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Knowledge base</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Browse by category for faster answers — many questions are solved without opening a ticket.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl border border-zinc-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Categories</p>
          <ul className="mt-3 space-y-1">
            <li>
              <button
                type="button"
                onClick={() => setSelectedCategory(undefined)}
                className={[
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                  selectedCategory ? "text-zinc-600 hover:bg-zinc-100" : "bg-zinc-100 text-zinc-900",
                ].join(" ")}
              >
                All articles
                <span className="text-xs text-zinc-500">{totalArticleCount || articles.length}</span>
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  className={[
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                    selectedCategory === c.id ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-100",
                  ].join(" ")}
                >
                  {c.name}
                  <span className="text-xs text-zinc-500">{c.articleCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-md">
              <label htmlFor="kb-search" className="sr-only">
                Search articles
              </label>
              <input
                id="kb-search"
                value={localQ}
                onChange={(e) => setLocalQ(e.target.value)}
                placeholder="Filter articles…"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400/35"
              />
            </div>
            {error && (
              <button
                type="button"
                onClick={() => void load(selectedCategory)}
                className="text-sm font-semibold text-zinc-700 underline"
              >
                Retry load
              </button>
            )}
          </div>
          <AISuggestionsPanel query={localQ} />

          {loading && (
            <div className="grid gap-4 md:grid-cols-2">
              <ArticleCardSkeleton />
              <ArticleCardSkeleton />
            </div>
          )}

          {!loading && visibleArticles.length === 0 && (
            <EmptyState
              title="No articles found"
              description="Try another keyword or clear filters — we are expanding this library weekly."
              action={{ label: "Submit a ticket", href: "/ticket" }}
            />
          )}

          {!loading && visibleArticles.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleArticles.map((a) => (
                <ArticleCard key={a.id} article={a} categoryName={categoryNameById.get(a.categoryId) ?? "Guides"} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
