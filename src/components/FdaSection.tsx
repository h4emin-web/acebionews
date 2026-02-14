import { ExternalLink, AlertTriangle } from "lucide-react";
import { useRegulatoryNotices } from "@/hooks/useNewsData";

const typeColors: Record<string, string> = {
  Safety: "bg-destructive/10 text-destructive",
  Guidance: "region-badge-domestic",
  Approval: "region-badge-mfds",
  Warning: "region-badge-overseas",
};

type Props = {
  onKeywordClick: (kw: string) => void;
};

export const FdaSection = ({ onKeywordClick }: Props) => {
  const { data: notices = [], isLoading } = useRegulatoryNotices("FDA");

  return (
    <div className="card-elevated rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-pharma-amber" />
        <h2 className="text-sm font-semibold text-foreground">미국 FDA 주요사항</h2>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono">🇺🇸 FDA</span>
      </div>
      {isLoading ? (
        <div className="px-5 py-6 text-center text-xs text-muted-foreground">로딩 중...</div>
      ) : notices.length === 0 ? (
        <div className="px-5 py-6 text-center text-xs text-muted-foreground">
          등록된 FDA 공지사항이 없습니다
        </div>
      ) : (
        <div className="divide-y divide-border">
          {notices.map((n) => (
            <div key={n.id} className="px-5 py-3 hover:bg-muted/50 transition-colors group">
              <div className="flex items-start justify-between gap-3 mb-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${typeColors[n.type] || "bg-muted text-muted-foreground"}`}>
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
                    className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-muted text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors cursor-pointer"
                  >
                    {api}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
