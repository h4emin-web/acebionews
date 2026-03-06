import { useState, useEffect, useMemo } from "react";
import { Search, ExternalLink, AlertCircle, FileText, RefreshCw, Maximize2, X } from "lucide-react";
import { PillLoader } from "@/components/PillLoader";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useRegulatoryNotices } from "@/hooks/useNewsData";
import { useQuery } from "@tanstack/react-query";

type Trial = {
  id: string; seq_number: number; sponsor: string; product_name: string;
  trial_title: string; phase: string; approval_date: string;
  dev_region: string | null; summary: string | null;
};
type MfdsRecall = {
  id: string; product_name: string; company: string;
  recall_reason: string; order_date: string; url: string;
};

const isNew = (d: string) => (new Date().getTime() - new Date(d).getTime()) / 86400000 <= 3;

const typeIcons: Record<string, React.ElementType> = {
  "안전성 서한": AlertCircle, "공문": FileText, "안전성정보": AlertCircle,
  "허가변경": RefreshCw, "회수·판매중지": AlertCircle, "부작용": AlertCircle,
};

type NedrugTab = "all" | "ind" | "safety";

const TABS: { key: NedrugTab; label: string }[] = [
  { key: "all",    label: "전체" },
  { key: "ind",    label: "국내 IND 승인" },
  { key: "safety", label: "안전성 및 회수·폐기" },
];

// ── IND 확대 모달 ──
const IndModal = ({ data, loading, onClose }: { data: Trial[]; loading: boolean; onClose: () => void }) => {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(d =>
      d.product_name.toLowerCase().includes(q) ||
      d.sponsor.toLowerCase().includes(q) ||
      d.trial_title.toLowerCase().includes(q) ||
      d.phase.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto">
      <div className="w-full max-w-6xl mx-4 my-8 bg-card border border-border rounded-xl shadow-2xl">
        <div className="sticky top-0 bg-card border-b border-border rounded-t-xl px-6 py-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-bold text-foreground">국내 IND 승인 전체</h2>
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="의뢰자, 제품명, 임상시험 검색..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-muted/50 border border-border outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
        {loading ? <div className="py-12"><PillLoader text="로딩 중..." /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["#","의뢰자","제품명","실험 내용","단계","승인일"].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item, i) => (
                  <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2.5 text-[11px] text-muted-foreground font-mono">{i + 1}</td>
                    <td className="px-3 py-2.5 text-xs text-foreground whitespace-nowrap">{item.sponsor}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">{item.product_name}</span>
                        {isNew(item.approval_date) && <Badge className="text-[9px] px-1 py-0 h-4 bg-red-500 text-white border-0">NEW</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 max-w-[420px]">
                      {item.summary && <p className="text-[11px] text-foreground">{item.summary}</p>}
                      {item.trial_title && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{item.trial_title}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 whitespace-nowrap">{item.phase}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-foreground whitespace-nowrap">{item.approval_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── IND 테이블 ──
const IndTable = ({ data, loading, search, onSearchChange, onExpand }: {
  data: Trial[]; loading: boolean; search: string;
  onSearchChange: (v: string) => void; onExpand: () => void;
}) => {
  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(d =>
      d.product_name.toLowerCase().includes(q) ||
      d.sponsor.toLowerCase().includes(q) ||
      d.trial_title.toLowerCase().includes(q) ||
      d.phase.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20 shrink-0">
        <h3 className="text-sm font-semibold text-foreground">국내 IND 승인</h3>
        <button onClick={onExpand} className="p-1 rounded hover:bg-muted transition-colors" title="전체 보기">
          <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => onSearchChange(e.target.value)}
            placeholder="검색..."
            className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-md bg-muted/50 border border-border outline-none focus:ring-1 focus:ring-primary/20 transition-all" />
        </div>
      </div>
      <div className="overflow-y-auto scrollbar-hide flex-1" style={{ maxHeight: "60vh" }}>
        {loading ? <div className="py-8"><PillLoader text="로딩 중..." /></div> : (
          <table className="w-full">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">의뢰자</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">제품명 / 실험 내용</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">단계</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">승인일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-2.5 text-[11px] text-foreground whitespace-nowrap">{item.sponsor}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-medium text-foreground">{item.product_name}</span>
                      {isNew(item.approval_date) && <Badge className="text-[8px] px-1 py-0 h-3.5 bg-red-500 text-white border-0">NEW</Badge>}
                    </div>
                    {(item.summary || item.trial_title) && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                        {item.summary || item.trial_title}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-[9px] px-1 py-0 whitespace-nowrap">{item.phase}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">{item.approval_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ── 안전성서한 목록 ──
const SafetyList = ({ notices, loading }: { notices: any[]; loading: boolean }) => (
  <div className="flex flex-col min-h-0 flex-1">
    <div className="px-4 py-3 border-b border-border bg-muted/20 shrink-0">
      <h3 className="text-sm font-semibold text-foreground">안전성서한</h3>
    </div>
    <div className="overflow-y-auto scrollbar-hide divide-y divide-border flex-1" style={{ maxHeight: "60vh" }}>
      {loading ? <div className="py-8"><PillLoader text="로딩 중..." /></div>
        : notices.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">없음</p>
        : notices.map((n) => {
            const Icon = typeIcons[n.type] || FileText;
            return (
              <div key={n.id} className="px-4 py-3 hover:bg-muted/40 transition-colors group">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Icon className="w-3 h-3 shrink-0" />{n.type}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{n.date}</span>
                    {n.url && (
                      <a href={n.url} target="_blank" rel="noreferrer"
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                <p className="text-[12px] text-foreground leading-snug">{n.title}</p>
              </div>
            );
          })}
    </div>
  </div>
);

// ── 회수폐기 목록 ──
const RecallList = ({ recalls, loading }: { recalls: MfdsRecall[]; loading: boolean }) => (
  <div className="flex flex-col min-h-0 flex-1">
    <div className="px-4 py-3 border-b border-border bg-muted/20 shrink-0">
      <h3 className="text-sm font-semibold text-foreground">회수·폐기</h3>
    </div>
    <div className="overflow-y-auto scrollbar-hide divide-y divide-border flex-1" style={{ maxHeight: "60vh" }}>
      {loading ? <div className="py-8"><PillLoader text="로딩 중..." /></div>
        : recalls.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">없음</p>
        : recalls.map((r) => (
          <div key={r.id} className="px-4 py-3 hover:bg-muted/40 transition-colors group">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-[10px] text-muted-foreground">{r.order_date}</span>
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer"
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all shrink-0">
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <p className="text-[12px] font-medium text-foreground leading-snug">{r.product_name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{r.company}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{r.recall_reason}</p>
          </div>
        ))}
    </div>
  </div>
);

// ── 메인 ──
export const NedrugSection = () => {
  const [tab, setTab] = useState<NedrugTab>("all");
  const [indData, setIndData] = useState<Trial[]>([]);
  const [indLoading, setIndLoading] = useState(false);
  const [indSearch, setIndSearch] = useState("");
  const [indModalOpen, setIndModalOpen] = useState(false);

  useEffect(() => {
    setIndLoading(true);
    supabase.from("clinical_trial_approvals").select("*")
      .order("approval_date", { ascending: false }).limit(500)
      .then(({ data, error }) => {
        if (!error) setIndData(data || []);
        setIndLoading(false);
      });
  }, []);

  const { data: notices = [], isLoading: noticesLoading } = useRegulatoryNotices("의약품안전나라");

  const { data: recalls = [], isLoading: recallsLoading } = useQuery({
    queryKey: ["mfds-recalls"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mfds_recalls").select("*")
        .order("order_date", { ascending: false }).limit(30);
      if (error) throw error;
      return (data || []) as MfdsRecall[];
    },
  });

  return (
    <>
      {indModalOpen && <IndModal data={indData} loading={indLoading} onClose={() => setIndModalOpen(false)} />}

      {/* 서브탭 */}
      <div className="flex gap-1.5 mb-3">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              tab === t.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {tab === "all" && (
          <div className="grid grid-cols-[2fr_1fr_1fr] divide-x divide-border">
            <IndTable data={indData} loading={indLoading} search={indSearch}
              onSearchChange={setIndSearch} onExpand={() => setIndModalOpen(true)} />
            <SafetyList notices={notices} loading={noticesLoading} />
            <RecallList recalls={recalls} loading={recallsLoading} />
          </div>
        )}
        {tab === "ind" && (
          <IndTable data={indData} loading={indLoading} search={indSearch}
            onSearchChange={setIndSearch} onExpand={() => setIndModalOpen(true)} />
        )}
        {tab === "safety" && (
          <div className="grid grid-cols-2 divide-x divide-border">
            <SafetyList notices={notices} loading={noticesLoading} />
            <RecallList recalls={recalls} loading={recallsLoading} />
          </div>
        )}
      </div>
    </>
  );
};
