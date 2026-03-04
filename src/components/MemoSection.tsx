import { useState, useEffect } from "react";
import { NotebookPen, ChevronDown, FileText, StickyNote } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type NewsItem = {
  id: string;
  title: string;
  memo: string;
};

type Props = {
  user: User | null;
  bookmarkedArticles: any[];
  memoMap: Record<string, string>;
  onNewsClick: (articleId: string) => void;
};

export const MemoSection = ({ user, bookmarkedArticles, memoMap, onNewsClick }: Props) => {
  const [open, setOpen] = useState(false);
  const [newsMemosOpen, setNewsMemosOpen] = useState(false);
  const [freeMemosOpen, setFreeMemosOpen] = useState(false);
  const [freeMemo, setFreeMemo] = useState("");
  const [saving, setSaving] = useState(false);

  // 자유 메모 불러오기
  useEffect(() => {
    if (!user) return;
    const key = `free_memo_${user.id}`;
    const saved = localStorage.getItem(key);
    if (saved) setFreeMemo(saved);
  }, [user]);

  // 자유 메모 자동저장 (1초 debounce, localStorage)
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`free_memo_${user.id}`, freeMemo);
      setSaving(true);
      setTimeout(() => setSaving(false), 1000);
    }, 1000);
    return () => clearTimeout(timer);
  }, [freeMemo, user]);

  // 메모 있는 스크랩 뉴스만 필터
  const newsWithMemos: NewsItem[] = bookmarkedArticles
    .map((a: any) => ({ id: a.id, title: a.title, memo: memoMap[a.id] || "" }))
    .filter((a) => a.memo.trim() !== "");

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <NotebookPen className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">메모</h2>
        <ChevronDown className={`w-4 h-4 text-muted-foreground ml-auto transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-3 space-y-2">

          {/* 뉴스 메모 */}
          <Collapsible open={newsMemosOpen} onOpenChange={setNewsMemosOpen}>
            <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-foreground">뉴스 메모</span>
              {newsWithMemos.length > 0 && (
                <span className="text-[10px] text-muted-foreground ml-1">{newsWithMemos.length}개</span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform duration-200 ${newsMemosOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 space-y-1 pl-2">
                {newsWithMemos.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground px-3 py-2">스크랩 뉴스에 메모가 없습니다</p>
                ) : (
                  newsWithMemos.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={() => onNewsClick(item.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors group"
                    >
                      <p className="text-[11px] text-muted-foreground mb-0.5 group-hover:text-primary transition-colors truncate">
                        {i + 1}. {item.title}
                      </p>
                      <p className="text-[11px] text-foreground truncate">📝 {item.memo}</p>
                    </button>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="border-t border-border" />

          {/* 일반 메모 */}
          <Collapsible open={freeMemosOpen} onOpenChange={setFreeMemosOpen}>
            <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
              <StickyNote className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-foreground">일반 메모</span>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform duration-200 ${freeMemosOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-2 pt-1 pb-2">
                <textarea
                  value={freeMemo}
                  onChange={(e) => setFreeMemo(e.target.value)}
                  placeholder="자유롭게 메모하세요... (자동저장)"
                  className="w-full resize-none rounded-lg border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary p-2.5 min-h-[120px]"
                />
                <p className={`text-[10px] text-right mt-1 transition-opacity duration-300 ${saving ? "text-green-500 opacity-100" : "text-muted-foreground opacity-40"}`}>
                  {saving ? "저장됨 ✓" : "자동저장"}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
