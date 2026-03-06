import { memo } from "react";
import { Pill, Search } from "lucide-react";
import { NewsCard } from "@/components/NewsCard";
import { ScrapNewsCard } from "@/components/ScrapNewsCard";
import { PillLoader } from "@/components/PillLoader";
import { IbricReportsSection } from "@/components/IbricReportsSection";
import { BioWeeklySection } from "@/components/BioWeeklySection";
import { IndustryReportsSection } from "@/components/IndustryReportsSection";
import type { NewsItem } from "@/data/mockNews";
import type { RegionFilter } from "@/components/StatsBar";

type Props = {
  regionFilter: RegionFilter;
  displayNews: any[];
  bookmarkedNewsItems: NewsItem[];
  scrapSearch: string;
  setScrapSearch: (v: string) => void;
  isLoading: boolean;
  newsArticlesCount: number;
  memoMap: Record<string, string>;
  isBookmarked: (id: string) => boolean;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  handleKeywordClick: (kw: string) => void;
  handleToggleBookmark: (id: string) => void;
  saveMemo: (id: string, memo: string) => void;
  getMatchedKeywords: (kws: string[], title: string, summary: string) => string[];
  getFollowUpMatch: (kws: string[]) => boolean;
  toNewsItem: (news: any) => NewsItem;
  user: any;
};

export const NewsList = memo(({
  regionFilter, displayNews, bookmarkedNewsItems, scrapSearch, setScrapSearch,
  isLoading, newsArticlesCount, memoMap, isBookmarked, isRead, markRead,
  handleKeywordClick, handleToggleBookmark, saveMemo,
  getMatchedKeywords, getFollowUpMatch, toNewsItem, user
}: Props) => {
  if (regionFilter === "스크랩") {
    const q = scrapSearch.toLowerCase();
    const filtered = q
      ? bookmarkedNewsItems.filter(n =>
          n.title.toLowerCase().includes(q) ||
          n.summary.toLowerCase().includes(q) ||
          n.source.toLowerCase().includes(q) ||
          (n.apiKeywords || []).some(k => k.toLowerCase().includes(q))
        )
      : bookmarkedNewsItems;

    return (
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
        {filtered.length > 0 ? (
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
        )}
      </>
    );
  }

  if (regionFilter === "동향리포트") return <IbricReportsSection />;
  if (regionFilter === "바이오위클리") return <BioWeeklySection />;
  if (regionFilter === "리포트") return <IndustryReportsSection />;

  if (isLoading) {
    return (
      <div className="card-elevated rounded-lg">
        <PillLoader text="뉴스 불러오는 중..." />
      </div>
    );
  }

  if (displayNews.length > 0) {
    return (
      <>
        {displayNews.map((news, i) => {
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
        })}
      </>
    );
  }

  return (
    <div className="text-center py-16 card-elevated rounded-lg">
      <Pill className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
      <p className="text-muted-foreground text-sm">
        {newsArticlesCount === 0
          ? "아직 수집된 뉴스가 없습니다. 매일 자정에 자동 업데이트됩니다."
          : "검색 결과가 없습니다"}
      </p>
    </div>
  );
});
NewsList.displayName = "NewsList";
