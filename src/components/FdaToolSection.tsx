import { useState, useMemo } from "react";
import { ExternalLink, Search } from "lucide-react";
import { PillLoader } from "@/components/PillLoader";
import { useRegulatoryNotices } from "@/hooks/useNewsData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── NCE 특허 만료 데이터 ──
const isNew = (d: string) => (new Date().getTime() - new Date(d).getTime()) / 86400000 <= 3;

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


type FdaTab = "all" | "fda" | "nce";
const TABS: { key: FdaTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "fda", label: "미국 FDA 주요사항" },
  { key: "nce", label: "NCE 미국특허" },
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
