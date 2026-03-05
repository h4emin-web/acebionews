import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useBookmarks(user: User | null) {
  const queryClient = useQueryClient();

  const { data: bookmarks = [] } = useQuery({
    queryKey: ["bookmarks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("article_id, memo")
        .eq("user_id", user!.id);
      if (error) throw error;
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
    // DB 응답 전에 UI 먼저 업데이트 (낙관적 업데이트)
    onMutate: async (articleId: string) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks", user?.id] });
      const previous = queryClient.getQueryData(["bookmarks", user?.id]);
      const isBookmarked = bookmarkIds.includes(articleId);
      queryClient.setQueryData(["bookmarks", user?.id], (old: any[] = []) =>
        isBookmarked
          ? old.filter((b) => b.article_id !== articleId)
          : [...old, { article_id: articleId, memo: "" }]
      );
      return { previous };
    },
    onError: (_err, _articleId, context: any) => {
      // 실패시 원래대로 롤백
      queryClient.setQueryData(["bookmarks", user?.id], context?.previous);
    },
    onSettled: () => {
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
