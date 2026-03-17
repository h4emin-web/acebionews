import { useState, useEffect, useRef, useCallback } from "react";
import { ExternalLink, Globe, MapPin, Star } from "lucide-react";
import type { NewsItem } from "@/data/mockNews";
import { countryFlagCodes } from "@/data/mockNews";

type Ripple = { x: number; y: number; id: number };

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
  const ref = useRef<HTMLElement>(null);
  const rippleId = useRef(0);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [scale, setScale] = useState(1);

  // 카드 효과
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale3d(1.015, 1.015, 1.015)`;
  }, []);

  const handlePointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    el.style.boxShadow = "";
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const id = ++rippleId.current;
    setRipples((prev) => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top, id }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
  }, []);

  // 읽음 처리는 NewsList에서 단일 Observer로 관리 (data-article-id 속성 사용)

  const handleBookmark = (e: React.MouseEvent) => {
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
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      data-article-id={!isRead ? news.id : undefined}
      className={`card-3d rounded-xl p-5 group animate-fade-in relative overflow-hidden transition-opacity ${isRead ? "opacity-60" : ""}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-primary/[0.03] via-transparent to-accent/[0.03]" />
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute rounded-full bg-primary/15 pointer-events-none animate-[ripple_0.6s_ease-out_forwards]"
          style={{ left: r.x - 40, top: r.y - 40, width: 80, height: 80 }}
        />
      ))}

      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold tracking-wide ${news.region === "국내" ? "region-badge-domestic" : "region-badge-overseas"}`}>
            {news.region === "국내" ? <MapPin className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
            {flagCode ? <img src={`https://flagcdn.com/16x12/${flagCode}.png`} alt={news.country} className="w-4 h-3 inline-block" /> : "🌍"}
          </span>
          <span className="text-xs text-muted-foreground">{news.source}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground font-mono">{news.date}</span>
          {showBookmark && (
            <button onClick={handleBookmark} className="relative p-0.5" title={isBookmarked ? "스크랩 해제" : "스크랩"}>
              <Star
                style={{ transform: `scale(${scale})`, transition: "transform 0.15s ease-out" }}
                className={`w-4 h-4 ${isBookmarked ? "fill-amber-400 text-amber-400" : "text-muted-foreground hover:text-amber-400 transition-colors"}`}
              />
            </button>
          )}
        </div>
      </div>

      {isFollowUp && (
        <div className="flex mb-2">
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500 text-white">
            📌 후속 뉴스
          </span>
        </div>
      )}
      {matchedKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {matchedKeywords.map((kw) => (
            <span key={kw} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500 text-white animate-pulse">
              🔔 {kw}
            </span>
          ))}
        </div>
      )}

      <h3 className="text-base font-semibold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors break-words">
        {isRead && <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground align-middle">읽음</span>}
        {news.title}
      </h3>
      <p className="text-[13px] text-muted-foreground leading-relaxed mb-3 break-words line-clamp-none sm:line-clamp-3">{news.summary}</p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {news.apiKeywords.map((kw) => (
            <span key={kw} onClick={(e) => { e.stopPropagation(); onKeywordClick(kw); }}
              className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-primary/8 text-primary border border-primary/10 cursor-pointer hover:bg-primary/20 transition-colors">
              {kw}
            </span>
          ))}
        </div>
        <a href={news.url} onClick={() => onMarkRead?.(news.id)} className="text-muted-foreground hover:text-primary transition-colors shrink-0" target="_blank" rel="noreferrer">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </article>
  );
};
