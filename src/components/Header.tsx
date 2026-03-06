import { memo } from "react";
import { Clock, CalendarDays, LogIn, LogOut, User, EyeOff } from "lucide-react";
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
};

export const Header = memo(({
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
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
            <Clock className="w-3.5 h-3.5" />
            {todayStr} 기준
          </div>
        </div>
      </div>
    </header>
  );
});
Header.displayName = "Header";
