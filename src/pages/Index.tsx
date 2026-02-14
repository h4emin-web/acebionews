import { useState, useMemo } from "react";
import { Pill, RefreshCw } from "lucide-react";
import { mockNews, allApiKeywords, categories } from "@/data/mockNews";
import { SearchBar } from "@/components/SearchBar";
import { NewsCard } from "@/components/NewsCard";
import { StatsBar } from "@/components/StatsBar";
import { CategoryFilter } from "@/components/CategoryFilter";
import { TrendingKeywords } from "@/components/TrendingKeywords";

const Index = () => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return mockNews.filter((n) => {
      const matchSearch =
        !search ||
        n.apiKeywords.some((kw) => kw.toLowerCase().includes(search.toLowerCase())) ||
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.summary.toLowerCase().includes(search.toLowerCase());
      const matchCategory = !activeCategory || n.category === activeCategory;
      const matchRegion = !regionFilter || n.region === regionFilter;
      return matchSearch && matchCategory && matchRegion;
    });
  }, [search, activeCategory, regionFilter]);

  const handleKeywordClick = (kw: string) => {
    setSearch(kw);
    setActiveCategory(null);
    setRegionFilter(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-40 bg-background/80 backdrop-blur-xl">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Pill className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">
                API <span className="text-gradient">NewsWatch</span>
              </h1>
              <p className="text-[11px] text-muted-foreground">원료의약품 뉴스 인텔리전스</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            새로고침
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Search */}
        <SearchBar value={search} onChange={setSearch} suggestions={allApiKeywords} />

        {/* Stats */}
        <StatsBar news={filtered} totalKeywords={allApiKeywords.length} />

        {/* Trending */}
        <TrendingKeywords news={mockNews} onKeywordClick={handleKeywordClick} />

        {/* Filters */}
        <CategoryFilter
          categories={categories}
          active={activeCategory}
          onChange={setActiveCategory}
          regionFilter={regionFilter}
          onRegionChange={setRegionFilter}
        />

        {/* Active search indicator */}
        {search && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">검색:</span>
            <span className="px-2 py-0.5 rounded bg-primary/15 text-primary font-mono text-xs font-medium">
              {search}
            </span>
            <span className="text-muted-foreground text-xs">
              — {filtered.length}건의 관련 뉴스
            </span>
          </div>
        )}

        {/* News Grid */}
        {filtered.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((news, i) => (
              <NewsCard key={news.id} news={news} index={i} onKeywordClick={handleKeywordClick} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Pill className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">검색 결과가 없습니다</p>
            <p className="text-muted-foreground text-xs mt-1">다른 원료명이나 키워드로 검색해보세요</p>
          </div>
        )}

        {/* Footer note */}
        <div className="text-center py-8 border-t border-border">
          <p className="text-[11px] text-muted-foreground">
            💡 실시간 뉴스 크롤링 및 AI 요약 기능 연동을 위해 Cloud 활성화가 필요합니다
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;
