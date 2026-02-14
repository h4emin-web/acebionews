import { ExternalLink, FileText, Bell, ClipboardList, ShieldCheck } from "lucide-react";
import type { MfdsNotice } from "@/data/mockNews";

type Props = {
  notices: MfdsNotice[];
  onKeywordClick: (kw: string) => void;
};

const typeIcons: Record<string, React.ElementType> = {
  "공문": FileText,
  "공지사항": Bell,
  "행정예고": ClipboardList,
  "허가": ShieldCheck,
};

const typeColors: Record<string, string> = {
  "공문": "region-badge-mfds",
  "공지사항": "region-badge-domestic",
  "행정예고": "region-badge-overseas",
  "허가": "bg-pharma-violet/10 text-pharma-violet",
};

export const MfdsSection = ({ notices, onKeywordClick }: Props) => {
  return (
    <div className="card-elevated rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-pharma-green" />
        <h2 className="text-sm font-semibold text-foreground">식약처 공문 · 공지사항</h2>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono">MFDS</span>
      </div>
      <div className="divide-y divide-border">
        {notices.map((n) => {
          const Icon = typeIcons[n.type] || FileText;
          return (
            <div key={n.id} className="px-5 py-3 hover:bg-muted/50 transition-colors group">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${typeColors[n.type] || ""}`}>
                    <Icon className="w-3 h-3" />
                    {n.type}
                  </span>
                </div>
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
                {n.relatedApis.map((api) => (
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
          );
        })}
      </div>
    </div>
  );
};
