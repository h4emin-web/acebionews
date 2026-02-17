import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

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
  related_keywords: string[];
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

export function useNewsArticles(year: number, month: number, day?: number | null) {
  // If a specific day is selected, show only that day
  // Otherwise show the whole month
  const startDate = day
    ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  
  const endDate = day
    ? (() => {
        const nextDay = new Date(year, month, day + 1);
        return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
      })()
    : (() => {
        const endMonth = month + 2 > 12 ? 1 : month + 2;
        const endYear = month + 2 > 12 ? year + 1 : year;
        return `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      })();

  return useQuery({
    queryKey: ["news-articles", year, month, day],
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

// Search: get last 6 months of news matching a keyword (DB)
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

// External news search via Firecrawl
export function useExternalNewsSearch(keyword: string) {
  return useQuery({
    queryKey: ["external-news", keyword],
    enabled: !!keyword,
    staleTime: 5 * 60 * 1000, // 5 min cache
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("search-external", {
        body: { keyword },
      });
      if (error) throw error;
      return data?.results || [];
    },
  });
}

// Ingredient profile via AI
export function useDrugInfo(keyword: string) {
  return useQuery({
    queryKey: ["drug-info", keyword],
    enabled: !!keyword,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("search-drug-info", {
        body: { keyword },
      });
      if (error) throw error;
      return data?.profile || null;
    },
  });
}

// MFDS domestic products (real data)
export function useMfdsProducts(keyword: string) {
  return useQuery({
    queryKey: ["mfds-products", keyword],
    enabled: !!keyword,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("scrape-mfds", {
        body: { keyword, type: "products" },
      });
      if (error) throw error;
      return data?.domesticProducts || [];
    },
  });
}

// MFDS DMF records (real data)
export function useMfdsDmf(keyword: string) {
  return useQuery({
    queryKey: ["mfds-dmf", keyword],
    enabled: !!keyword,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("scrape-mfds", {
        body: { keyword, type: "dmf" },
      });
      if (error) throw error;
      return data?.dmfRecords || [];
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

export type IndustryReport = {
  id: string;
  title: string;
  broker: string;
  date: string;
  report_url: string;
  pdf_url: string | null;
  views: number;
  summary: string | null;
  created_at: string;
};

export function useIndustryReports() {
  return useQuery({
    queryKey: ["industry-reports"],
    queryFn: async (): Promise<IndustryReport[]> => {
      const { data, error } = await supabase
        .from("industry_reports")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;
      return (data || []) as IndustryReport[];
    },
  });
}
