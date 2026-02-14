import { ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";

export type FdaNotice = {
  id: string;
  title: string;
  date: string;
  type: "Safety" | "Guidance" | "Approval" | "Warning";
  url: string;
  relatedApis: string[];
};

const mockFdaNotices: FdaNotice[] = [
  {
    id: "f1",
    title: "FDA, 니트로사민 불순물 관련 의약품 추가 리콜 조치",
    date: "2026-02-13",
    type: "Safety",
    url: "#",
    relatedApis: ["메트포르민", "라니티딘"],
  },
  {
    id: "f2",
    title: "GLP-1 수용체 작용제 안전성 업데이트 권고",
    date: "2026-02-11",
    type: "Guidance",
    url: "#",
    relatedApis: ["세마글루타이드", "리라글루타이드"],
  },
  {
    id: "f3",
    title: "신규 항암 원료의약품 DMF 심사 가이드라인 개정",
    date: "2026-02-09",
    type: "Guidance",
    url: "#",
    relatedApis: ["이마티닙", "레날리도마이드"],
  },
  {
    id: "f4",
    title: "제네릭 의약품 원료 생물학적 동등성 기준 변경 고시",
    date: "2026-02-07",
    type: "Guidance",
    url: "#",
    relatedApis: ["아토르바스타틴", "로수바스타틴"],
  },
  {
    id: "f5",
    title: "특정 중국산 원료의약품 수입 경고(Import Alert) 발행",
    date: "2026-02-05",
    type: "Warning",
    url: "#",
    relatedApis: ["헤파린", "파라세타몰"],
  },
];

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
  return (
    <div className="card-elevated rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-pharma-amber" />
        <h2 className="text-sm font-semibold text-foreground">미국 FDA 주요사항</h2>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono">🇺🇸 FDA</span>
      </div>
      <div className="divide-y divide-border">
        {mockFdaNotices.map((n) => (
          <div key={n.id} className="px-5 py-3 hover:bg-muted/50 transition-colors group">
            <div className="flex items-start justify-between gap-3 mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${typeColors[n.type] || ""}`}>
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
        ))}
      </div>
    </div>
  );
};
