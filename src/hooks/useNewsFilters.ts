import { useState, useEffect, useCallback, useMemo } from "react";
import { useNewsArticles, useAllApiKeywords, useSearchNews, useIndustryReports } from "@/hooks/useNewsData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deduplicateNews } from "@/utils/deduplicateNews";
import type { RegionFilter } from "@/components/StatsBar";

export function useNewsFilters() {
  const [search, setSearch] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  const [todayOnly, setTodayOnly] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    setKeywordFilter("");
    if (v && (regionFilter === "리포트" || regionFilter === "nedrug" || regionFilter === "스크랩")) {
      setRegionFilter("all");
    }
  }, [regionFilter]);

  // 키워드 알림 클릭용 - 뉴스만 필터링, MFDS 검색 안 함
  const setNewsOnlySearch = useCallback((v: string) => {
    setKeywordFilter(v);
    setSearch("");
    setRegionFilter("all");
  }, []);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayDay = now.getDate();
  const selectedDay = todayOnly ? todayDay : null;
  const todayStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;

  const { data: newsArticles = [], isLoading: newsLoading } = useNewsArticles(currentYear, currentMonth, selectedDay);
  const { data: allKeywords = [] } = useAllApiKeywords();
  const { data: reports = [] } = useIndustryReports();
  const { data: searchResults = [], isLoading: searchLoading } = useSearchNews(search);

  const { data: bioWeeklyPosts = [] } = useQuery({
    queryKey: ["substack-posts-count"],
    queryFn: async () => {
      const { data, error } = await supabase.from("substack_posts").select("id").eq("is_free", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ibricReports = [] } = useQuery({
    queryKey: ["ibric-reports-count"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ibric_reports").select("id");
      if (error) throw error;
      return data || [];
    },
  });

  const baseNews = deduplicateNews(search ? searchResults : newsArticles);

  // 키워드 필터 적용 (프론트 필터링)
  const allNews = useMemo(() => {
    if (!keywordFilter) return baseNews;
    const q = keywordFilter.toLowerCase();
    return baseNews.filter(n =>
      (n.api_keywords || []).some((k: string) => k.toLowerCase().includes(q)) ||
      n.title.toLowerCase().includes(q)
    );
  }, [baseNews, keywordFilter]);

  return {
    search, handleSearchChange,
    keywordFilter, setNewsOnlySearch,
    regionFilter, setRegionFilter,
    todayOnly, setTodayOnly,
    showUnreadOnly, setShowUnreadOnly,
    allNews, newsArticles,
    allKeywords, reports,
    bioWeeklyPosts, ibricReports,
    isLoading: search ? searchLoading : newsLoading,
    todayStr,
  };
}
