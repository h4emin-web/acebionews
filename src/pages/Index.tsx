import {
              {user && (
                <button
                  onClick={() => setShowUnreadOnly((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors shadow-sm ${
                    showUnreadOnly
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  안읽음만
                </button>
              )} useState, useEffect, useCallback } from "react";
import { Pill, Clock, Search, CalendarDays, Flag, FlaskConical, LogIn, LogOut, User, EyeOff } from "lucide-react";
import { BigDealsSection } from "@/components/BigDealsSection";
import { PillLoader } from "@/components/PillLoader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SearchBar } from "@/components/SearchBar";
import { NewsCard } from "@/components/NewsCard";
import { StatsBar, type RegionFilter } from "@/components/StatsBar";
import { MfdsSection } from "@/components/MfdsSection";
import { MfdsRecallSection } from "@/components/MfdsRecallSection";
import { FdaSection } from "@/components/FdaSection";
import { UsDmfSection } from "@/components/UsDmfSection";
import { BioWeeklySection } from "@/components/BioWeeklySection";
import { IbricReportsSection } from "@/components/IbricReportsSection";
import { NcePatentModal } from "@/components/NcePatentModal";
import { NcePatentSection } from "@/components/NcePatentSection";
import { IndApprovalModal } from "@/components/IndApprovalModal";
import { SearchResultsPanel } from "@/components/SearchResultsPanel";
import { SearchSidebarPanel } from "@/components/SearchSidebarPanel";
import { IndustryReportsSection } from "@/components/IndustryReportsSection";
import { IntelligenceSummarySection } from "@/components/IntelligenceSummarySection";
import { MemoSection } from "@/components/MemoSection";
import { useNewsArticles, useAllApiKeywords, useSearchNews, useDrugInfo, useMfdsIngredientLookup, useMfdsProducts, useMfdsDmf, useIndustryReports, useManufacturers } from "@/hooks/useNewsData";
import { ManufacturersPanel } from "@/components/ManufacturersPanel";
import { useAuth } from "@/hooks/useAuth";
import { ScrapNewsCard } from "@/components/ScrapNewsCard";
import { LoginDialog } from "@/components/LoginDialog";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useReadArticles } from "@/hooks/useReadArticles";
import { useUserKeywords } from "@/hooks/useUserKeywords";
import { KeywordAlertSection } from "@/components/KeywordAlertSection";
import type { NewsItem } from "@/data/mockNews";
import { deduplicateNews } from "@/utils/deduplicateNews";
import { toast } from "sonner";

const Index = () => {
  const [search, setSearch] = useState("");
  const [scrapSearch, setScrapSearch] = useState("");
  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (v && (regionFilter === "리포트" || regionFilter === "바이오위클리" || regionFilter === "동향리포트" || regionFilter === "스크랩")) setRegionFilter("all");
  };
  const [todayOnly, setTodayOnly] = useState(false);
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  
  const [nceModalOpen, setNceModalOpen] = useState(false);
  const [indModalOpen, setIndModalOpen] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [memoExpanded, setMemoExpanded] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // Auth & Bookmarks
  const { user, login, logout, displayName } = useAuth();
  const { bookmarkIds, bookmarkedArticles, memoMap, memoDateMap, toggleBookmark, isBookmarked, saveMemo } = useBookmarks(user);
  const { isRead, markRead, readIds } = useReadArticles(user);
  const { keywords, addKeyword, removeKeyword, getMatchedKeywords } = useUserKeywords(user);

  // 스크랩 뉴스 키워드 집합 (후속 뉴스 감지용)
  const scrapKeywordSet = new Set(
    bookmarkedArticles.flatMap((a: any) => a.api_keywords || []).map((k: string) => k.toLowerCase())
  );
  const getFollowUpMatch = (newsKeywords: string[]): boolean => {
    if (!user || scrapKeywordSet.size === 0) return false;
    return newsKeywords.some((k) => scrapKeywordSet.has(k.toLowerCase()));
  };

  const handleLogin = useCallback(async (name: string) => {
    const result = await login(name);
    if (result.success) {
      toast.success(`${name}님 환영합니다!`);
      setLoginDialogOpen(false);
    } else {
      toast.error(result.error || "로그인 실패");
    }
  }, [login]);

  const handleToggleBookmark = (articleId: string) => {
    if (!user) {
      toast.error("로그인 후 스크랩할 수 있습니다");
      return;
    }
    toggleBookmark(articleId);
  };

  // Debounce search
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
  const { data: searchResults = [], isLoading: searchLoading } = useSearchNews(search);
  const { data: manufacturerData, isLoading: manufacturersLoading } = useManufacturers(debouncedSearch);
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

  const mfdsProducts = mfdsProductsData?.products || [];
  const mfdsProductsTotalCount = mfdsProductsData?.totalCount || 0;
  const mfdsDmf = mfdsDmfData?.records || [];
  const mfdsDmfTotalCount = mfdsDmfData?.totalCount || 0;
  const isProductSearch = drugInfo?.searchedAsProduct === true;

  const allNews = deduplicateNews(search ? searchResults : newsArticles);
  const displayNews = allNews
    .filter((n) => regionFilter === "all" || regionFilter === "리포트" || regionFilter === "스크랩" || n.region === regionFilter)
    .filter((n) => !showUnreadOnly || !isRead(n.id));
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

  const bookmarkedNewsItems: NewsItem[] = bookmarkedArticles.map((a: any) => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    source: a.source,
    region: a.region as "국내" | "해외",
    country: a.country,
    date: a.date,
    url: a.url,
    apiKeywords: a.api_keywords || [],
    category: a.category || "",
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-40 bg-background/90 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => { setSearch(""); setRegionFilter("all"); setTodayOnly(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex items-center gap-1 cursor-pointer">
            <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-b from-primary to-teal-400 bg-clip-text text-transparent">Bio</span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">news</span>
          </button>
          <div className="flex items-center gap-2">
            {user ? (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors shadow-sm"
              >
                <User className="w-3.5 h-3.5" />
                <span className="max-w-[60px] truncate">{displayName}님</span>
                <LogOut className="w-3 h-3 text-muted-foreground" />
              </button>
            ) : (
              <button
                onClick={() => setLoginDialogOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                로그인
              </button>
            )}

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

      <LoginDialog
        open={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        onLogin={handleLogin}
      />

      <main className="container max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="hidden md:flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <SearchBar value={search} onChange={handleSearchChange} suggestions={allKeywords} />
          </div>
          <button
            onClick={() => setIndModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-3 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors whitespace-nowrap shrink-0"
          >
            <FlaskConical className="w-4 h-4" />
            국내 IND 승인
          </button>
        </div>
        {!search && (
          <StatsBar
            news={allNews}
            totalReports={reports.length}
            totalBioWeekly={bioWeeklyPosts.length}
            totalIbricReports={ibricReports.length}
            regionFilter={regionFilter}
            onRegionFilterChange={setRegionFilter}
            bookmarkCount={bookmarkIds.length}
            isLoggedIn={!!user}
          />
        )}

        {search && (
            <SearchResultsPanel
              keyword={search}
              profile={drugInfo}
              loading={drugInfoLoading}
              onRelatedClick={handleKeywordClick}
            />
        )}

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
            fullWidth
          />
        ) : (
          <div className={`grid gap-5 min-w-0 ${memoExpanded ? "lg:grid-cols-[0px_1fr]" : "lg:grid-cols-[1fr_340px]"}`}>
            <div className={`space-y-4 min-w-0 overflow-hidden transition-all duration-300 ${memoExpanded ? "hidden lg:hidden" : ""}`}>
              {regionFilter === "스크랩" ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="스크랩 내 검색..."
                      value={scrapSearch}
                      onChange={(e) => setScrapSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  {(() => {
                    const q = scrapSearch.toLowerCase();
                    const filtered = q
                      ? bookmarkedNewsItems.filter(n =>
                          n.title.toLowerCase().includes(q) ||
                          n.summary.toLowerCase().includes(q) ||
                          n.source.toLowerCase().includes(q) ||
                          (n.apiKeywords || []).some(k => k.toLowerCase().includes(q))
                        )
                      : bookmarkedNewsItems;
                    return filtered.length > 0 ? (
                      filtered.map((news, i) => (
                        <ScrapNewsCard
                          key={news.id}
                          news={news}
                          index={i}
                          onKeywordClick={handleKeywordClick}
                          onToggleBookmark={handleToggleBookmark}
                          memo={memoMap[news.id] || ""}
                          onMemoSave={saveMemo}
                        />
                      ))
                    ) : (
                      <div className="text-center py-16 card-elevated rounded-lg">
                        <Pill className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                        <p className="text-muted-foreground text-sm">
                          {scrapSearch ? "검색 결과가 없습니다" : "스크랩한 뉴스가 없습니다"}
                        </p>
                      </div>
                    );
                  })()}
                </>
              ) : regionFilter === "동향리포트" ? (
                <IbricReportsSection />
              ) : regionFilter === "바이오위클리" ? (
                <BioWeeklySection />
              ) : regionFilter === "리포트" ? (
                <IndustryReportsSection />
              ) : isLoading ? (
                <div className="card-elevated rounded-lg">
                  <PillLoader text="뉴스 불러오는 중..." />
                </div>
              ) : displayNews.length > 0 ? (
                displayNews.map((news, i) => {
                  const item = toNewsItem(news);
                  return (
                    <NewsCard
                      key={news.id}
                      news={item}
                      index={i}
                      onKeywordClick={handleKeywordClick}
                      isBookmarked={isBookmarked(news.id)}
                      onToggleBookmark={handleToggleBookmark}
                      showBookmark={!!user}
                      isRead={isRead(news.id)}
                      onMarkRead={markRead}
                      matchedKeywords={getMatchedKeywords(item.apiKeywords, item.title, item.summary)}
                      isFollowUp={!isBookmarked(news.id) && getFollowUpMatch(item.apiKeywords)}
                    />
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
              )}
            </div>

            <aside className={`hidden lg:block min-w-0 overflow-hidden transition-all duration-300 ${memoExpanded ? "col-span-full" : "space-y-4"}`}>
              {user && (
                <KeywordAlertSection
                  user={user}
                  keywords={keywords}
                  onAdd={addKeyword}
                  onRemove={removeKeyword}
                />
              )}
              {user && (
                <MemoSection
                  user={user}
                  bookmarkedArticles={bookmarkedArticles}
                  memoMap={memoMap}
                  expanded={memoExpanded}
                  onExpand={setMemoExpanded}
                  onNewsClick={(articleId) => {
                    setRegionFilter("스크랩");
                    setTimeout(() => {
                      document.getElementById(`scrap-${articleId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }, 100);
                  }}
                />
              )}
              <IntelligenceSummarySection />
              <MfdsSection onKeywordClick={handleKeywordClick} />
              <MfdsRecallSection />
              <BigDealsSection />
              <NcePatentSection onKeywordClick={handleKeywordClick} />
              <UsDmfSection onKeywordClick={handleKeywordClick} />
              <FdaSection onKeywordClick={handleKeywordClick} />
            </aside>
          </div>
        )}
      </main>
      <NcePatentModal
        open={nceModalOpen}
        onClose={() => setNceModalOpen(false)}
        onKeywordClick={(kw) => {
          setSearch(kw);
          setNceModalOpen(false);
        }}
      />
      <IndApprovalModal
        open={indModalOpen}
        onClose={() => setIndModalOpen(false)}
      />
    </div>);
};

export default Index;
