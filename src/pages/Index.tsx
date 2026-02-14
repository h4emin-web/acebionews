import { useState, useMemo } from "react";
import { Pill, Clock } from "lucide-react";
import { mockNews, mockMfdsNotices, allApiKeywords, countryFlags, countryNames } from "@/data/mockNews";
import { SearchBar } from "@/components/SearchBar";
import { NewsCard } from "@/components/NewsCard";
import { StatsBar } from "@/components/StatsBar";
import { TrendingKeywords } from "@/components/TrendingKeywords";
import { MfdsSection } from "@/components/MfdsSection";
import { FdaSection } from "@/components/FdaSection";
import { MonthSelector } from "@/components/MonthSelector";

const Index = () => {
  const [search, setSearch] = useState("");
  const [currentMonth, setCurrentMonth] = useState(() => new Date(2026, 1));

  const filtered = useMemo(() => {
    return mockNews.filter((n) => {
      const d = new Date(n.date);
      const matchMonth = d.getFullYear() === currentMonth.getFullYear() && d.getMonth() === currentMonth.getMonth();
      const matchSearch =
        !search ||
        n.apiKeywords.some((kw) => kw.toLowerCase().includes(search.toLowerCase())) ||
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.summary.toLowerCase().includes(search.toLowerCase());
      return matchMonth && matchSearch;
    });
  }, [search, currentMonth]);

  const handleKeywordClick = (kw: string) => {
    setSearch(kw);
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
            <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              매일 00:00 갱신
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-6 space-y-5">
        <SearchBar value={search} onChange={setSearch} suggestions={allApiKeywords} />
        <StatsBar news={filtered} totalKeywords={allApiKeywords.length} />
        <TrendingKeywords news={filtered} onKeywordClick={handleKeywordClick} />

        {search && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">검색:</span>
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs font-medium">{search}</span>
            <span className="text-muted-foreground text-xs">— {filtered.length}건</span>
          </div>
        )}

        {/* Two-column: News + Sidebar */}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            {filtered.length > 0 ? (
              filtered.map((news, i) => (
                <NewsCard key={news.id} news={news} index={i} onKeywordClick={handleKeywordClick} />
              ))
            ) : (
              <div className="text-center py-16 card-elevated rounded-lg">
                <Pill className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground text-sm">검색 결과가 없습니다</p>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <MfdsSection notices={mockMfdsNotices} onKeywordClick={handleKeywordClick} />
            <FdaSection onKeywordClick={handleKeywordClick} />
          </aside>
        </div>

        <div className="text-center py-6 border-t border-border">
          <p className="text-[11px] text-muted-foreground">
            💡 실시간 뉴스 크롤링 및 AI 요약 기능 연동을 위해 Cloud 활성화가 필요합니다
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;
