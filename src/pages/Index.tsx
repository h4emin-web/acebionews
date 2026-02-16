import { useState, useEffect } from "react";
import { Pill, Clock, Search, CalendarDays, Globe, Flag, FlaskConical } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { NewsCard } from "@/components/NewsCard";
import { StatsBar } from "@/components/StatsBar";
import { MfdsSection } from "@/components/MfdsSection";
import { FdaSection } from "@/components/FdaSection";
import { UsDmfSection } from "@/components/UsDmfSection";
import { NewsAnalysisPanel } from "@/components/NewsAnalysisPanel";
import { NcePatentModal } from "@/components/NcePatentModal";
import { SearchResultsPanel } from "@/components/SearchResultsPanel";
import { SearchSidebarPanel } from "@/components/SearchSidebarPanel";
import { useNewsArticles, useAllApiKeywords, useSearchNews, useExternalNewsSearch, useDrugInfo, useMfdsProducts, useMfdsDmf } from "@/hooks/useNewsData";
import type { NewsItem } from "@/data/mockNews";

const Index = () => {
  const [search, setSearch] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [regionFilter, setRegionFilter] = useState<"all" | "국내" | "해외">("all");
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
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
  const { data: searchResults = [], isLoading: searchLoading } = useSearchNews(search);
  const { data: externalNews = [], isLoading: externalNewsLoading } = useExternalNewsSearch(debouncedSearch);
  const { data: drugInfo, isLoading: drugInfoLoading } = useDrugInfo(debouncedSearch);
  const { data: mfdsProducts = [], isLoading: mfdsProductsLoading } = useMfdsProducts(debouncedSearch);
  const { data: mfdsDmf = [], isLoading: mfdsDmfLoading } = useMfdsDmf(debouncedSearch);

  const allNews = (search ? searchResults : newsArticles).
  filter((n) => n.api_keywords && n.api_keywords.length > 0);
  const displayNews = allNews.filter((n) => regionFilter === "all" || n.region === regionFilter);
  const isLoading = search ? searchLoading : newsLoading;
  const isSearching = !!search;

  const handleKeywordClick = (kw: string) => {
    setSearch(kw);
  };


  const handleNewsClick = (news: NewsItem) => {
    setSelectedNews((prev) => prev?.id === news.id ? null : news);
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
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Pill className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">
                API <span className="text-gradient">News</span>
              </h1>
              <p className="text-[11px] text-muted-foreground">원료의약품 뉴스</p>
            </div>
          </div>
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
            <SearchBar value={search} onChange={setSearch} suggestions={allKeywords} />
          </div>
          <button
            onClick={() => setNceModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-3 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors whitespace-nowrap shrink-0"
          >
            <FlaskConical className="w-4 h-4" />
            물질 특허 만료 NCE
          </button>
        </div>
        {!search && <StatsBar news={allNews} totalKeywords={allKeywords.length} regionFilter={regionFilter} onRegionFilterChange={setRegionFilter} />}

        {search && (
            <SearchResultsPanel
              keyword={search}
              profile={drugInfo}
              loading={drugInfoLoading}
              onRelatedClick={handleKeywordClick}
            />
        )}

        <div className={`grid gap-5 ${selectedNews ? "lg:grid-cols-[1fr_380px]" : "lg:grid-cols-[1fr_340px]"}`}>
          <div className="space-y-4">
            {isSearching ? (
              /* When searching: show external news in main area */
              externalNewsLoading ? (
                <div className="text-center py-16 card-elevated rounded-lg">
                  <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3 animate-pulse" />
                  <p className="text-muted-foreground text-sm">관련 뉴스 검색중...</p>
                </div>
              ) : externalNews.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe className="w-4 h-4" />
                    <span>관련 뉴스 {externalNews.length}건</span>
                  </div>
                  {externalNews.map((news: any, i: number) => (
                    <a
                      key={i}
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-card border border-border rounded-lg p-4 hover:bg-muted/40 transition-colors"
                    >
                      <h3 className="text-sm font-medium text-foreground line-clamp-2">{news.title}</h3>
                      {news.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{news.description}</p>
                      )}
                      <span className="text-[11px] text-muted-foreground/70 mt-2 block">{news.source}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 card-elevated rounded-lg">
                  <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground text-sm">관련 뉴스가 없습니다</p>
                </div>
              )
            ) : (
              /* When not searching: show DB news */
              isLoading ? (
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
                      <NewsCard news={item} index={i} onKeywordClick={handleKeywordClick} />
                    </div>
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
            {selectedNews ? (
              <NewsAnalysisPanel news={selectedNews} onClose={() => setSelectedNews(null)} />
            ) : isSearching ? (
              <SearchSidebarPanel
                keyword={search}
                products={mfdsProducts}
                productsLoading={mfdsProductsLoading}
                dmfRecords={mfdsDmf}
                dmfLoading={mfdsDmfLoading}
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