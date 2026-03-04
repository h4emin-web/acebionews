import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useBookmarks(user: User | null) {
  const queryClient = useQueryClient();

  const { data: bookmarks = [] } = useQuery({
    queryKey: ["bookmarks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // memo 컬럼 있으면 같이 가져오고, 없으면(SQL 미실행) fallback
      const { data, error } = await supabase
        .from("bookmarks")
        .select("article_id, memo")
        .eq("user_id", user!.id);
      if (error) {
        const { data: fallback, error: fallbackError } = await supabase
          .from("bookmarks")
          .select("article_id")
          .eq("user_id", user!.id);
        if (fallbackError) throw fallbackError;
        return (fallback || []).map((b: any) => ({ article_id: b.article_id, memo: "" }));
      }
      return (data || []).map((b: any) => ({ article_id: b.article_id, memo: b.memo || "" }));
    },
  });

  const bookmarkIds = bookmarks.map((b) => b.article_id);
  const memoMap: Record<string, string> = Object.fromEntries(
    bookmarks.map((b) => [b.article_id, b.memo || ""])
  );

  const { data: bookmarkedArticles = [] } = useQuery({
    queryKey: ["bookmarked-articles", bookmarkIds],
    enabled: bookmarkIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select("*")
        .in("id", bookmarkIds)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const toggle = useMutation({
    mutationFn: async (articleId: string) => {
      if (!user) throw new Error("Not logged in");
      const isBookmarked = bookmarkIds.includes(articleId);
      if (isBookmarked) {
        await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("article_id", articleId);
      } else {
        await supabase.from("bookmarks").insert({ user_id: user.id, article_id: articleId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["bookmarked-articles"] });
    },
  });

  const saveMemo = useMutation({
    mutationFn: async ({ articleId, memo }: { articleId: string; memo: string }) => {
      if (!user) throw new Error("Not logged in");
      await supabase
        .from("bookmarks")
        .update({ memo })
        .eq("user_id", user.id)
        .eq("article_id", articleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] });
    },
  });

  return {
    bookmarkIds,
    bookmarkedArticles,
    memoMap,
    toggleBookmark: toggle.mutate,
    isBookmarked: (id: string) => bookmarkIds.includes(id),
    saveMemo: (articleId: string, memo: string) => saveMemo.mutate({ articleId, memo }),
  };
}
