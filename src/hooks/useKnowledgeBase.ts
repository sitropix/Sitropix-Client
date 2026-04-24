import { useCallback, useState } from "react";
import { fetchKBArticles, fetchKBCategories } from "@/services/supportApi";
import type { KBArticle, KBCategory } from "@/types/support";

export function useKnowledgeBase() {
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (categoryId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [cats, arts] = await Promise.all([
        fetchKBCategories(),
        fetchKBArticles(categoryId),
      ]);
      setCategories(cats);
      setArticles(arts);
    } catch {
      setError("Unable to load the knowledge base.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { categories, articles, loading, error, load };
}
