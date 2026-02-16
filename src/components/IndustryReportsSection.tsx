import { useState } from "react";
import { FileText, ChevronDown, Download } from "lucide-react";
import { useIndustryReports } from "@/hooks/useNewsData";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground line-clamp-2">{report.title}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-medium text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded">
                      {report.broker}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{report.date}</span>
                    <span className="text-[11px] text-muted-foreground/60">조회 {report.views}</span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                {report.summary ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none
                    prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1.5
                    prose-p:text-foreground/80 prose-p:leading-relaxed prose-p:my-1
                    prose-li:text-foreground/80 prose-li:my-0.5
                    prose-strong:text-foreground prose-strong:font-semibold
                    prose-ul:my-1.5 prose-ol:my-1.5
                    text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {report.summary}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">요약 정보가 없습니다.</p>
                )}
                {report.pdf_url && (
                  <a
                    href={report.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
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
