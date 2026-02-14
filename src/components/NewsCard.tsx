import { ExternalLink, Globe, MapPin } from "lucide-react";
import type { NewsItem } from "@/data/mockNews";

type Props = {
  news: NewsItem;
  index: number;
  onKeywordClick: (kw: string) => void;
};

export const NewsCard = ({ news, index, onKeywordClick }: Props) => {
  return (
    <article
      className="glass-card rounded-lg p-5 hover:border-primary/30 transition-all duration-300 group animate-fade-in"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase ${
              news.region === "국내"
                ? "bg-primary/15 text-primary"
                : "bg-pharma-amber/15 text-pharma-amber"
            }`}
          >
            {news.region === "국내" ? <MapPin className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
            {news.region}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">{news.source}</span>
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
              className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
            >
              {kw}
            </button>
          ))}
        </div>
        <a
          href={news.url}
          className="text-muted-foreground hover:text-primary transition-colors shrink-0"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </article>
  );
};
