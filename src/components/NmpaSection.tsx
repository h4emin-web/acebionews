import { useState, useMemo } from "react";
import { AlertTriangle, ExternalLink, RefreshCw, FileText, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PillLoader } from "@/components/PillLoader";
import { Badge } from "@/components/ui/badge";

type NmpaNotice = {
  id: string;
  title: string;
  title_ko: string | null;
  summary: string | null;
  url: string | null;
  date: string;
  is_suspension_alert: boolean;
};

function useNmpaNotices() {
  return useQuery({
    queryKey: ["nmpa-notices"],
    queryFn: async (): Promise<NmpaNotice[]> => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const since = twoWeeksAgo.toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("nmpa_notices" as any)
        .select("*")
        .gte("date", since)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as NmpaNotice[];
    },
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}

const isNew = (d: string) => (Date.now() - new Date(d).getTime()) / 86400000 <= 3;

export const NmpaSection = () => {
  const { data: notices = [], isLoading, isError, refetch, isFetching } = useNmpaNotices();
  const [alertOnly, setAlertOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = alertOnly ? notices.filter(n => n.is_suspension_alert) : notices;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        (n.title_ko || "").toLowerCase().includes(q) ||
        n.title.toLowerCase().includes(q) ||
        (n.summary || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [notices, alertOnly, search]);

  const alertCount = notices.filter(n => n.is_suspension_alert).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-foreground">NMPA 의약품 공고</h2>
          <span className="text-xs text-muted-foreground">(최근 2주)</span>
          {alertCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold border border-red-200">
              <AlertTriangle className="w-3 h-3" />
              수입중단 {alertCount}건
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAlertOnly(v => !v)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              alertOnly ? "bg-red-600 text-white border-red-600" : "border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            수입중단만
          </button>
          <button onClick={() => refetch()} disabled={isFetching} className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><PillLoader /></div>
      ) : isError ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-muted-foreground text-sm">NMPA 데이터를 불러올 수 없습니다.</p>
          <p className="text-xs text-muted-foreground">DB 테이블이 아직 생성되지 않았거나 크롤러가 실행되지 않았습니다.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {alertOnly ? "최근 2주간 수입중단 공고가 없습니다." : "최근 2주간 공고가 없습니다."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(notice => (
            <div
              key={notice.id}
              className={`rounded-xl border p-4 transition-colors cursor-pointer hover:bg-muted/30 ${
                notice.is_suspension_alert
                  ? "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900"
                  : "border-border bg-card"
              }`}
              onClick={() => setExpanded(expanded === notice.id ? null : notice.id)}
            >
              <div className="flex items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {notice.is_suspension_alert && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-bold shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        수입중단 알림
                      </span>
                    )}
                    {isNew(notice.date) && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">NEW</Badge>
                    )}
                    <span className="text-xs text-muted-foreground shrink-0">{notice.date}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-snug">{notice.title}</p>
                </div>
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>

              {(expanded === notice.id || notice.is_suspension_alert) && notice.summary && (
                <div className={`mt-3 pt-3 border-t text-[13px] text-foreground leading-relaxed whitespace-pre-wrap ${
                  notice.is_suspension_alert ? "border-red-200" : "border-border"
                }`}>
                  {notice.summary}
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                {!notice.is_suspension_alert && notice.summary && (
                  <span className="text-xs text-muted-foreground">
                    {expanded === notice.id ? "접기 ▲" : "요약 보기 ▼"}
                  </span>
                )}
                {notice.url && (
                  <a
                    href={notice.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs text-primary hover:underline ml-auto"
                  >
                    원문 보기 <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
