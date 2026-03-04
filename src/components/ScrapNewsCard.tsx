import { useState, useCallback } from "react";
import { ExternalLink, Globe, MapPin, Star, RotateCcw } from "lucide-react";
import type { NewsItem } from "@/data/mockNews";
import { countryFlagCodes } from "@/data/mockNews";

type Props = {
  news: NewsItem;
  index: number;
  onKeywordClick: (kw: string) => void;
  onToggleBookmark?: (id: string) => void;
  memo: string;
  onMemoSave: (articleId: string, memo: string) => void;
};

export const ScrapNewsCard = ({ news, index, onKeywordClick, onToggleBookmark, memo, onMemoSave }: Props) => {
  const [flipped, setFlipped] = useState(false);
  const [localMemo, setLocalMemo] = useState(memo);
  const [saved, setSaved] = useState(false);
  const flagCode = countryFlagCodes[news.country] || null;

  const handleSave = useCallback(() => {
    onMemoSave(news.id, localMemo);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [news.id, localMemo, onMemoSave]);

  return (
    <div
      className="animate-fade-in"
      style={{ animationDelay: `${index * 50}ms`, perspective: "1000px", minHeight: "180px" }}
    >
      <div
        className="relative w-full transition-all duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(-180deg)" : "rotateY(0deg)",
          minHeight: "180px",
        }}
      >
        {/* 앞면 */}
        <article
          className="card-3d rounded-xl p-5 group relative overflow-hidden w-full"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-primary/[0.03] via-transparent to-accent/[0.03]" />

          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold tracking-wide ${
                  news.region === "국내" ? "region-badge-domestic" : "region-badge-overseas"
                }`}
              >
                {news.region === "국내" ? <MapPin className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                {flagCode ? (
                  <img src={`https://flagcdn.com/16x12/${flagCode}.png`} alt={news.country} className="w-4 h-3 inline-block" />
                ) : "🌍"}
              </span>
              <span className="text-xs text-muted-foreground">{news.source}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-muted-foreground font-mono">{news.date}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleBookmark?.(news.id); }}
                className="p-0.5"
                title="스크랩 해제"
              >
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              </button>
            </div>
          </div>

          <h3 className="text-base font-semibold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors break-words overflow-hidden">
            {news.title}
          </h3>
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-3 break-words overflow-hidden">{news.summary}</p>

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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFlipped(true)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                메모
              </button>
              <a href={news.url} className="text-muted-foreground hover:text-primary transition-colors shrink-0" target="_blank" rel="noreferrer">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* 메모 미리보기 */}
          {memo && (
            <div className="mt-2 px-2 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-800 truncate">
              📝 {memo}
            </div>
          )}
        </article>

        {/* 뒷면 - 메모 */}
        <div
          className="absolute inset-0 card-3d rounded-xl p-5 flex flex-col"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground truncate pr-2">📝 {news.title}</span>
            <button
              onClick={() => setFlipped(false)}
              className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              돌아가기
            </button>
          </div>

          <textarea
            value={localMemo}
            onChange={(e) => setLocalMemo(e.target.value)}
            placeholder="메모를 입력하세요..."
            className="flex-1 w-full resize-none rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary p-3 min-h-[90px]"
          />

          <button
            onClick={handleSave}
            className={`mt-3 w-full py-2 rounded-lg text-xs font-semibold transition-colors ${
              saved ? "bg-green-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {saved ? "저장됨 ✓" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
};
