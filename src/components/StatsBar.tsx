import { Newspaper, Pill, Globe, MapPin } from "lucide-react";
import type { NewsArticle } from "@/hooks/useNewsData";

type Props = { news: NewsArticle[]; totalKeywords: number };

export const StatsBar = ({ news, totalKeywords }: Props) => {
  const domestic = news.filter((n) => n.region === "국내").length;
  const overseas = news.filter((n) => n.region === "해외").length;

  const stats = [
    { icon: Newspaper, label: "전체 뉴스", value: news.length, color: "text-primary" },
    { icon: MapPin, label: "국내", value: domestic, color: "text-pharma-blue" },
    { icon: Globe, label: "해외", value: overseas, color: "text-pharma-amber" },
    { icon: Pill, label: "원료 키워드", value: totalKeywords, color: "text-pharma-teal" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="card-elevated rounded-lg px-4 py-3 flex items-center gap-3">
          <s.icon className={`w-5 h-5 ${s.color}`} />
          <div>
            <p className="text-lg font-bold text-foreground font-mono">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
