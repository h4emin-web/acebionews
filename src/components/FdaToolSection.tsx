import { useState, useMemo } from "react";
import { ExternalLink, Search } from "lucide-react";
import { PillLoader } from "@/components/PillLoader";
import { useRegulatoryNotices } from "@/hooks/useNewsData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── NCE 특허 만료 데이터 ──
const getTimeRemaining = (expiryDate: string) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return "만료됨";
  const totalMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return years > 0 ? `${years}년 ${months}개월` : `${months}개월`;
};

// ── DMF 데이터 ──
type DmfEntry = { rank: number; name: string; nameKo: string; count: number; indication: string };
const dmfData: DmfEntry[] = [
  { rank: 1, name: "FINERENONE", nameKo: "피네레논", count: 11, indication: "비스테로이드성 미네랄코르티코이드 수용체 길항제" },
  { rank: 2, name: "TIRZEPATIDE", nameKo: "티르제파타이드", count: 10, indication: "GIP/GLP-1 이중 수용체 작용제" },
  { rank: 3, name: "SEMAGLUTIDE", nameKo: "세마글루타이드", count: 9, indication: "GLP-1 수용체 작용제" },
  { rank: 4, name: "HUMAN UMBILICAL CORD MESENCHYM.", nameKo: "인간 제대혈 중간엽 줄기세포", count: 8, indication: "재생의학, 이식편대숙주병(GvHD)" },
  { rank: 5, name: "DEUCRAVACITINIB", nameKo: "듀크라바시티닙", count: 6, indication: "TYK2 억제제" },
  { rank: 6, name: "ABEMACICLIB", nameKo: "아베마시클립", count: 6, indication: "CDK4/6 억제제" },
  { rank: 7, name: "APIXABAN", nameKo: "아픽사반", count: 5, indication: "Factor Xa 억제제" },
  { rank: 8, name: "MAVACAMTEN", nameKo: "마바캄텐", count: 5, indication: "심장 미오신 억제제" },
  { rank: 9, name: "RESMETIROM", nameKo: "레스메티롬", count: 5, indication: "THR-β 작용제" },
  { rank: 10, name: "MARALIXIBAT CHLORIDE", nameKo: "마랄릭시바트 염화물", count: 4, indication: "IBAT 억제제" },
  { rank: 11, name: "VONOPRAZAN FUMARATE", nameKo: "보노프라잔 푸마르산염", count: 4, indication: "칼륨 경쟁적 위산분비 억제제(P-CAB)" },
  { rank: 12, name: "OLAPARIB", nameKo: "올라파립", count: 4, indication: "PARP 억제제" },
  { rank: 13, name: "NUSINERSEN SODIUM", nameKo: "누시너센 나트륨", count: 4, indication: "안티센스 올리고뉴클레오타이드" },
  { rank: 14, name: "MARIBAVIR", nameKo: "마리바비르", count: 4, indication: "UL97 키나아제 억제제" },
  { rank: 15, name: "EDOXABAN TOSYLATE MONOHYDRATE", nameKo: "에독사반 토실산염", count: 4, indication: "Factor Xa 억제제" },
  { rank: 16, name: "RUXOLITINIB PHOSPHATE", nameKo: "룩소리티닙 인산염", count: 4, indication: "JAK1/JAK2 억제제" },
  { rank: 17, name: "ORFORGLIPRON", nameKo: "오르포글리프론", count: 3, indication: "경구용 GLP-1 수용체 작용제" },
  { rank: 18, name: "BELZUTIFAN", nameKo: "벨주티판", count: 3, indication: "HIF-2α 억제제" },
  { rank: 19, name: "DAPAGLIFLOZIN", nameKo: "다파글리플로진", count: 3, indication: "SGLT2 억제제" },
  { rank: 20, name: "EMPAGLIFLOZIN", nameKo: "엠파글리플로진", count: 3, indication: "SGLT2 억제제" },
];

type FdaTab = "all" | "fda" | "nce" | "dmf";
const TABS: { key: FdaTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "fda", label: "미국 FDA 주요사항" },
  { key: "nce", label: "NCE 미국특허" },
  { key: "dmf", label: "DMF 2025" },
];

// ── FDA 공지 패널 ──
const FdaPanel = ({ large = false }: { large?: boolean }) => {
  const { data: notices = [], isLoading } = useRegulatoryNotices("FDA");
  const typeLabels: Record<string, string> = {
    "Safety Alert": "Alert", "Statement": "Statement",
    "Drug Recall": "Recall", "Warning": "Warning",
    "NDA Approval": "Approval", "Guidance": "Guidance", "Approval": "Approval",
  };
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-4 py-3 border-b border-border bg-muted/20 shrink-0">
        <h3 className="text-sm font-semibold text-foreground">공지</h3>
      </div>
      <div className="overflow-y-auto scrollbar-hide divide-y divide-border flex-1" style={{ maxHeight: "60vh" }}>
        {isLoading ? <div className="py-8"><PillLoader text="로딩 중..." /></div>
          : notices.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">없음</p>
          : notices.map((n) => (
            <div key={n.id} className="px-4 py-3 hover:bg-muted/40 transition-colors group">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className={`text-[10px] font-medium text-foreground`}>
                  {typeLabels[n.type] || n.type}
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
              <p className={`text-foreground leading-snug ${large ? "text-sm" : "text-[12px]"}`}>{n.title}</p>
            </div>
          ))}
      </div>
    </div>
  );
};

// ── NCE 특허 패널 ──
const NcePanel = ({ large = false }: { large?: boolean }) => {
  const [search, setSearch] = useState("");
  const { data: patents = [], isLoading } = useQuery({
    queryKey: ["nce-patent-sidebar"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("nce_patent_expiry")
        .select("id, product_name, api_name, api_name_ko, expiry_date, indication")
        .gte("expiry_date", today)
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!search) return patents;
    const q = search.toLowerCase();
    return patents.filter(d =>
      d.product_name.toLowerCase().includes(q) ||
      d.api_name.toLowerCase().includes(q) ||
      (d.api_name_ko && d.api_name_ko.toLowerCase().includes(q))
    );
  }, [patents, search]);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-4 py-3 border-b border-border bg-muted/20 shrink-0">
        <h3 className="text-sm font-semibold text-foreground">NCE 미국특허</h3>
      </div>
      {large && (
        <div className="px-3 py-2 border-b border-border shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="품명, 원료명 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-md bg-muted/50 border border-border outline-none focus:ring-1 focus:ring-primary/20 transition-all" />
          </div>
        </div>
      )}
      <div className="overflow-y-auto scrollbar-hide divide-y divide-border flex-1" style={{ maxHeight: "60vh" }}>
        {isLoading ? <div className="py-8"><PillLoader text="로딩 중..." /></div>
          : filtered.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">없음</p>
          : filtered.map((item) => (
            <div key={item.id} className="px-4 py-2.5 hover:bg-muted/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-foreground truncate ${large ? "text-sm" : "text-[11px]"}`}>{item.product_name}</p>
                  <p className={`text-muted-foreground truncate ${large ? "text-xs" : "text-[10px]"}`}>{item.api_name}</p>
                  {item.indication && (
                    <p className={`text-muted-foreground line-clamp-1 ${large ? "text-xs" : "text-[10px]"}`}>{item.indication}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                  {item.expiry_date?.slice(0, 7)}
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

// ── DMF 패널 ──
const DmfPanel = ({ large = false }: { large?: boolean }) => (
  <div className="flex flex-col min-h-0 flex-1">
    <div className="px-4 py-3 border-b border-border bg-muted/20 shrink-0">
      <h3 className="text-sm font-semibold text-foreground">DMF 2025</h3>
    </div>
    <div className="overflow-y-auto scrollbar-hide flex-1" style={{ maxHeight: "60vh" }}>
      <table className="w-full">
        {large && (
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">순위</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">품명</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase">승인횟수</th>
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-border">
          {dmfData.map((d) => (
            <tr key={d.rank} className="hover:bg-muted/40 transition-colors">
              <td className={`px-3 text-muted-foreground font-mono ${large ? "py-2.5 text-sm" : "py-1.5 text-[11px]"}`}>{d.rank}</td>
              <td className={`px-3 ${large ? "py-2.5" : "py-1.5"}`}>
                <p className={`font-medium text-foreground truncate ${large ? "text-sm" : "text-[11px]"}`}>{d.nameKo}</p>
                {large && <p className="text-muted-foreground text-xs">{d.name}</p>}
              </td>
              <td className={`px-3 text-right font-semibold text-foreground ${large ? "py-2.5 text-sm" : "py-1.5 text-[11px]"}`}>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ── 메인 ──
export const FdaToolSection = () => {
  const [tab, setTab] = useState<FdaTab>("all");

  return (
    <>
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

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {tab === "all" && (
          <div className="grid grid-cols-[2fr_1.5fr_1fr] divide-x divide-border">
            <FdaPanel />
            <NcePanel />
            <DmfPanel />
          </div>
        )}
        {tab === "fda"  && <FdaPanel large />}
        {tab === "nce"  && <NcePanel large />}
        {tab === "dmf"  && <DmfPanel large />}
      </div>
    </>
  );
};
