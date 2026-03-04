import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useBookmarks(user: User | null) {
  const queryClient = useQueryClient();

  const { data: bookmarkIds = [] } = useQuery({
    queryKey: ["bookmarks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("article_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((b: any) => b.article_id as string);
    },
  });

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

  return {
    bookmarkIds,
    bookmarkedArticles,
    toggleBookmark: toggle.mutate,
    isBookmarked: (id: string) => bookmarkIds.includes(id),
  };
}
