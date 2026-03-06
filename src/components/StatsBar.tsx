import type { NewsArticle } from "@/hooks/useNewsData";

export type RegionFilter = "all" | "국내" | "해외" | "스크랩" | "리포트" | "nedrug";

type Props = {
  news: NewsArticle[];
  totalReports: number;
  totalBioWeekly: number;
  totalIbricReports: number;
  regionFilter: RegionFilter;
  onRegionFilterChange: (r: RegionFilter) => void;
  bookmarkCount?: number;
  isLoggedIn?: boolean;
};

export const StatsBar = ({ regionFilter, onRegionFilterChange, isLoggedIn }: Props) => {
  const tabs = [
    { label: "전체", filter: "all" as const },
    { label: "국내", filter: "국내" as const },
    { label: "해외", filter: "해외" as const },
    ...(isLoggedIn ? [{ label: "스크랩", filter: "스크랩" as const }] : []),
    { label: "리포트", filter: "리포트" as const },
    { label: "Nedrug", filter: "nedrug" as const },
  ];

  return (
    <nav className="flex items-center gap-0 border-b border-border overflow-x-auto scrollbar-hide -mx-4 px-4">
      {tabs.map((tab) => {
        const isActive = regionFilter === tab.filter;
        return (
          <button
            key={tab.label}
            onClick={() => onRegionFilterChange(isActive && tab.filter !== "all" ? "all" : tab.filter)}
            className={`px-5 py-3 text-sm whitespace-nowrap border-b-2 transition-colors shrink-0 ${
              isActive
                ? "border-foreground text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground font-normal"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
};
