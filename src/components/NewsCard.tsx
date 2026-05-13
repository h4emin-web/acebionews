import { useState, useRef, useCallback, type MouseEvent } from "react";
import { ChevronDown, ExternalLink, Star } from "lucide-react";
import type { NewsItem } from "@/data/mockNews";
import { countryFlagCodes } from "@/data/mockNews";

type Props = {
  news: NewsItem;
  index: number;
  onKeywordClick: (kw: string) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (id: string) => void;
  showBookmark?: boolean;
  isRead?: boolean;
  onMarkRead?: (id: string) => void;
  matchedKeywords?: string[];
  isFollowUp?: boolean;
};

export const NewsCard = ({ news, index, onKeywordClick, isBookmarked, onToggleBookmark, showBookmark, isRead, onMarkRead, matchedKeywords = [], isFollowUp }: Props) => {
  const flagCode = countryFlagCodes[news.country] || null;
  const [expanded, setExpanded] = useState(false);
  const [scale, setScale] = useState(1);
  const ref = useRef<HTMLElement>(null);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleBookmark = (e: MouseEvent) => {
    e.stopPropagation();
    if (!isBookmarked) {
      setScale(1.7);
      setTimeout(() => setScale(0.85), 150);
      setTimeout(() => setScale(1), 300);
    }
    onToggleBookmark?.(news.id);
  };

  return (
    <article
      ref={ref as any}
      data-article-id={!isRead ? news.id : undefined}
      className={`animate-fade-in border-b border-border last:border-b-0 transition-opacity ${isRead ? "opacity-50" : ""}`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* 제목 행 */}
      <div
        className="flex items-center gap-2 py-2.5 px-3 cursor-pointer hover:bg-primary/5 transition-colors rounded-lg group"
        onClick={handleToggle}
      >
        {/* 국가/지역 배지 */}
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${news.region === "국내" ? "region-badge-domestic" : "region-badge-overseas"}`}>
          {flagCode
            ? <img src={`https://flagcdn.com/16x12/${flagCode}.png`} alt={news.country} className="w-4 h-3" />
            : <span className="text-[10px]">{news.country}</span>
          }
        </span>

        {/* 알림 키워드 */}
        {matchedKeywords.length > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-rose-500 text-white shrink-0 animate-pulse">
            🔔
          </span>
        )}
        {isFollowUp && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500 text-white shrink-0">
            📌
          </span>
        )}

        {/* 제목 */}
        <h3 className="flex-1 text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors break-words min-w-0">
          {isRead && (
            <span className="inline-block mr-1 px-1 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground align-middle">읽음</span>
          )}
          {news.title}
        </h3>

        {/* 우측: 출처 + 날짜 + 북마크 + 화살표 */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-[11px] text-muted-foreground hidden sm:inline">{news.source}</span>
          <span className="text-[11px] text-muted-foreground font-mono">{news.date}</span>
          {showBookmark && (
            <button onClick={handleBookmark} className="relative p-0.5" title={isBookmarked ? "스크랩 해제" : "스크랩"}>
              <Star
                style={{ transform: `scale(${scale})`, transition: "transform 0.15s ease-out" }}
                className={`w-3.5 h-3.5 ${isBookmarked ? "fill-amber-400 text-amber-400" : "text-muted-foreground hover:text-amber-400 transition-colors"}`}
              />
            </button>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* 펼쳐지는 요약 */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 ml-2 border-l-2 border-primary/20 ml-6 animate-fade-in">
          {matchedKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {matchedKeywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500 text-white">
                  🔔 {kw}
                </span>
              ))}
            </div>
          )}

          <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">{news.summary}</p>

          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {news.apiKeywords.map((kw) => (
                <span
                  key={kw}
                  onClick={(e) => { e.stopPropagation(); onKeywordClick(kw); }}
                  className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-primary/8 text-primary border border-primary/10 cursor-pointer hover:bg-primary/20 transition-colors"
                >
                  {kw}
                </span>
              ))}
            </div>
            <a
              href={news.url}
              onClick={() => onMarkRead?.(news.id)}
              className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-primary transition-colors shrink-0"
              target="_blank"
              rel="noreferrer"
            >
              원문 보기 <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </article>
  );
};
