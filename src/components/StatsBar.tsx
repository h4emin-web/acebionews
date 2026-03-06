import type { NewsArticle } from "@/hooks/useNewsData";

export type RegionFilter = "all" | "국내" | "해외" | "스크랩" | "리포트" | "바이오위클리" | "동향리포트";

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
    { label: "바이오위클리", filter: "바이오위클리" as const },
    { label: "동향리포트", filter: "동향리포트" as const },
    { label: "제약리포트", filter: "리포트" as const },
  ];

  return (
    <nav className="flex items-center gap-8 px-2 border-b border-border overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => {
        const isActive = regionFilter === tab.filter;
        return (
          <button
            key={tab.label}
            onClick={() => onRegionFilterChange(isActive && tab.filter !== "all" ? "all" : tab.filter)}
            className={`py-3.5 text-[14px] whitespace-nowrap transition-colors relative shrink-0 ${
              isActive
                ? "text-foreground font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-foreground"
                : "text-muted-foreground hover:text-foreground font-normal"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
};
