import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useReadArticles(user: User | null) {
  const queryClient = useQueryClient();

  const { data: readIds = [] } = useQuery<string[]>({
    queryKey: ["read-articles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("read_articles")
        .select("article_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((r) => r.article_id);
    },
  });

  const markRead = useMutation({
    mutationFn: async (articleId: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("read_articles")
        .upsert({ user_id: user.id, article_id: articleId });
      if (error) throw error;
    },
    onSuccess: (_data, articleId) => {
      queryClient.setQueryData(["read-articles", user?.id], (old: string[] = []) =>
        old.includes(articleId) ? old : [...old, articleId]
      );
    },
  });

  return {
    readIds,
    isRead: (id: string) => readIds.includes(id),
    markRead: (id: string) => markRead.mutate(id),
  };
}
