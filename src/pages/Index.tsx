import { useState } from "react";
import { Pill, Clock, RefreshCw, Search, CalendarDays, Globe, Flag } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { NewsCard } from "@/components/NewsCard";
import { StatsBar } from "@/components/StatsBar";
import { MfdsSection } from "@/components/MfdsSection";
import { FdaSection } from "@/components/FdaSection";
import { NewsAnalysisPanel } from "@/components/NewsAnalysisPanel";
import { useNewsArticles, useAllApiKeywords, useSearchNews } from "@/hooks/useNewsData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { NewsItem } from "@/data/mockNews";

const Index = () => {
  const [search, setSearch] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [todayOnly, setTodayOnly] = useState(false);
  const [regionFilter, setRegionFilter] = useState<"all" | "국내" | "해외">("all");
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const now = new Date();
  const todayStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayDay = now.getDate();
  const selectedDay = todayOnly ? todayDay : null;

  const { data: newsArticles = [], isLoading: newsLoading } = useNewsArticles(currentYear, currentMonth, selectedDay);
  const { data: allKeywords = [] } = useAllApiKeywords();
  const { data: searchResults = [], isLoading: searchLoading } = useSearchNews(search);

  const displayNews = (search ? searchResults : newsArticles)
    .filter((n) => n.api_keywords && n.api_keywords.length > 0)
    .filter((n) => regionFilter === "all" || n.region === regionFilter);
  const isLoading = search ? searchLoading : newsLoading;

  const handleKeywordClick = (kw: string) => {
    setSearch(kw);
  };


  const handleNewsClick = (news: NewsItem) => {
    setSelectedNews(prev => prev?.id === news.id ? null : news);
  };

  const handleCrawl = async () => {
    setCrawling(true);
    try {
      const [newsRes, regRes] = await Promise.all([
        supabase.functions.invoke("crawl-news"),
        supabase.functions.invoke("crawl-regulatory"),
      ]);

      if (newsRes.error) throw newsRes.error;
      if (regRes.error) throw regRes.error;

      toast({
        title: "수집 완료",
        description: `뉴스 ${newsRes.data?.count || 0}건, 공지 ${regRes.data?.count || 0}건 수집`,
      });

      queryClient.invalidateQueries({ queryKey: ["news-articles"] });
      queryClient.invalidateQueries({ queryKey: ["search-news"] });
      queryClient.invalidateQueries({ queryKey: ["all-api-keywords"] });
      queryClient.invalidateQueries({ queryKey: ["regulatory-notices"] });
    } catch (err) {
      console.error("Crawl error:", err);
      toast({
        title: "오류",
        description: err instanceof Error ? err.message : "데이터 수집 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setCrawling(false);
    }
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
    category: news.category,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-40 bg-background/90 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Pill className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">
                API <span className="text-gradient">NewsWatch</span>
              </h1>
              <p className="text-[11px] text-muted-foreground">원료의약품 뉴스 인텔리전스</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCrawl}
              disabled={crawling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background text-foreground border border-border hover:bg-muted disabled:opacity-50 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${crawling ? "animate-spin" : ""}`} />
              {crawling ? "수집중..." : "새로고침"}
            </button>

            <button
              onClick={() => setTodayOnly(!todayOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors shadow-sm ${
                todayOnly
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              오늘 뉴스
            </button>

            {(["all", "국내", "해외"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRegionFilter(r)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors shadow-sm ${
                  regionFilter === r
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted"
                }`}
              >
                {r === "all" ? "전체" : r === "국내" ? "🇰🇷 국내" : "🌍 해외"}
              </button>
            ))}

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
              <Clock className="w-3.5 h-3.5" />
              {todayStr} 기준
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6 space-y-5">
        <SearchBar value={search} onChange={setSearch} suggestions={allKeywords} />
        <StatsBar news={displayNews} totalKeywords={allKeywords.length} />

        {search && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">검색:</span>
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs font-medium">{search}</span>
            <span className="text-muted-foreground text-xs">— 최근 6개월 {displayNews.length}건</span>
          </div>
        )}

        <div className={`grid gap-5 ${selectedNews ? "lg:grid-cols-[1fr_380px]" : "lg:grid-cols-[1fr_340px]"}`}>
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-16 card-elevated rounded-lg">
                <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3 animate-pulse" />
                <p className="text-muted-foreground text-sm">검색중...</p>
              </div>
            ) : displayNews.length > 0 ? (
              displayNews.map((news, i) => {
                const item = toNewsItem(news);
                return (
                  <div
                    key={news.id}
                    onClick={() => handleNewsClick(item)}
                    className={`cursor-pointer rounded-lg transition-all ${
                      selectedNews?.id === news.id ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <NewsCard
                      news={item}
                      index={i}
                      onKeywordClick={handleKeywordClick}
                    />
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 card-elevated rounded-lg">
                <Pill className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground text-sm">
                  {search
                    ? "해당 원료의약품 관련 뉴스가 없습니다"
                    : newsArticles.length === 0
                    ? "아직 수집된 뉴스가 없습니다. '새로고침' 버튼을 클릭해주세요."
                    : "검색 결과가 없습니다"}
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            {selectedNews ? (
              <NewsAnalysisPanel news={selectedNews} onClose={() => setSelectedNews(null)} />
            ) : (
              <>
                <MfdsSection onKeywordClick={handleKeywordClick} />
                <FdaSection onKeywordClick={handleKeywordClick} />
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Index;
