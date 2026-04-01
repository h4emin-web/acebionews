import { useState, useRef, useEffect } from "react";
import { Bookmark, NotebookPen, Bell, Plus, X, ExternalLink } from "lucide-react";
import type { NewsArticle } from "@/hooks/useNewsData";
import { useIsMobile } from "@/hooks/use-mobile";

export type RegionFilter = "all" | "국내" | "해외" | "스크랩" | "리포트" | "nedrug" | "nmpa" | "fda" | "bigdeal";

type Props = {
  news: NewsArticle[];
  totalReports: number;
  totalBioWeekly: number;
  totalIbricReports: number;
  regionFilter: RegionFilter;
  onRegionFilterChange: (r: RegionFilter) => void;
  bookmarkCount?: number;
  isLoggedIn?: boolean;
  displayName?: string;
  onScrapClick?: () => void;
  onMemoToggle?: () => void;
  memoOpen?: boolean;
  scrapActive?: boolean;
  keywords?: string[];
  onAddKeyword?: (kw: string) => void;
  onRemoveKeyword?: (kw: string) => void;
  onKeywordClick?: (kw: string) => void;
};

export const StatsBar = ({
  regionFilter, onRegionFilterChange, isLoggedIn, displayName,
  onScrapClick, onMemoToggle, memoOpen, scrapActive,
  keywords = [], onAddKeyword, onRemoveKeyword, onKeywordClick,
}: Props) => {
  const isMobile = useIsMobile();
  const [kwOpen, setKwOpen] = useState(false);
  const [kwInput, setKwInput] = useState("");
  const kwRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (kwRef.current && !kwRef.current.contains(e.target as Node)) setKwOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAddKw = () => {
    const kw = kwInput.trim();
    if (!kw || keywords.includes(kw)) return;
    onAddKeyword?.(kw);
    setKwInput("");
  };

  const allTabs = [
    { label: "전체", filter: "all" as const, mobileVisible: true },
    { label: "국내", filter: "국내" as const, mobileVisible: true },
    { label: "해외", filter: "해외" as const, mobileVisible: true },
    { label: "리포트", filter: "리포트" as const, mobileVisible: true },
    { label: "Nedrug", filter: "nedrug" as const, mobileVisible: false },
    { label: "NMPA", filter: "nmpa" as const, mobileVisible: false },
    { label: "FDA", filter: "fda" as const, mobileVisible: false },
    { label: "Big Deal", filter: "bigdeal" as const, mobileVisible: false },
  ];

  const tabs = isMobile ? allTabs.filter(t => t.mobileVisible) : allTabs;

  return (
    <nav className="flex items-center border-b border-border -mx-4 px-4">
      <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
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
      </div>

      {isLoggedIn && (
        <div className="ml-auto flex items-center gap-1.5 shrink-0 pl-3">
          {displayName === "해민" && (
            <a
              href="https://searching-manufaturer.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              소싱
            </a>
          )}
          <button
            onClick={onScrapClick}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              scrapActive ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            스크랩
          </button>
          <button
            onClick={onMemoToggle}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              memoOpen ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            <NotebookPen className="w-3.5 h-3.5" />
            메모
          </button>
          <div className="relative" ref={kwRef}>
            <button
              onClick={() => setKwOpen(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                kwOpen ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              키워드
              {keywords.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500 text-white leading-none">{keywords.length}</span>
              )}
            </button>
            {kwOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-lg shadow-lg z-50 p-3 space-y-2.5">
                <p className="text-[11px] text-muted-foreground">등록한 키워드가 포함된 뉴스에 🔔 배지가 표시됩니다</p>
                <div className="flex gap-1.5">
                  <input
                    value={kwInput}
                    onChange={(e) => setKwInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddKw(); }}
                    placeholder="키워드 입력 후 Enter"
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={handleAddKw}
                    disabled={!kwInput.trim() || keywords.includes(kwInput.trim())}
                    className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] disabled:opacity-40 hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {keywords.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">등록된 키워드가 없습니다</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((kw) => (
                      <span key={kw} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                        <button onClick={() => { onKeywordClick?.(kw); setKwOpen(false); }} className="hover:text-rose-900 hover:underline transition-colors">
                          {kw}
                        </button>
                        <button onClick={() => onRemoveKeyword?.(kw)} className="hover:text-rose-900 transition-colors ml-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
