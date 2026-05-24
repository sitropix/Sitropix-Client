import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AISuggestionsPanel } from "@/components/AISuggestionsPanel";
import { ArticleCardSkeleton } from "@/components/Skeleton";
import { useKnowledgeBase } from "@/hooks/useKnowledgeBase";
import type { KBArticle } from "@/types/support";
import { SxButton } from "@/components/sx/Button";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxInput } from "@/components/sx/Input";
import { SxPageHeader } from "@/components/sx/PageHeader";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

function ArticleCard({
  article,
  categoryName,
}: {
  article: KBArticle;
  categoryName: string;
}) {
  return (
    <Link
      to={`/help/${article.id}`}
      className="group block rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 transition-all duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-sx-md"
    >
      <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
        {categoryName}
      </p>
      <h3 className="mt-2 font-ui text-sx-md font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-brand-700)]">
        {article.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-sx-sm leading-relaxed text-[var(--text-secondary)]">
        {article.excerpt}
      </p>
      <div className="mt-4 flex items-center justify-between font-mono text-sx-xs text-[var(--text-tertiary)]">
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
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    catParam,
  );
  const [localQ, setLocalQ] = useState(qParam);

  useEffect(() => {
    document.title = "Help · Sitropix";
  }, []);

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
    <div data-sx-root className="flex flex-col gap-6">
      <SxPageHeader
        title="Help center"
        description="Browse by category for faster answers — most questions are solved without opening a ticket."
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Categories
          </p>
          <ul className="mt-3 space-y-1">
            <li>
              <button
                type="button"
                onClick={() => setSelectedCategory(undefined)}
                className={[
                  "flex w-full items-center justify-between rounded-sx-md px-3 py-2 text-left font-ui text-sx-sm font-medium transition",
                  selectedCategory
                    ? "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                    : "bg-[var(--color-brand-50)] text-[var(--color-brand-700)] font-semibold",
                ].join(" ")}
              >
                All articles
                <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
                  {totalArticleCount || articles.length}
                </span>
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  className={[
                    "flex w-full items-center justify-between rounded-sx-md px-3 py-2 text-left font-ui text-sx-sm font-medium transition",
                    selectedCategory === c.id
                      ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)] font-semibold"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]",
                  ].join(" ")}
                >
                  {c.name}
                  <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
                    {c.articleCount}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-md">
              <SxInput
                label="Search articles"
                hideLabel
                placeholder="Filter articles…"
                value={localQ}
                onChange={(e) => setLocalQ(e.target.value)}
              />
            </div>
            {error ? (
              <SxButton
                variant="ghost"
                size="sm"
                onClick={() => void load(selectedCategory)}
              >
                Retry
              </SxButton>
            ) : null}
          </div>

          <AISuggestionsPanel query={localQ} />

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <ArticleCardSkeleton />
              <ArticleCardSkeleton />
            </div>
          ) : null}

          {!loading && visibleArticles.length === 0 ? (
            <SxEmptyState
              title={`Nothing matches "${localQ}".`}
              description="Try a shorter search, or open a ticket and we'll help you find it."
              action={
                <Link to="/tickets/new">
                  <SxButton variant="primary">Open a ticket</SxButton>
                </Link>
              }
            />
          ) : null}

          {!loading && visibleArticles.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleArticles.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  categoryName={categoryNameById.get(a.categoryId) ?? "Guides"}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
