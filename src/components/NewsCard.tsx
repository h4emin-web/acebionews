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
      className="card-3d rounded-xl p-5 group animate-fade-in relative overflow-hidden"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Gradient shimmer on hover */}
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
        <span className="text-xs text-muted-foreground font-mono shrink-0">{news.date}</span>
      </div>

      <h3 className="text-base font-semibold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors">
        {news.title}
      </h3>

      <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">{news.summary}</p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {news.apiKeywords.map((kw) => (
            <span
              key={kw}
              className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-primary/8 text-primary border border-primary/10"
            >
              {kw}
            </span>
          ))}
        </div>
        <a href={news.url} className="text-muted-foreground hover:text-primary transition-colors shrink-0" target="_blank" rel="noreferrer">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </article>
  );
};
