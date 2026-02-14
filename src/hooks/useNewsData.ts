import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  source: string;
  region: string;
  country: string;
  date: string;
  url: string;
  api_keywords: string[];
  category: string;
};

export type RegulatoryNotice = {
  id: string;
  title: string;
  date: string;
  type: string;
  source: string;
  url: string;
  related_apis: string[];
};

export function useNewsArticles(year: number, month: number) {
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endMonth = month + 2 > 12 ? 1 : month + 2;
  const endYear = month + 2 > 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  return useQuery({
    queryKey: ["news-articles", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select("*")
        .gte("date", startDate)
        .lt("date", endDate)
        .order("date", { ascending: false });

      if (error) throw error;
      return (data || []) as NewsArticle[];
    },
  });
}

// Search: get last 6 months of news matching a keyword
export function useSearchNews(keyword: string) {
  return useQuery({
    queryKey: ["search-news", keyword],
    enabled: !!keyword,
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const startDate = sixMonthsAgo.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("news_articles")
        .select("*")
        .gte("date", startDate)
        .contains("api_keywords", [keyword])
        .order("date", { ascending: false });

      if (error) throw error;
      return (data || []) as NewsArticle[];
    },
  });
}

export function useRegulatoryNotices(source: string) {
  return useQuery({
    queryKey: ["regulatory-notices", source],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regulatory_notices")
        .select("*")
        .eq("source", source)
        .order("date", { ascending: false })
        .limit(8);

      if (error) throw error;
      return (data || []) as RegulatoryNotice[];
    },
  });
}

export function useAllApiKeywords() {
  return useQuery({
    queryKey: ["all-api-keywords"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select("api_keywords");

      if (error) throw error;
      const allKw = new Set<string>();
      (data || []).forEach((row: any) => {
        (row.api_keywords || []).forEach((kw: string) => allKw.add(kw));
      });
      return Array.from(allKw).sort();
    },
  });
}
