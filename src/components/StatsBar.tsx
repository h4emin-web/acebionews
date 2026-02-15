import { Newspaper, Pill, Globe, MapPin } from "lucide-react";
import type { NewsArticle } from "@/hooks/useNewsData";

type Props = {
  news: NewsArticle[];
  totalKeywords: number;
  regionFilter: "all" | "국내" | "해외";
  onRegionFilterChange: (r: "all" | "국내" | "해외") => void;
};

export const StatsBar = ({ news, totalKeywords, regionFilter, onRegionFilterChange }: Props) => {
  const domestic = news.filter((n) => n.region === "국내").length;
  const overseas = news.filter((n) => n.region === "해외").length;

  const stats = [
    { icon: Newspaper, label: "전체 뉴스", value: news.length, color: "text-primary", filter: "all" as const },
    { icon: MapPin, label: "국내", value: domestic, color: "text-pharma-blue", filter: "국내" as const },
    { icon: Globe, label: "해외", value: overseas, color: "text-pharma-amber", filter: "해외" as const },
    { icon: Pill, label: "원료 키워드", value: totalKeywords, color: "text-pharma-teal", filter: null },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => {
        const isClickable = s.filter !== null;
        const isActive = s.filter !== null && regionFilter === s.filter;
        return (
          <div
            key={s.label}
            onClick={() => isClickable && onRegionFilterChange(isActive && s.filter !== "all" ? "all" : s.filter!)}
            className={`card-elevated rounded-lg px-4 py-3 flex items-center gap-3 transition-all ${
              isClickable ? "cursor-pointer hover:bg-muted/50" : ""
            } ${isActive ? "ring-2 ring-primary" : ""}`}
          >
            <s.icon className={`w-5 h-5 ${s.color}`} />
            <div>
              <p className="text-lg font-bold text-foreground font-mono">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
