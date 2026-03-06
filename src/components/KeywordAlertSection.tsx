import { useState } from "react";
import { Bell, X, Plus, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { User } from "@supabase/supabase-js";

type Props = {
  user: User | null;
  keywords: string[];
  onAdd: (kw: string) => void;
  onRemove: (kw: string) => void;
  onKeywordClick: (kw: string) => void;
};

export const KeywordAlertSection = ({ keywords, onAdd, onRemove, onKeywordClick }: Props) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const kw = input.trim();
    if (!kw || keywords.includes(kw)) return;
    onAdd(kw);
    setInput("");
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <Bell className="w-4 h-4 text-rose-500" />
        <h2 className="text-sm font-semibold text-foreground">키워드 알림</h2>
        {keywords.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500 text-white">{keywords.length}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground ml-auto transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-3 space-y-2.5">
          <p className="text-[11px] text-muted-foreground px-1">등록한 키워드가 포함된 뉴스에 🔔 배지가 표시됩니다</p>

          {/* 입력창 */}
          <div className="flex gap-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="키워드 입력 후 Enter"
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleAdd}
              disabled={!input.trim() || keywords.includes(input.trim())}
              className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 등록된 키워드 목록 */}
          {keywords.length === 0 ? (
            <p className="text-[11px] text-muted-foreground px-1">등록된 키워드가 없습니다</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                  <button onClick={() => onKeywordClick(kw)} className="hover:text-rose-900 hover:underline transition-colors">
                    {kw}
                  </button>
                  <button onClick={() => onRemove(kw)} className="hover:text-rose-900 transition-colors ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
