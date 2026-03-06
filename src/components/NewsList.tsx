import { memo, useEffect, useRef, useMemo } from "react";
import { Pill, Search } from "lucide-react";
import { NewsCard } from "@/components/NewsCard";
import { ScrapNewsCard } from "@/components/ScrapNewsCard";
import { PillLoader } from "@/components/PillLoader";
import { ReportsSection } from "@/components/ReportsSection";
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
  readIds: string[];
  handleKeywordClick: (kw: string) => void;
  handleToggleBookmark: (id: string) => void;
  saveMemo: (id: string, memo: string) => void;
  getMatchedKeywords: (kws: string[], title: string, summary: string) => string[];
  getFollowUpMatch: (kws: string[]) => boolean;
  toNewsItem: (news: any) => NewsItem;
  user: any;
};

// 개별 카드를 memo로 감싸서 readIds 변경 시 해당 카드만 리렌더링
const MemoNewsCard = memo(({
  news, item, index, isRead, isBookmarked, showBookmark,
  onKeywordClick, onToggleBookmark, onMarkRead,
  matchedKeywords, isFollowUp,
}: {
  news: any;
  item: NewsItem;
  index: number;
  isRead: boolean;
  isBookmarked: boolean;
  showBookmark: boolean;
  onKeywordClick: (kw: string) => void;
  onToggleBookmark: (id: string) => void;
  onMarkRead: (id: string) => void;
  matchedKeywords: string[];
  isFollowUp: boolean;
}) => (
  <NewsCard
    news={item}
    index={index}
    onKeywordClick={onKeywordClick}
    isBookmarked={isBookmarked}
    onToggleBookmark={onToggleBookmark}
    showBookmark={showBookmark}
    isRead={isRead}
    onMarkRead={onMarkRead}
    matchedKeywords={matchedKeywords}
    isFollowUp={isFollowUp}
  />
), (prev, next) => {
  // isRead만 바뀌었을 때만 해당 카드 리렌더링
  return (
    prev.isRead === next.isRead &&
    prev.isBookmarked === next.isBookmarked &&
    prev.news.id === next.news.id &&
    prev.matchedKeywords.length === next.matchedKeywords.length
  );
});
MemoNewsCard.displayName = "MemoNewsCard";

export const NewsList = memo(({
  regionFilter, displayNews, bookmarkedNewsItems, scrapSearch, setScrapSearch,
  isLoading, newsArticlesCount, memoMap, isBookmarked, isRead, markRead, readIds,
  handleKeywordClick, handleToggleBookmark, saveMemo,
  getMatchedKeywords, getFollowUpMatch, toNewsItem, user
}: Props) => {
  const listRef = useRef<HTMLDivElement>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // readIds를 Set으로 변환해서 O(1) 조회
  const readSet = useMemo(() => new Set(readIds), [readIds]);

  // 단일 IntersectionObserver - 화면 밖으로 나갔을 때 읽음 처리
  useEffect(() => {
    if (!markRead || !user || regionFilter === "스크랩") return;
    const container = listRef.current;
    if (!container) return;

    const seenArticles = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const articleId = (entry.target as HTMLElement).dataset.articleId;
          if (!articleId) return;
          if (entry.isIntersecting) {
            seenArticles.add(articleId);
            clearTimeout(timers.current[articleId]);
            delete timers.current[articleId];
          } else {
            if (seenArticles.has(articleId)) {
              timers.current[articleId] = setTimeout(() => {
                markRead(articleId);
                delete timers.current[articleId];
              }, 300);
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    const cards = container.querySelectorAll("[data-article-id]");
    cards.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
    };
  }, [displayNews, regionFilter, user]);

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

  if (regionFilter === "리포트") return <ReportsSection />;

  if (isLoading) {
    return (
      <div className="card-elevated rounded-lg">
        <PillLoader text="뉴스 불러오는 중..." />
      </div>
    );
  }

  if (displayNews.length > 0) {
    return (
      <div ref={listRef} className="space-y-4">
        {displayNews.map((news, i) => {
          const item = toNewsItem(news);
          return (
            <MemoNewsCard
              key={news.id}
              news={news}
              item={item}
              index={i}
              isRead={readSet.has(news.id)}
              isBookmarked={isBookmarked(news.id)}
              showBookmark={!!user}
              onKeywordClick={handleKeywordClick}
              onToggleBookmark={handleToggleBookmark}
              onMarkRead={markRead}
              matchedKeywords={getMatchedKeywords(item.apiKeywords, item.title, item.summary)}
              isFollowUp={!isBookmarked(news.id) && getFollowUpMatch(item.apiKeywords)}
            />
          );
        })}
      </div>
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
