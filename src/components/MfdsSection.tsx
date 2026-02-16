import { ExternalLink, FileText, AlertCircle, RefreshCw, ChevronDown } from "lucide-react";
import { useRegulatoryNotices, type RegulatoryNotice } from "@/hooks/useNewsData";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

const typeIcons: Record<string, React.ElementType> = {
  "안전성 서한": AlertCircle,
  "회수·폐기": AlertCircle,
  "공문": FileText,
  "안전성정보": AlertCircle,
  "허가변경": RefreshCw,
  "회수·판매중지": AlertCircle,
  "부작용": AlertCircle,
};

const typeColors: Record<string, string> = {
  "안전성 서한": "bg-destructive/10 text-destructive",
  "회수·폐기": "bg-destructive/10 text-destructive",
  "공문": "region-badge-mfds",
  "안전성정보": "bg-destructive/10 text-destructive",
  "허가변경": "region-badge-domestic",
  "회수·판매중지": "bg-destructive/10 text-destructive",
  "부작용": "region-badge-overseas",
};

type Props = {
  onKeywordClick: (kw: string) => void;
};

export const MfdsSection = ({ onKeywordClick }: Props) => {
  const { data: notices = [], isLoading } = useRegulatoryNotices("의약품안전나라");
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <AlertCircle className="w-4 h-4 text-pharma-blue" />
        <h2 className="text-sm font-semibold text-foreground">의약품안전나라</h2>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono mr-2">nedrug</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isLoading ? (
          <div className="px-5 py-6 text-center text-xs text-muted-foreground">검색중...</div>
        ) : notices.length === 0 ? (
          <div className="px-5 py-6 text-center text-xs text-muted-foreground">
            등록된 공지사항이 없습니다
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notices.map((n) => {
              const Icon = typeIcons[n.type] || FileText;
              return (
                <div key={n.id} className="px-5 py-3 hover:bg-muted/50 transition-colors group">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${typeColors[n.type] || "bg-muted text-muted-foreground"}`}>
                      <Icon className="w-3 h-3" />
                      {n.type}
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
                    {n.related_apis.map((api) => (
                      <button
                        key={api}
                        onClick={() => onKeywordClick(api)}
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-primary/8 text-primary hover:bg-primary/15 transition-colors cursor-pointer border border-primary/10 text-left"
                      >
                        {api}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
