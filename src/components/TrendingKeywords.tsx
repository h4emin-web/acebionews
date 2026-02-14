import type { NewsItem } from "@/data/mockNews";

type Props = {
  news: NewsItem[];
  onKeywordClick: (kw: string) => void;
};

export const TrendingKeywords = ({ news, onKeywordClick }: Props) => {
  // Count keyword frequency
  const kwCount: Record<string, number> = {};
  news.forEach((n) => n.apiKeywords.forEach((kw) => {
    kwCount[kw] = (kwCount[kw] || 0) + 1;
  }));

  const sorted = Object.entries(kwCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return (
    <div className="glass-card rounded-lg p-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        🔥 트렌딩 원료 키워드
      </h3>
      <div className="flex flex-wrap gap-2">
        {sorted.map(([kw, count]) => (
          <button
            key={kw}
            onClick={() => onKeywordClick(kw)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-secondary hover:bg-primary/15 hover:text-primary text-secondary-foreground transition-all cursor-pointer"
          >
            {kw}
            <span className="text-[10px] text-muted-foreground">({count})</span>
          </button>
        ))}
      </div>
    </div>
  );
};
