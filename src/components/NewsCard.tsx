import { ExternalLink, Globe, MapPin } from "lucide-react";
import type { NewsItem } from "@/data/mockNews";
import { countryFlagCodes } from "@/data/mockNews";
import { useCardEffects } from "@/hooks/useCardEffects";

type Props = {
  news: NewsItem;
  index: number;
  onKeywordClick: (kw: string) => void;
};

export const NewsCard = ({ news, index, onKeywordClick }: Props) => {
  const flagCode = countryFlagCodes[news.country] || null;
  const { ref, ripples, handlePointerMove, handlePointerLeave, handleClick } = useCardEffects();

  return (
    <article
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      className="card-elevated rounded-lg p-5 group animate-fade-in relative overflow-hidden"
      style={{ animationDelay: `${index * 50}ms`, transition: "transform 0.15s ease-out, box-shadow 0.15s ease-out", willChange: "transform" }}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute rounded-full bg-primary/10 pointer-events-none animate-[ripple_0.6s_ease-out_forwards]"
          style={{ left: r.x - 40, top: r.y - 40, width: 80, height: 80 }}
        />
      ))}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide ${
              news.region === "국내" ? "region-badge-domestic" : "region-badge-overseas"
            }`}
          >
            {news.region === "국내" ? <MapPin className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
            {flagCode ? (
              <img src={`https://flagcdn.com/16x12/${flagCode}.png`} alt={news.country} className="w-4 h-3 inline-block" />
            ) : "🌍"} {news.region}
          </span>
          <span className="text-[11px] text-muted-foreground">{news.source}</span>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono shrink-0">{news.date}</span>
      </div>

      <h3 className="text-sm font-semibold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors">
        {news.title}
      </h3>

      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{news.summary}</p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {news.apiKeywords.map((kw) => (
            <button
              key={kw}
              onClick={() => onKeywordClick(kw)}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-primary/8 text-primary hover:bg-primary/15 transition-colors cursor-pointer border border-primary/10"
            >
              {kw}
            </button>
          ))}
        </div>
        <a href={news.url} className="text-muted-foreground hover:text-primary transition-colors shrink-0" target="_blank" rel="noreferrer">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </article>
  );
};
