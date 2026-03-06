import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useUserKeywords(user: User | null) {
  const queryClient = useQueryClient();

  const { data: keywords = [] } = useQuery<string[]>({
    queryKey: ["user-keywords", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_keywords")
        .select("keyword")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return (data || []).map((r) => r.keyword);
    },
  });

  const addKeyword = useMutation({
    mutationFn: async (keyword: string) => {
      const { error } = await supabase
        .from("user_keywords")
        .insert({ user_id: user!.id, keyword });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-keywords", user?.id] }),
  });

  const removeKeyword = useMutation({
    mutationFn: async (keyword: string) => {
      const { error } = await supabase
        .from("user_keywords")
        .delete()
        .eq("user_id", user!.id)
        .eq("keyword", keyword);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-keywords", user?.id] }),
  });

  // 뉴스가 등록 키워드와 매칭되는지 확인
  const getMatchedKeywords = (newsKeywords: string[], title: string, summary: string): string[] => {
    if (!keywords.length) return [];
    const text = (title + " " + summary).toLowerCase();
    return keywords.filter((kw) =>
      newsKeywords.some((nk) => nk.toLowerCase().includes(kw.toLowerCase())) ||
      text.includes(kw.toLowerCase())
    );
  };

  return {
    keywords,
    addKeyword: (kw: string) => addKeyword.mutate(kw),
    removeKeyword: (kw: string) => removeKeyword.mutate(kw),
    getMatchedKeywords,
  };
}
