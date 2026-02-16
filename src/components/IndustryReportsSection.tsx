import { FileText, ExternalLink, Download } from "lucide-react";
import { useIndustryReports } from "@/hooks/useNewsData";

export const IndustryReportsSection = () => {
  const { data: reports = [], isLoading } = useIndustryReports();

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
      {reports.map((report) => (
        <div
          key={report.id}
          className="bg-card border border-border rounded-lg p-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <a
                href={report.report_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2 flex items-center gap-1.5"
              >
                {report.title}
                <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
              </a>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[11px] font-medium text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded">
                  {report.broker}
                </span>
                <span className="text-[11px] text-muted-foreground">{report.date}</span>
                <span className="text-[11px] text-muted-foreground/60">조회 {report.views}</span>
              </div>
              {report.summary && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{report.summary}</p>
              )}
            </div>
            {report.pdf_url && (
              <a
                href={report.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-2 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                title="PDF 다운로드"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
