import type { NewsItem } from "@/data/mockNews";

type Props = {
  news: NewsItem[];
  onKeywordClick: (kw: string) => void;
};

export const TrendingKeywords = ({ news, onKeywordClick }: Props) => {
  const kwCount: Record<string, number> = {};
  news.forEach((n) => n.apiKeywords.forEach((kw) => {
    kwCount[kw] = (kwCount[kw] || 0) + 1;
  }));

  const top5 = Object.entries(kwCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="card-elevated rounded-lg px-5 py-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        이달의 주요 원료 키워드
      </h3>
      <div className="flex flex-wrap gap-2">
        {top5.map(([kw, count], i) => (
          <button
            key={kw}
            onClick={() => onKeywordClick(kw)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono bg-muted hover:bg-primary/10 hover:text-primary text-foreground transition-all cursor-pointer"
          >
            <span className="text-primary font-semibold text-[11px]">{i + 1}</span>
            {kw}
            <span className="text-[10px] text-muted-foreground">({count})</span>
          </button>
        ))}
      </div>
    </div>
  );
};
