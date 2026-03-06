import { memo, useState, useRef, useEffect } from "react";
import { Clock, CalendarDays, LogIn, LogOut, User, EyeOff, Bell } from "lucide-react";
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
  keywords: string[];
  onAddKeyword: (kw: string) => void;
  onRemoveKeyword: (kw: string) => void;
  onAlertKeywordClick: (kw: string) => void;
};

const KeywordPopover = ({ keywords, onAdd, onRemove, onKeywordClick }: {
  keywords: string[];
  onAdd: (kw: string) => void;
  onRemove: (kw: string) => void;
  onKeywordClick: (kw: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAdd = () => {
    const kw = input.trim();
    if (kw && !keywords.includes(kw)) { onAdd(kw); setInput(""); }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors shadow-sm ${
          open ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background text-foreground hover:bg-muted"
        }`}
      >
        <Bell className="w-3.5 h-3.5" />
        키워드 알림
        {keywords.length > 0 && (
          <span className="ml-0.5 bg-rose-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {keywords.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-card border border-border rounded-lg shadow-xl z-50 p-3 space-y-2.5">
          <p className="text-[11px] text-muted-foreground">등록한 키워드가 포함된 뉴스에 🔔 배지가 표시됩니다</p>
          <div className="flex gap-1.5">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
              placeholder="키워드 입력"
              className="flex-1 px-2.5 py-1.5 rounded-md border border-border bg-background text-[12px] outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={handleAdd}
              disabled={!input.trim()}
              className="px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              추가
            </button>
          </div>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map(kw => (
                <span key={kw} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] bg-rose-50 text-rose-700 border border-rose-200">
                  <button onClick={() => { onKeywordClick(kw); setOpen(false); }} className="hover:underline">{kw}</button>
                  <button onClick={() => onRemove(kw)} className="hover:text-rose-900 ml-0.5 text-rose-400">×</button>
                </span>
              ))}
            </div>
          )}
          {keywords.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-1">등록된 키워드가 없습니다</p>
          )}
        </div>
      )}
    </div>
  );
};

export const AppHeader = memo((({
  user, displayName, todayStr, todayOnly, showUnreadOnly,
  onLogoClick, onLoginClick, onLogout, onTodayToggle, onUnreadToggle
}: Props) => {
  return (
    <header className="border-b border-border sticky top-0 z-40 bg-background/90 backdrop-blur-md">
      <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <button onClick={onLogoClick} className="flex items-center gap-1 cursor-pointer">
          <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-b from-primary to-teal-400 bg-clip-text text-transparent">Bio</span>
          <span className="text-2xl font-semibold tracking-tight text-foreground">news</span>
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
          <KeywordPopover
            keywords={keywords}
            onAdd={onAddKeyword}
            onRemove={onRemoveKeyword}
            onKeywordClick={onAlertKeywordClick}
          />
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
