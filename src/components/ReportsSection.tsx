import { useState } from "react";
import { ChevronDown, ExternalLink, Download } from "lucide-react";
import { PillLoader } from "@/components/PillLoader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustryReports } from "@/hooks/useNewsData";

// ── Types ──
type SubstackPost = {
  id: string; title: string; source: string; source_label: string;
  url: string; date: string; summary: string | null; is_free: boolean;
};
type IbricReport = {
  id: string; title: string; author: string | null; affiliation: string | null;
  description: string | null; summary: string | null; url: string; date: string; views: number | null;
};

// ── Summary text renderer (공통) ──
const SummaryText = ({ text }: { text: string }) => (
  <div className="text-[13px] text-muted-foreground leading-relaxed">
    {text.split("\n").map((line, idx) => {
      const t = line.trim();
      if (/^(\[.+\]|\*\*.+\*\*|#{1,6}\s)/.test(t))
        return <p key={idx} className="text-foreground/90 font-semibold mt-3 mb-1 first:mt-0">{t.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "")}</p>;
      if (t.startsWith("- ") || t.startsWith("* ") || t.startsWith("• "))
        return <p key={idx} className="pl-3 my-0.5"><span className="text-muted-foreground/50 mr-1">•</span>{t.replace(/^[-*•]\s*/, "").replace(/\*\*(.+?)\*\*/g, "$1")}</p>;
      if (!t) return <br key={idx} />;
      return <p key={idx} className="my-1">{t.replace(/\*\*(.+?)\*\*/g, "$1")}</p>;
    })}
  </div>
);

// ── 바이오위클리 ──
const BioWeeklyTab = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState("all");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["substack-posts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("substack_posts").select("*").eq("is_free", true).order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as SubstackPost[];
    },
  });

  const SOURCE_TABS = [
    { key: "all", label: "전체" },
    { key: "kiinbio", label: "Kiinbio" },
    { key: "decodingbio", label: "Decoding Bio" },
    { key: "techlifesci", label: "Bio Tech" },
    { key: "thebiobrief", label: "Bio Brief" },
  ];

  const filtered = sourceFilter === "all" ? posts : posts.filter((p) => p.source === sourceFilter);

  if (isLoading) return <PillLoader text="바이오 위클리 불러오는 중..." />;
  if (posts.length === 0) return <p className="text-sm text-muted-foreground text-center py-12">아직 수집된 글이 없습니다.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {SOURCE_TABS.map((tab) => (
          <button key={tab.key} onClick={() => setSourceFilter(tab.key)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${sourceFilter === tab.key ? "bg-sky-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {filtered.map((post) => {
        const isOpen = expandedId === post.id;
        return (
          <div key={post.id} className="bg-card border border-border rounded-lg overflow-hidden">
            <button onClick={() => setExpandedId(isOpen ? null : post.id)} className="w-full text-left p-4 hover:bg-muted/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground leading-snug">{post.title}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-semibold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">바이오위클리</span>
                    <span className="text-[11px] text-muted-foreground">{post.date}</span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform mt-0.5 ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                {post.summary ? <SummaryText text={post.summary} /> : <p className="text-sm text-muted-foreground italic">요약 정보가 없습니다.</p>}
                <a href={post.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background border border-border text-sky-600 hover:bg-muted transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />원문 보기
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── 동향리포트 ──
const IbricTab = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["ibric-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ibric_reports").select("*").order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as IbricReport[];
    },
  });

  if (isLoading) return <PillLoader text="동향 리포트 불러오는 중..." />;
  if (reports.length === 0) return <p className="text-sm text-muted-foreground text-center py-12">아직 수집된 동향 리포트가 없습니다.</p>;

  return (
    <div className="space-y-3">
      {reports.map((report) => {
        const isOpen = expandedId === report.id;
        return (
          <div key={report.id} className="bg-card border border-border rounded-lg overflow-hidden">
            <button onClick={() => setExpandedId(isOpen ? null : report.id)} className="w-full text-left p-4 hover:bg-muted/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground leading-snug">{report.title}</h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">동향리포트</span>
                    {report.author && <span className="text-[11px] text-muted-foreground">{report.author}{report.affiliation ? `(${report.affiliation})` : ""}</span>}
                    <span className="text-[11px] text-muted-foreground">{report.date}</span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform mt-0.5 ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                {report.summary ? <SummaryText text={report.summary} /> : <p className="text-sm text-muted-foreground italic">요약 정보가 없습니다.</p>}
                <a href={report.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background border border-border text-emerald-600 hover:bg-muted transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />원문 보기
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── 증권사리포트 ──
const IndustryTab = () => {
  const { data: reports = [], isLoading } = useIndustryReports();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <PillLoader text="리포트 불러오는 중..." />;
  if (reports.length === 0) return <p className="text-sm text-muted-foreground text-center py-12">아직 수집된 리포트가 없습니다.</p>;

  return (
    <div className="space-y-3">
      {reports.map((report) => {
        const isOpen = expandedId === report.id;
        return (
          <div key={report.id} className="bg-card border border-border rounded-lg overflow-hidden">
            <button onClick={() => setExpandedId(isOpen ? null : report.id)} className="w-full text-left p-4 hover:bg-muted/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground leading-snug">{report.title}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">{report.broker}</span>
                    <span className="text-[11px] text-muted-foreground">{report.date}</span>
                    {report.views && <span className="text-[11px] text-muted-foreground/60">조회 {report.views}</span>}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform mt-0.5 ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                {report.summary ? <SummaryText text={report.summary} /> : <p className="text-sm text-muted-foreground italic">요약 정보가 없습니다.</p>}
                {report.pdf_url && (
                  <a href={report.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background border border-border text-orange-600 hover:bg-muted transition-colors">
                    <Download className="w-3.5 h-3.5" />PDF 다운로드
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

// ── 메인 ReportsSection ──
type ReportTab = "all" | "bioweekly" | "ibric" | "industry";

const REPORT_TABS: { key: ReportTab; label: string; color: string; activeColor: string }[] = [
  { key: "all",       label: "전체",      color: "text-muted-foreground", activeColor: "bg-foreground text-background" },
  { key: "bioweekly", label: "바이오위클리", color: "text-sky-600",        activeColor: "bg-sky-500 text-white" },
  { key: "ibric",     label: "동향리포트",  color: "text-emerald-600",     activeColor: "bg-emerald-500 text-white" },
  { key: "industry",  label: "증권사리포트", color: "text-orange-600",      activeColor: "bg-orange-500 text-white" },
];

export const ReportsSection = () => {
  const [tab, setTab] = useState<ReportTab>("all");

  return (
    <div className="space-y-4">
      {/* 서브 탭 */}
      <div className="flex gap-1.5 flex-wrap">
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              tab === t.key ? t.activeColor : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      {(tab === "all" || tab === "bioweekly") && (
        <div>
          {tab === "all" && <p className="text-[11px] font-semibold text-sky-600 mb-2 tracking-wide">바이오위클리</p>}
          <BioWeeklyTab />
        </div>
      )}
      {(tab === "all" || tab === "ibric") && (
        <div>
          {tab === "all" && <p className="text-[11px] font-semibold text-emerald-600 mb-2 mt-4 tracking-wide">동향리포트</p>}
          <IbricTab />
        </div>
      )}
      {(tab === "all" || tab === "industry") && (
        <div>
          {tab === "all" && <p className="text-[11px] font-semibold text-orange-600 mb-2 mt-4 tracking-wide">증권사리포트</p>}
          <IndustryTab />
        </div>
      )}
    </div>
  );
};
