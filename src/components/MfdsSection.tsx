import { ExternalLink, FileText, Bell, ClipboardList, ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";
import { useRegulatoryNotices, type RegulatoryNotice } from "@/hooks/useNewsData";

const typeIcons: Record<string, React.ElementType> = {
  "안전성 서한": AlertCircle,
  "회수·폐기": AlertCircle,
  "공문": FileText,
  "안전성정보": AlertCircle,
  "허가변경": RefreshCw,
  "회수·판매중지": AlertCircle,
  "부작용": AlertCircle,
  "공지사항": Bell,
  "행정예고": ClipboardList,
  "허가": ShieldCheck,
};

const typeColors: Record<string, string> = {
  "안전성 서한": "bg-destructive/10 text-destructive",
  "회수·폐기": "bg-destructive/10 text-destructive",
  "공문": "region-badge-mfds",
  "안전성정보": "bg-destructive/10 text-destructive",
  "허가변경": "region-badge-domestic",
  "회수·판매중지": "bg-destructive/10 text-destructive",
  "부작용": "region-badge-overseas",
  "공지사항": "region-badge-domestic",
  "행정예고": "region-badge-overseas",
  "허가": "bg-pharma-violet/10 text-pharma-violet",
};

type Props = {
  onKeywordClick: (kw: string) => void;
};

function NoticeList({ notices, onKeywordClick }: { notices: RegulatoryNotice[]; onKeywordClick: (kw: string) => void }) {
  if (notices.length === 0) {
    return (
      <div className="px-5 py-6 text-center text-xs text-muted-foreground">
        등록된 공지사항이 없습니다
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {notices.map((n) => {
        const Icon = typeIcons[n.type] || FileText;
        return (
          <div key={n.id} className="px-5 py-3 hover:bg-muted/50 transition-colors group">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${typeColors[n.type] || "bg-muted text-muted-foreground"}`}>
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
        );
      })}
    </div>
  );
}

export const MfdsSection = ({ onKeywordClick }: Props) => {
  const { data: nedrugNotices = [], isLoading: nedrugLoading } = useRegulatoryNotices("의약품안전나라");

  return (
    <div className="card-elevated rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-pharma-blue" />
        <h2 className="text-sm font-semibold text-foreground">의약품안전나라</h2>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono">nedrug</span>
      </div>
      {nedrugLoading ? (
        <div className="px-5 py-6 text-center text-xs text-muted-foreground">검색중...</div>
      ) : (
        <NoticeList notices={nedrugNotices} onKeywordClick={onKeywordClick} />
      )}
    </div>
  );
};
