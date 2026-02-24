import { useState, useEffect } from "react";
import { Pill, Clock, Search, CalendarDays, Flag, FlaskConical } from "lucide-react";
import { PillLoader } from "@/components/PillLoader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SearchBar } from "@/components/SearchBar";
import { NewsCard } from "@/components/NewsCard";
import { StatsBar } from "@/components/StatsBar";
import { MfdsSection } from "@/components/MfdsSection";
import { FdaSection } from "@/components/FdaSection";
import { UsDmfSection } from "@/components/UsDmfSection";
import { BioWeeklySection } from "@/components/BioWeeklySection";
import { IbricReportsSection } from "@/components/IbricReportsSection";
import { NcePatentModal } from "@/components/NcePatentModal";
import { SearchResultsPanel } from "@/components/SearchResultsPanel";
import { SearchSidebarPanel } from "@/components/SearchSidebarPanel";
import { IndustryReportsSection } from "@/components/IndustryReportsSection";
import { useNewsArticles, useAllApiKeywords, useSearchNews, useDrugInfo, useMfdsIngredientLookup, useMfdsProducts, useMfdsDmf, useIndustryReports, useManufacturers } from "@/hooks/useNewsData";
import { ManufacturersPanel } from "@/components/ManufacturersPanel";
import type { NewsItem } from "@/data/mockNews";
import { deduplicateNews } from "@/utils/deduplicateNews";

const Index = () => {
  const [search, setSearch] = useState("");
  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (v && (regionFilter === "리포트" || regionFilter === "바이오위클리" || regionFilter === "동향리포트")) setRegionFilter("all");
  };
  const [todayOnly, setTodayOnly] = useState(false);
  const [regionFilter, setRegionFilter] = useState<"all" | "국내" | "해외" | "리포트" | "바이오위클리" | "동향리포트">("all");
  
  const [nceModalOpen, setNceModalOpen] = useState(false);

  // Debounce search for external API calls (Korean IME sends many partial chars)
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    if (!search) { setDebouncedSearch(""); return; }
    const timer = setTimeout(() => setDebouncedSearch(search), 600);
    return () => clearTimeout(timer);
  }, [search]);

  const now = new Date();
  const todayStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayDay = now.getDate();
  const selectedDay = todayOnly ? todayDay : null;

  const { data: newsArticles = [], isLoading: newsLoading } = useNewsArticles(currentYear, currentMonth, selectedDay);
  const { data: allKeywords = [] } = useAllApiKeywords();
  const { data: reports = [] } = useIndustryReports();
  
  // Bio Weekly posts count
  const { data: bioWeeklyPosts = [] } = useQuery({
    queryKey: ["substack-posts-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("substack_posts")
        .select("id")
        .eq("is_free", true);
      if (error) throw error;
      return data || [];
    },
  });
  const { data: ibricReports = [] } = useQuery({
    queryKey: ["ibric-reports-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ibric_reports")
        .select("id");
      if (error) throw error;
      return data || [];
    },
  });
  const { data: searchResults = [], isLoading: searchLoading } = useSearchNews(search);
  const { data: manufacturerData, isLoading: manufacturersLoading } = useManufacturers(debouncedSearch);
  const { data: drugInfo, isLoading: drugInfoLoading } = useDrugInfo(debouncedSearch);
  const { data: mfdsIngredient } = useMfdsIngredientLookup(debouncedSearch);

  // Priority: MFDS ingredient lookup → AI profile → raw search keyword
  const ingredientKeyword = mfdsIngredient?.nameKo
    ? mfdsIngredient.nameEn
      ? `${mfdsIngredient.nameKo} (${mfdsIngredient.nameEn})`
      : mfdsIngredient.nameKo
    : drugInfo?.nameKo
      ? `${drugInfo.nameKo} (${drugInfo.nameEn})`
      : debouncedSearch;

  const { data: mfdsProductsData, isLoading: mfdsProductsLoading } = useMfdsProducts(ingredientKeyword);
  const { data: mfdsDmfData, isLoading: mfdsDmfLoading } = useMfdsDmf(ingredientKeyword);

  const mfdsProducts = mfdsProductsData?.products || [];
  const mfdsProductsTotalCount = mfdsProductsData?.totalCount || 0;
  const mfdsDmf = mfdsDmfData?.records || [];
  const mfdsDmfTotalCount = mfdsDmfData?.totalCount || 0;

  const isProductSearch = drugInfo?.searchedAsProduct === true;

  const allNews = deduplicateNews(
    (search ? searchResults : newsArticles)
  );
  const displayNews = allNews.filter((n) => regionFilter === "all" || regionFilter === "리포트" || n.region === regionFilter);
  const isLoading = search ? searchLoading : newsLoading;
  const isSearching = !!search;

  const handleKeywordClick = (kw: string) => {
    setSearch(kw);
    setRegionFilter("all");
  };




  const toNewsItem = (news: typeof displayNews[number]): NewsItem => ({
    id: news.id,
    title: news.title,
    summary: news.summary,
    source: news.source,
    region: news.region as "국내" | "해외",
    country: news.country,
    date: news.date,
    url: news.url,
    apiKeywords: news.api_keywords,
    category: news.category
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-40 bg-background/90 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => { setSearch(""); setRegionFilter("all"); setTodayOnly(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex items-center gap-1 cursor-pointer">
            <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-b from-primary to-teal-400 bg-clip-text text-transparent">Bio</span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">news</span>
          </button>
          <div className="flex items-center gap-2">

            <button
              onClick={() => setTodayOnly(!todayOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors shadow-sm ${
              todayOnly ?
              "bg-primary text-primary-foreground border-primary" :
              "bg-background text-foreground border-border hover:bg-muted"}`
              }>

              <CalendarDays className="w-3.5 h-3.5" />
              오늘 뉴스
            </button>



            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
              <Clock className="w-3.5 h-3.5" />
              {todayStr} 기준
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <SearchBar value={search} onChange={handleSearchChange} suggestions={allKeywords} />
          </div>
          <button
            onClick={() => setNceModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-3 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors whitespace-nowrap shrink-0"
          >
            <FlaskConical className="w-4 h-4" />
            물질 특허 만료 NCE
          </button>
        </div>
        {!search && <StatsBar news={allNews} totalReports={reports.length} totalBioWeekly={bioWeeklyPosts.length} totalIbricReports={ibricReports.length} regionFilter={regionFilter} onRegionFilterChange={setRegionFilter} />}

        {search && (
            <SearchResultsPanel
              keyword={search}
              profile={drugInfo}
              loading={drugInfoLoading}
              onRelatedClick={handleKeywordClick}
            />
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            {regionFilter === "동향리포트" ? (
              <IbricReportsSection />
            ) : regionFilter === "바이오위클리" ? (
              <BioWeeklySection />
            ) : regionFilter === "리포트" ? (
              <IndustryReportsSection />
            ) : isSearching ? (
              <ManufacturersPanel
                keyword={debouncedSearch || search}
                data={manufacturerData}
                loading={manufacturersLoading}
              />
            ) : (
              /* When not searching: show DB news */
              isLoading ? (
                <div className="card-elevated rounded-lg">
                  <PillLoader text="뉴스 불러오는 중..." />
                </div>
              ) : displayNews.length > 0 ? (
                displayNews.map((news, i) => {
                  const item = toNewsItem(news);
                  return (
                    <NewsCard key={news.id} news={item} index={i} onKeywordClick={handleKeywordClick} />
                  );
                })
              ) : (
                <div className="text-center py-16 card-elevated rounded-lg">
                  <Pill className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground text-sm">
                    {newsArticles.length === 0
                      ? "아직 수집된 뉴스가 없습니다. 매일 자정에 자동 업데이트됩니다."
                      : "검색 결과가 없습니다"}
                  </p>
                </div>
              )
            )}
          </div>

          <aside className="space-y-4">
            {isSearching ? (
              <SearchSidebarPanel
                keyword={search}
                products={mfdsProducts}
                productsLoading={mfdsProductsLoading}
                productsTotalCount={mfdsProductsTotalCount}
                dmfRecords={mfdsDmf}
                dmfLoading={mfdsDmfLoading}
                dmfTotalCount={mfdsDmfTotalCount}
                isProductSearch={isProductSearch}
              />
            ) : (
              <>
                <UsDmfSection onKeywordClick={handleKeywordClick} />
                <MfdsSection onKeywordClick={handleKeywordClick} />
                <FdaSection onKeywordClick={handleKeywordClick} />
              </>
            )}
          </aside>
        </div>
      </main>
      <NcePatentModal
        open={nceModalOpen}
        onClose={() => setNceModalOpen(false)}
        onKeywordClick={(kw) => {
          setSearch(kw);
          setNceModalOpen(false);
        }}
      />
    </div>);

};

export default Index;