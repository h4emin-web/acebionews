import { Newspaper, FileText, Globe, MapPin, BookOpen, TrendingUp } from "lucide-react";
import type { NewsArticle } from "@/hooks/useNewsData";

type Props = {
  news: NewsArticle[];
  totalReports: number;
  totalBioWeekly: number;
  totalIbricReports: number;
  regionFilter: "all" | "국내" | "해외" | "리포트" | "바이오위클리" | "동향리포트";
  onRegionFilterChange: (r: "all" | "국내" | "해외" | "리포트" | "바이오위클리" | "동향리포트") => void;
};

export const StatsBar = ({ news, totalReports, totalBioWeekly, totalIbricReports, regionFilter, onRegionFilterChange }: Props) => {
  const domestic = news.filter((n) => n.region === "국내").length;
  const overseas = news.filter((n) => n.region === "해외").length;

  const stats = [
    { icon: Newspaper, emoji: "📰", label: "전체 뉴스", value: news.length, color: "text-primary", filter: "all" as const },
    { icon: MapPin, emoji: "🇰🇷", label: "국내", value: domestic, color: "text-pharma-blue", filter: "국내" as const },
    { icon: Globe, emoji: "🌍", label: "해외", value: overseas, color: "text-pharma-amber", filter: "해외" as const },
    { icon: BookOpen, emoji: "📖", label: "바이오 위클리", value: totalBioWeekly, color: "text-pharma-violet", filter: "바이오위클리" as const },
    { icon: TrendingUp, emoji: "📊", label: "동향 리포트", value: totalIbricReports, color: "text-pharma-green", filter: "동향리포트" as const },
    { icon: FileText, emoji: "📋", label: "제약 리포트", value: totalReports, color: "text-pharma-teal", filter: "리포트" as const },
  ];

  return (
    <>
      {/* Desktop/Tablet layout */}
      <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => {
          const isActive = regionFilter === s.filter;
          return (
            <div
              key={s.label}
              onClick={() => onRegionFilterChange(isActive && s.filter !== "all" ? "all" : s.filter)}
              className={`card-elevated rounded-lg px-4 py-3 flex items-center gap-3 transition-all cursor-pointer hover:bg-muted/50 ${
                isActive ? "ring-2 ring-primary" : ""
              }`}
            >
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-xl font-bold text-foreground font-mono">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile layout - compact horizontal */}
      <div className="flex md:hidden gap-1.5 overflow-x-auto scrollbar-hide">
        {stats.map((s) => {
          const isActive = regionFilter === s.filter;
          return (
            <button
              key={s.label}
              onClick={() => onRegionFilterChange(isActive && s.filter !== "all" ? "all" : s.filter)}
              className={`flex flex-col items-center justify-center min-w-[3.5rem] px-2 py-2 rounded-lg transition-all shrink-0 ${
                isActive ? "bg-primary/10 ring-1.5 ring-primary" : "bg-card border border-border"
              }`}
            >
              <span className="text-base leading-none">{s.emoji}</span>
              <span className={`text-[10px] mt-1 whitespace-nowrap ${isActive ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
};
