import { useState } from "react";
import { ChevronDown, ExternalLink, Download } from "lucide-react";
import { PillLoader } from "@/components/PillLoader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustryReports } from "@/hooks/useNewsData";

type SubstackPost = {
  id: string; title: string; source: string; source_label: string;
  url: string; date: string; summary: string | null; is_free: boolean;
  _type: "bioweekly";
};
type IbricReport = {
  id: string; title: string; author: string | null; affiliation: string | null;
  summary: string | null; url: string; date: string; views: number | null;
  _type: "ibric";
};
type IndustryReport = {
  id: string; title: string; broker: string; date: string;
  summary: string | null; pdf_url: string | null; views: number | null;
  _type: "industry";
};
type AnyReport = SubstackPost | IbricReport | IndustryReport;

const SummaryText = ({ text }: { text: string }) => (
  <div className="text-[13px] text-muted-foreground leading-relaxed">
    {text.split("\n").map((line, idx) => {
      const t = line.trim();
      if (/^(\[.+\]|\*\*.+\*\*|#{1,6}\s)/.test(t))
        return <p key={idx} className="text-foreground/90 font-semibold mt-3 mb-1 first:mt-0">{t.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "")}</p>;
      if (t.startsWith("- ") || t.startsWith("* ") || t.startsWith("• "))
        return <p key={idx} className="pl-3 my-0.5"><span className="text-muted-foreground/40 mr-1">•</span>{t.replace(/^[-*•]\s*/, "").replace(/\*\*(.+?)\*\*/g, "$1")}</p>;
      if (!t) return <br key={idx} />;
      return <p key={idx} className="my-1">{t.replace(/\*\*(.+?)\*\*/g, "$1")}</p>;
    })}
  </div>
);

const BADGE = {
  bioweekly: "text-foreground",
  ibric:     "text-foreground",
  industry:  "text-foreground",
};
const LINK_COLOR = {
  bioweekly: "text-foreground",
  ibric:     "text-foreground",
  industry:  "text-foreground",
};

type ReportTab = "all" | "bioweekly" | "ibric" | "industry";
const TABS: { key: ReportTab; label: string }[] = [
  { key: "all",       label: "전체" },
  { key: "bioweekly", label: "바이오위클리" },
  { key: "ibric",     label: "동향리포트" },
  { key: "industry",  label: "증권사리포트" },
];

export const ReportsSection = () => {
  const [tab, setTab] = useState<ReportTab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: posts = [], isLoading: l1 } = useQuery({
    queryKey: ["substack-posts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("substack_posts").select("*").eq("is_free", true).order("date", { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({ ...d, _type: "bioweekly" as const }));
    },
  });

  const { data: ibric = [], isLoading: l2 } = useQuery({
    queryKey: ["ibric-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ibric_reports").select("*").order("date", { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({ ...d, _type: "ibric" as const }));
    },
  });

  const { data: industry = [], isLoading: l3 } = useIndustryReports();
  const industryTyped = (industry as any[]).map((d) => ({ ...d, _type: "industry" as const }));

  const isLoading = l1 || l2 || l3;

  // 탭별 필터 + 전체일 때 날짜 혼합 정렬
  const items: AnyReport[] = tab === "all"
    ? [...posts, ...ibric, ...industryTyped].sort((a, b) => b.date.localeCompare(a.date))
    : tab === "bioweekly" ? posts
    : tab === "ibric"     ? ibric
    : industryTyped;

  // 바이오위클리 서브탭 (탭이 bioweekly일 때만)
  const [sourceFilter, setSourceFilter] = useState("all");
  const SOURCE_TABS = [
    { key: "all", label: "전체" },
    { key: "kiinbio", label: "Kiinbio" },
    { key: "decodingbio", label: "Decoding Bio" },
    { key: "techlifesci", label: "Bio Tech" },
    { key: "thebiobrief", label: "Bio Brief" },
  ];
  const filteredItems = (tab === "bioweekly" && sourceFilter !== "all")
    ? items.filter((i) => i._type === "bioweekly" && (i as SubstackPost).source === sourceFilter)
    : items;

  if (isLoading) return <PillLoader text="리포트 불러오는 중..." />;

  return (
    <div className="space-y-3">
      {/* 메인 탭 */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setSourceFilter("all"); setExpandedId(null); }}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              tab === t.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 바이오위클리 서브탭 */}
      {tab === "bioweekly" && (
        <div className="flex gap-1.5 flex-wrap">
          {SOURCE_TABS.map((t) => (
            <button key={t.key} onClick={() => setSourceFilter(t.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                sourceFilter === t.key ? "bg-muted text-foreground font-semibold" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {filteredItems.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">수집된 리포트가 없습니다.</p>
      )}

      {filteredItems.map((item) => {
        const isOpen = expandedId === item.id;
        const type = item._type;

        const title = item.title;
        const date = item.date;
        const badgeCls = BADGE[type];
        const linkCls = LINK_COLOR[type];

        const badgeLabel =
          type === "bioweekly" ? "바이오위클리" :
          type === "ibric"     ? "동향리포트" :
          (item as IndustryReport).broker;

        const sub =
          type === "bioweekly" ? null :
          type === "ibric" && (item as IbricReport).author
            ? `${(item as IbricReport).author}${(item as IbricReport).affiliation ? `(${(item as IbricReport).affiliation})` : ""}`
            : null;

        const url =
          type === "industry" ? null : (item as SubstackPost | IbricReport).url;
        const pdfUrl =
          type === "industry" ? (item as IndustryReport).pdf_url : null;

        return (
          <div key={`${type}-${item.id}`} className="bg-card border border-border rounded-lg overflow-hidden">
            <button onClick={() => setExpandedId(isOpen ? null : item.id)}
              className="w-full text-left p-4 hover:bg-muted/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground leading-snug">{title}</h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${badgeCls}`}>{badgeLabel}</span>
                    {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
                    <span className="text-[11px] text-muted-foreground">{date}</span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform mt-0.5 ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                {item.summary
                  ? <SummaryText text={item.summary} />
                  : <p className="text-sm text-muted-foreground italic">요약 정보가 없습니다.</p>}
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background border border-border hover:bg-muted transition-colors ${linkCls}`}>
                    <ExternalLink className="w-3.5 h-3.5" />원문 보기
                  </a>
                )}
                {pdfUrl && (
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background border border-border hover:bg-muted transition-colors ${linkCls}`}>
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
