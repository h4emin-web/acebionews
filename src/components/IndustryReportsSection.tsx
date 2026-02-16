import { useState } from "react";
import { FileText, ChevronDown, Download } from "lucide-react";
import { useIndustryReports } from "@/hooks/useNewsData";

export const IndustryReportsSection = () => {
  const { data: reports = [], isLoading } = useIndustryReports();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="text-center py-16 card-elevated rounded-lg">
        <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3 animate-pulse" />
        <p className="text-muted-foreground text-sm">리포트 불러오는 중...</p>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-16 card-elevated rounded-lg">
        <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
        <p className="text-muted-foreground text-sm">아직 수집된 리포트가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => {
        const isOpen = expandedId === report.id;
        return (
          <div
            key={report.id}
            className="bg-card border border-border rounded-lg overflow-hidden transition-colors"
          >
            <button
              onClick={() => setExpandedId(isOpen ? null : report.id)}
              className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground leading-snug break-all">{report.title}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-medium text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded">
                      {report.broker}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{report.date}</span>
                    <span className="text-[11px] text-muted-foreground/60">조회 {report.views}</span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform mt-0.5 ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                {report.summary ? (
                  <div className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-line">
                    {report.summary.split('\n').map((line, idx) => {
                      const trimmed = line.trim();
                      // Style [핵심 요약], [주요 내용] headers
                      if (/^\[.+\]$/.test(trimmed)) {
                        return (
                          <p key={idx} className="text-foreground/90 text-[13px] font-semibold mt-3 mb-1 first:mt-0">
                            {trimmed}
                          </p>
                        );
                      }
                      // Style **bold** headers (fallback for old format)
                      if (/^\*\*.+\*\*$/.test(trimmed)) {
                        return (
                          <p key={idx} className="text-foreground/90 text-[13px] font-semibold mt-3 mb-1 first:mt-0">
                            {trimmed.replace(/\*\*/g, '')}
                          </p>
                        );
                      }
                      // Style ## headers (fallback for old format)
                      if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
                        return (
                          <p key={idx} className="text-foreground/90 text-[13px] font-semibold mt-3 mb-1 first:mt-0">
                            {trimmed.replace(/^#+\s*/, '')}
                          </p>
                        );
                      }
                      // Bullet points
                      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
                        return (
                          <p key={idx} className="pl-3 my-0.5">
                            <span className="text-muted-foreground/60 mr-1">•</span>
                            {trimmed.replace(/^[-*•]\s*/, '').replace(/\*\*(.+?)\*\*/g, '$1')}
                          </p>
                        );
                      }
                      if (!trimmed) return <br key={idx} />;
                      return <p key={idx} className="my-1">{trimmed.replace(/\*\*(.+?)\*\*/g, '$1')}</p>;
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">요약 정보가 없습니다.</p>
                )}
                {report.pdf_url && (
                  <a
                    href={report.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background border border-border text-destructive hover:bg-muted transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF 다운로드
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
