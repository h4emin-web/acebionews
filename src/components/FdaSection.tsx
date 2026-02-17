import { ExternalLink, AlertTriangle, ChevronDown } from "lucide-react";
import { useRegulatoryNotices } from "@/hooks/useNewsData";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

const typeLabels: Record<string, string> = {
  "Safety Alert": "Alert",
  "Statement": "Statement",
  "Drug Recall": "Recall",
  "Warning": "Warning",
};

const typeColors: Record<string, string> = {
  "Safety Alert": "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  "Statement": "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  "Drug Recall": "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  "Warning": "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  "NDA Approval": "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  Guidance: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  Approval: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
};

type Props = {
  onKeywordClick: (kw: string) => void;
};

export const FdaSection = ({ onKeywordClick }: Props) => {
  const { data: notices = [], isLoading } = useRegulatoryNotices("FDA");
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <AlertTriangle className="w-4 h-4 text-pharma-amber" />
        <h2 className="text-sm font-semibold text-foreground">미국 FDA Alerts & Statements</h2>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono mr-2">FDA</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isLoading ?
        <div className="px-5 py-6 text-center text-xs text-muted-foreground">검색중...</div> :
        notices.length === 0 ?
        <div className="px-5 py-6 text-center text-xs text-muted-foreground">
            등록된 FDA 공지사항이 없습니다
          </div> :

        <div className="divide-y divide-border">
            {notices.map((n) =>
          <div key={n.id} className="px-5 py-3 hover:bg-muted/50 transition-colors group">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${typeColors[n.type] || "bg-muted text-muted-foreground"}`}>
                    {typeLabels[n.type] || n.type}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-muted-foreground font-mono">{n.date}</span>
                    <a href={n.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors leading-snug mb-1.5">
                  {n.title}
                </p>
                <div className="flex flex-wrap gap-1 justify-start">
                  {n.related_apis.map((api) =>
              <button
                key={api}
                onClick={() => onKeywordClick(api)}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-primary/8 text-primary hover:bg-primary/15 transition-colors cursor-pointer border border-primary/10 text-left">

                      {api}
                    </button>
              )}
                </div>
              </div>
          )}
          </div>
        }
      </CollapsibleContent>
    </Collapsible>);

};