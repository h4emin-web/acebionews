import { useState, useMemo } from "react";
import { Pill, Clock, RefreshCw, Search } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { NewsCard } from "@/components/NewsCard";
import { StatsBar } from "@/components/StatsBar";
import { MfdsSection } from "@/components/MfdsSection";
import { FdaSection } from "@/components/FdaSection";
import { MonthSelector } from "@/components/MonthSelector";
import { useNewsArticles, useAllApiKeywords, useSearchNews } from "@/hooks/useNewsData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [search, setSearch] = useState("");
  const [currentMonth, setCurrentMonth] = useState(() => new Date(2026, 1));
  const [crawling, setCrawling] = useState(false);
  const { toast } = useToast();

  const { data: newsArticles = [], isLoading: newsLoading, refetch: refetchNews } = useNewsArticles(
    currentMonth.getFullYear(),
    currentMonth.getMonth()
  );
  const { data: allKeywords = [] } = useAllApiKeywords();
  const { data: searchResults = [], isLoading: searchLoading } = useSearchNews(search);

  // When searching, show search results (last 6 months); otherwise show monthly news
  const displayNews = search ? searchResults : newsArticles;
  const isLoading = search ? searchLoading : newsLoading;

  const handleKeywordClick = (kw: string) => {
    setSearch(kw);
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
        title: "검색 완료",
        description: `뉴스 ${newsRes.data?.count || 0}건, 공지 ${regRes.data?.count || 0}건 수집`,
      });

      refetchNews();
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-40 bg-background/90 backdrop-blur-md">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
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
          <div className="flex items-center gap-4">
            <button
              onClick={handleCrawl}
              disabled={crawling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${crawling ? "animate-spin" : ""}`} />
              {crawling ? "검색중..." : "새로고침"}
            </button>
            <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              매일 00:00 갱신
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-6 space-y-5">
        <SearchBar value={search} onChange={setSearch} suggestions={allKeywords} />
        <StatsBar news={displayNews} totalKeywords={allKeywords.length} />

        {search && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">검색:</span>
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs font-medium">{search}</span>
            <span className="text-muted-foreground text-xs">— 최근 6개월 {displayNews.length}건</span>
          </div>
        )}

        {/* Two-column: News + Sidebar */}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-16 card-elevated rounded-lg">
                <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3 animate-pulse" />
                <p className="text-muted-foreground text-sm">검색중...</p>
              </div>
            ) : displayNews.length > 0 ? (
              displayNews.map((news, i) => (
                <NewsCard
                  key={news.id}
                  news={{
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
                  }}
                  index={i}
                  onKeywordClick={handleKeywordClick}
                />
              ))
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
            <MfdsSection onKeywordClick={handleKeywordClick} />
            <FdaSection onKeywordClick={handleKeywordClick} />
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Index;
