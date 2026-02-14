import { ExternalLink, FlaskConical, ChevronDown } from "lucide-react";
import { useRegulatoryNotices } from "@/hooks/useNewsData";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

const phaseColors: Record<string, string> = {
  "Phase 1": "bg-sky-500/10 text-sky-600",
  "Phase 1 성공": "bg-sky-500/15 text-sky-700",
  "Phase 2": "bg-amber-500/10 text-amber-600",
  "Phase 2 성공": "bg-amber-500/15 text-amber-700",
  "Phase 2 승인": "bg-amber-500/15 text-amber-700",
  "Phase 3": "bg-emerald-500/10 text-emerald-600",
  "Phase 3 성공": "bg-emerald-600/15 text-emerald-700",
  "Phase 3 승인": "bg-emerald-600/15 text-emerald-700",
  "BLA": "bg-violet-500/10 text-violet-600",
  "BLA 승인": "bg-violet-500/15 text-violet-700",
  "Clinical Approval": "bg-emerald-500/10 text-emerald-600",
  "Clinical Hold": "bg-destructive/10 text-destructive",
};

type Props = {
  onKeywordClick: (kw: string) => void;
};

export const FdaClinicalSection = ({ onKeywordClick }: Props) => {
  const { data: notices = [], isLoading } = useRegulatoryNotices("FDA-Clinical");
  const [open, setOpen] = useState(true);

  const getPhaseColor = (type: string) => {
    return phaseColors[type] || Object.entries(phaseColors).find(([k]) => type.includes(k))?.[1] || "bg-muted text-muted-foreground";
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <FlaskConical className="w-4 h-4 text-violet-500" />
        <h2 className="text-sm font-semibold text-foreground">FDA 임상시험</h2>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono mr-2">🇺🇸 Clinical</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isLoading ? (
          <div className="px-5 py-6 text-center text-xs text-muted-foreground">검색중...</div>
        ) : notices.length === 0 ? (
          <div className="px-5 py-6 text-center text-xs text-muted-foreground">
            등록된 임상시험 정보가 없습니다
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notices.map((n) => (
              <div key={n.id} className="px-5 py-3 hover:bg-muted/50 transition-colors group">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${getPhaseColor(n.type)}`}>
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
                <div className="flex flex-wrap gap-1">
                  {n.related_apis.map((api) => (
                    <button
                      key={api}
                      onClick={() => onKeywordClick(api)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-primary/8 text-primary hover:bg-primary/15 transition-colors cursor-pointer border border-primary/10"
                    >
                      {api}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
