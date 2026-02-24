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
        .order("created_at", { ascending: false });

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

// MFDS ingredient lookup by product name
export function useMfdsIngredientLookup(keyword: string) {
  return useQuery({
    queryKey: ["mfds-ingredient-lookup", keyword],
    enabled: !!keyword,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("scrape-mfds", {
        body: { keyword, type: "ingredient-lookup" },
      });
      if (error) throw error;
      return data?.ingredient || null;
    },
  });
}

// Extract Korean name from "한글명 (영문명)" format, or return as-is
function extractKoreanName(keyword: string): string {
  const match = keyword.match(/^([가-힣\s]+)\s*\(/);
  return match ? match[1].trim() : keyword.trim();
}

// Extract English name from "한글명 (영문명)" format
function extractEnglishName(keyword: string): string | null {
  const match = keyword.match(/\(([^)]+)\)/);
  return match ? match[1].trim() : null;
}

// MFDS domestic products (real data)
export function useMfdsProducts(keyword: string) {
  const koName = extractKoreanName(keyword);
  const enName = extractEnglishName(keyword);
  return useQuery({
    queryKey: ["mfds-products", keyword],
    enabled: !!keyword,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      // Search with Korean name first
      const { data, error } = await supabase.functions.invoke("scrape-mfds", {
        body: { keyword: koName, type: "products" },
      });
      if (error) throw error;
      const results = data?.domesticProducts || [];
      const totalCount = data?.totalCount || 0;
      // If no results with Korean, try English name
      if (results.length === 0 && enName) {
        const { data: enData, error: enError } = await supabase.functions.invoke("scrape-mfds", {
          body: { keyword: enName, type: "products" },
        });
        if (!enError) return { products: enData?.domesticProducts || [], totalCount: enData?.totalCount || 0 };
      }
      return { products: results, totalCount };
    },
  });
}

// MFDS DMF records (real data)
export function useMfdsDmf(keyword: string) {
  const koName = extractKoreanName(keyword);
  const enName = extractEnglishName(keyword);
  return useQuery({
    queryKey: ["mfds-dmf", keyword],
    enabled: !!keyword,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("scrape-mfds", {
        body: { keyword: koName, type: "dmf" },
      });
      if (error) throw error;
      const results = data?.dmfRecords || [];
      const totalCount = data?.totalCount || 0;
      if (results.length === 0 && enName) {
        const { data: enData, error: enError } = await supabase.functions.invoke("scrape-mfds", {
          body: { keyword: enName, type: "dmf" },
        });
        if (!enError) return { records: enData?.dmfRecords || [], totalCount: enData?.totalCount || 0 };
      }
      return { records: results, totalCount };
    },
  });
}

export function useRegulatoryNotices(source: string) {
  return useQuery({
    queryKey: ["regulatory-notices", source],
    queryFn: async () => {
      if (source === "FDA") {
        // Fetch 5 Alerts and 5 Statements separately, then merge by date
        const [alertsRes, statementsRes] = await Promise.all([
          supabase
            .from("regulatory_notices")
            .select("*")
            .eq("source", "FDA")
            .eq("type", "Safety Alert")
            .order("date", { ascending: false })
            .limit(5),
          supabase
            .from("regulatory_notices")
            .select("*")
            .eq("source", "FDA")
            .eq("type", "Statement")
            .order("date", { ascending: false })
            .limit(5),
        ]);
        if (alertsRes.error) throw alertsRes.error;
        if (statementsRes.error) throw statementsRes.error;
        const merged = [...(alertsRes.data || []), ...(statementsRes.data || [])];
        merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return merged as RegulatoryNotice[];
      }

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

export type Manufacturer = {
  name: string;
  country: string;
  city: string;
  website: string | null;
};

export type ManufacturerData = {
  india: Manufacturer[];
  china: Manufacturer[];
  global: Manufacturer[];
};

export function useManufacturers(keyword: string) {
  return useQuery({
    queryKey: ["manufacturers", keyword],
    enabled: !!keyword && keyword.length >= 2,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("search-manufacturers", {
        body: { keyword },
      });
      if (error) throw error;
      return (data?.manufacturers || { india: [], china: [], global: [] }) as ManufacturerData;
    },
  });
}
