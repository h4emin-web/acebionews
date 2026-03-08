import { memo, useState, useRef, useEffect } from "react";
import { Clock, CalendarDays, LogIn, LogOut, User, EyeOff, Bookmark, NotebookPen, Bell, Plus, X } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type Props = {
  user: SupabaseUser | null;
  displayName: string;
  todayStr: string;
  todayOnly: boolean;
  showUnreadOnly: boolean;
  onLogoClick: () => void;
  onLoginClick: () => void;
  onLogout: () => void;
  onTodayToggle: () => void;
  onUnreadToggle: () => void;
  onScrapClick: () => void;
  onMemoToggle: () => void;
  memoOpen: boolean;
  scrapActive: boolean;
  keywords: string[];
  onAddKeyword: (kw: string) => void;
  onRemoveKeyword: (kw: string) => void;
  onKeywordClick: (kw: string) => void;
};

export const AppHeader = memo(({
  user, displayName, todayStr, todayOnly, showUnreadOnly,
  onLogoClick, onLoginClick, onLogout, onTodayToggle, onUnreadToggle,
  onScrapClick, onMemoToggle, memoOpen, scrapActive,
  keywords, onAddKeyword, onRemoveKeyword, onKeywordClick
}: Props) => {
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
    onAddKeyword(kw);
    setKwInput("");
  };

  return (
    <header className="border-b border-border sticky top-0 z-40 bg-background/90 backdrop-blur-md">
      <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <button onClick={onLogoClick} className="flex items-center gap-2 cursor-pointer">
          <div className="w-7 h-7 bg-foreground rounded-[5px] flex items-center justify-center shrink-0">
            <span className="text-[12px] font-extrabold text-background tracking-tight">BN</span>
          </div>
          <span className="text-[17px] font-bold text-foreground tracking-tight">BioNews</span>
        </button>
        <div className="flex items-center gap-2">
          {user ? (
            <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors shadow-sm">
              <User className="w-3.5 h-3.5" />
              <span className="max-w-[60px] truncate">{displayName}님</span>
              <LogOut className="w-3 h-3 text-muted-foreground" />
            </button>
          ) : (
            <button onClick={onLoginClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors shadow-sm">
              <LogIn className="w-3.5 h-3.5" />
              로그인
            </button>
          )}
          <button
            onClick={onTodayToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors shadow-sm ${
              todayOnly ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:bg-muted"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            오늘 뉴스
          </button>
          {user && (
            <button
              onClick={onUnreadToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors shadow-sm ${
                showUnreadOnly ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              안읽음만
            </button>
          )}

          {/* 스크랩 / 메모 / 키워드알림 */}
          {user && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <button
                onClick={onScrapClick}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors shadow-sm ${
                  scrapActive ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                스크랩
              </button>
              <button
                onClick={onMemoToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors shadow-sm ${
                  memoOpen ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                <NotebookPen className="w-3.5 h-3.5" />
                메모
              </button>
              <div className="relative" ref={kwRef}>
                <button
                  onClick={() => setKwOpen(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors shadow-sm ${
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
                            <button onClick={() => { onKeywordClick(kw); setKwOpen(false); }} className="hover:text-rose-900 hover:underline transition-colors">
                              {kw}
                            </button>
                            <button onClick={() => onRemoveKeyword(kw)} className="hover:text-rose-900 transition-colors ml-0.5">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
            <Clock className="w-3.5 h-3.5" />
            {todayStr} 기준
          </div>
        </div>
      </div>
    </header>
  );
});
AppHeader.displayName = "AppHeader";
