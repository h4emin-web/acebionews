import { useState, useCallback, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { NewsList } from "@/components/NewsList";
import { StatsBar } from "@/components/StatsBar";
import { SearchBar } from "@/components/SearchBar";
import { NcePatentModal } from "@/components/NcePatentModal";
import { LoginDialog } from "@/components/LoginDialog";
import { MemoPanel } from "@/components/MemoPanel";
import { CnnHealthPanel } from "@/components/CnnHealthPanel";
import { useAuth } from "@/hooks/useAuth";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useReadArticles } from "@/hooks/useReadArticles";
import { useUserKeywords } from "@/hooks/useUserKeywords";
import { useNewsFilters } from "@/hooks/useNewsFilters";
import type { NewsItem } from "@/data/mockNews";
import { toast } from "sonner";

const Index = () => {
  const [scrapSearch, setScrapSearch] = useState("");
  const [nceModalOpen, setNceModalOpen] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [memoPanelOpen, setMemoPanelOpen] = useState(false);

  const { user, login, logout, displayName } = useAuth();
  const { bookmarkIds, bookmarkedArticles, memoMap, toggleBookmark, isBookmarked, saveMemo } = useBookmarks(user);
  const { isRead, markRead, readIds } = useReadArticles(user);
  const { keywords, addKeyword, removeKeyword, getMatchedKeywords } = useUserKeywords(user);

  const {
    search, handleSearchChange,
    keywordFilter, setNewsOnlySearch,
    regionFilter, setRegionFilter,
    todayOnly, setTodayOnly,
    showUnreadOnly, setShowUnreadOnly,
    allNews, newsArticles,
    allKeywords, reports,
    bioWeeklyPosts, ibricReports,
    isLoading, todayStr,
  } = useNewsFilters();

  const handleLogin = useCallback(async (name: string) => {
    const result = await login(name);
    if (result.success) {
      toast.success(`${name}님 환영합니다!`);
      setLoginDialogOpen(false);
    } else {
      toast.error(result.error || "로그인 실패");
    }
  }, [login]);

  const handleToggleBookmark = useCallback((articleId: string) => {
    if (!user) { toast.error("로그인 후 스크랩할 수 있습니다"); return; }
    toggleBookmark(articleId);
  }, [user, toggleBookmark]);

  const handleKeywordClick = useCallback((kw: string) => {
    handleSearchChange(kw);
    setRegionFilter("all");
  }, [handleSearchChange]);

  const handleScrapClick = useCallback(() => {
    setRegionFilter(regionFilter === "스크랩" ? "all" : "스크랩");
    setMemoPanelOpen(false);
  }, [regionFilter]);

  const handleMemoToggle = useCallback(() => {
    setMemoPanelOpen(v => !v);
  }, []);

  const scrapKeywordSet = useMemo(() => new Set(
    bookmarkedArticles.flatMap((a: any) => a.api_keywords || []).map((k: string) => k.toLowerCase())
  ), [bookmarkedArticles]);

  const getFollowUpMatch = useCallback((newsKeywords: string[]): boolean => {
    if (!user || scrapKeywordSet.size === 0) return false;
    return newsKeywords.some((k) => scrapKeywordSet.has(k.toLowerCase()));
  }, [user, scrapKeywordSet]);

  const displayNews = useMemo(() =>
    allNews
      .filter((n) => regionFilter === "all" || regionFilter === "리포트" || regionFilter === "스크랩" || n.region === regionFilter)
      .filter((n) => !showUnreadOnly || !isRead(n.id)),
    [allNews, regionFilter, showUnreadOnly, isRead]
  );

  const toNewsItem = useCallback((news: typeof displayNews[number]): NewsItem => ({
    id: news.id,
    title: news.title,
    summary: news.summary,
    source: news.source,
    region: news.region as "국내" | "해외",
    country: news.country,
    date: news.date,
    url: news.url,
    apiKeywords: news.api_keywords,
    category: news.category,
  }), []);

  const bookmarkedNewsItems: NewsItem[] = useMemo(() =>
    bookmarkedArticles.map((a: any) => ({
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
    })),
    [bookmarkedArticles]
  );

  const isToolView = regionFilter === "nedrug" || regionFilter === "fda" || regionFilter === "bigdeal";
  const showMemoPanel = memoPanelOpen && user && !isToolView;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        user={user}
        displayName={displayName}
        todayStr={todayStr}
        todayOnly={todayOnly}
        showUnreadOnly={showUnreadOnly}
        onLogoClick={() => { handleSearchChange(""); setRegionFilter("all"); setTodayOnly(false); setMemoPanelOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        onLoginClick={() => setLoginDialogOpen(true)}
        onLogout={logout}
        onTodayToggle={() => setTodayOnly(v => !v)}
        onUnreadToggle={() => setShowUnreadOnly(v => !v)}
      />

      <LoginDialog open={loginDialogOpen} onClose={() => setLoginDialogOpen(false)} onLogin={handleLogin} />

      <main className="container max-w-7xl mx-auto px-4 py-6 space-y-5">
        <StatsBar
          news={allNews}
          totalReports={reports.length}
          totalBioWeekly={bioWeeklyPosts.length}
          totalIbricReports={ibricReports.length}
          regionFilter={regionFilter}
          onRegionFilterChange={setRegionFilter}
          bookmarkCount={bookmarkIds.length}
          isLoggedIn={!!user}
          onScrapClick={handleScrapClick}
          onMemoToggle={handleMemoToggle}
          memoOpen={memoPanelOpen}
          scrapActive={regionFilter === "스크랩"}
          keywords={keywords}
          onAddKeyword={addKeyword}
          onRemoveKeyword={removeKeyword}
          onKeywordClick={setNewsOnlySearch}
        />
        {!isToolView && (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <SearchBar value={search} onChange={handleSearchChange} suggestions={allKeywords} />
            </div>
          </div>
        )}

        <div className={`grid gap-5 min-w-0 ${
          isToolView ? "lg:grid-cols-1" :
          showMemoPanel ? "lg:grid-cols-[1fr_380px]" :
          "lg:grid-cols-[1fr_420px]"
        }`}>
          <div className="space-y-4 min-w-0 overflow-hidden">
            <NewsList
              regionFilter={regionFilter}
              displayNews={displayNews}
              bookmarkedNewsItems={bookmarkedNewsItems}
              scrapSearch={scrapSearch}
              setScrapSearch={setScrapSearch}
              isLoading={isLoading}
              newsArticlesCount={newsArticles.length}
              memoMap={memoMap}
              isBookmarked={isBookmarked}
              isRead={isRead}
              markRead={markRead}
              readIds={readIds}
              handleKeywordClick={handleKeywordClick}
              handleToggleBookmark={handleToggleBookmark}
              saveMemo={saveMemo}
              getMatchedKeywords={getMatchedKeywords}
              getFollowUpMatch={getFollowUpMatch}
              toNewsItem={toNewsItem}
              user={user}
            />
          </div>
          {showMemoPanel ? (
            <MemoPanel
              user={user!}
              bookmarkedArticles={bookmarkedArticles}
              memoMap={memoMap}
              onClose={() => setMemoPanelOpen(false)}
              onNewsClick={(articleId) => {
                setRegionFilter("스크랩");
                setMemoPanelOpen(false);
                setTimeout(() => {
                  document.getElementById(`scrap-${articleId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              }}
            />
          ) : !isToolView ? (
            <div className="hidden lg:block">
              <CnnHealthPanel />
            </div>
          ) : null}
        </div>
      </main>

      <NcePatentModal
        open={nceModalOpen}
        onClose={() => setNceModalOpen(false)}
        onKeywordClick={(kw) => { handleSearchChange(kw); setNceModalOpen(false); }}
      />
    </div>
  );
};

export default Index;
