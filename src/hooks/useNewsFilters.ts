import { useState, useEffect, useCallback } from "react";
import { useNewsArticles, useAllApiKeywords, useSearchNews, useDrugInfo, useMfdsIngredientLookup, useMfdsProducts, useMfdsDmf, useIndustryReports } from "@/hooks/useNewsData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deduplicateNews } from "@/utils/deduplicateNews";
import type { RegionFilter } from "@/components/StatsBar";

export function useNewsFilters() {
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  const [todayOnly, setTodayOnly] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    if (v && (regionFilter === "리포트" || regionFilter === "바이오위클리" || regionFilter === "동향리포트" || regionFilter === "스크랩")) {
      setRegionFilter("all");
    }
  }, [regionFilter]);

  useEffect(() => {
    if (!search) { setDebouncedSearch(""); return; }
    const timer = setTimeout(() => setDebouncedSearch(search), 600);
    return () => clearTimeout(timer);
  }, [search]);

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
  const { data: manufacturerData, isLoading: manufacturersLoading } = useQuery({ queryKey: ["manufacturers-placeholder"], queryFn: async () => null, enabled: false });

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

  const { data: drugInfo, isLoading: drugInfoLoading } = useDrugInfo(debouncedSearch);
  const { data: mfdsIngredient } = useMfdsIngredientLookup(debouncedSearch);

  const isValidIngredient = mfdsIngredient?.nameKo &&
    mfdsIngredient.nameKo.length >= 2 &&
    mfdsIngredient.nameKo !== "원료" &&
    mfdsIngredient.nameKo !== "수출용" &&
    mfdsIngredient.nameKo !== "완제";

  const ingredientKeyword = isValidIngredient
    ? mfdsIngredient.nameEn
      ? `${mfdsIngredient.nameKo} (${mfdsIngredient.nameEn})`
      : mfdsIngredient.nameKo!
    : drugInfo?.nameKo
      ? `${drugInfo.nameKo} (${drugInfo.nameEn})`
      : debouncedSearch;

  const { data: mfdsProductsData, isLoading: mfdsProductsLoading } = useMfdsProducts(ingredientKeyword);
  const { data: mfdsDmfData, isLoading: mfdsDmfLoading } = useMfdsDmf(ingredientKeyword);

  const allNews = deduplicateNews(search ? searchResults : newsArticles);

  return {
    search, setSearch, handleSearchChange,
    regionFilter, setRegionFilter,
    todayOnly, setTodayOnly,
    showUnreadOnly, setShowUnreadOnly,
    debouncedSearch,
    allNews, newsArticles,
    allKeywords, reports,
    bioWeeklyPosts, ibricReports,
    drugInfo, drugInfoLoading,
    mfdsProductsData, mfdsProductsLoading,
    mfdsDmfData, mfdsDmfLoading,
    isProductSearch: drugInfo?.searchedAsProduct === true,
    isLoading: search ? searchLoading : newsLoading,
    isSearching: !!search,
    todayStr,
  };
}
