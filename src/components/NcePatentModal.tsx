import { useState, useEffect, useMemo } from "react";
import { X, Download, Star, Search, Loader2, ArrowUpDown, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type NcePatent = {
  id: string;
  product_name: string;
  api_name: string;
  company: string | null;
  expiry_date: string;
  indication: string | null;
  market_size: string | null;
  recommendation: number | null;
};

type SortKey = "expiry_date" | "recommendation" | "product_name" | "api_name";

const getTimeRemaining = (expiryDate: string) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return { text: "만료됨", urgent: true };
  const totalMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const text = years > 0 ? `${years}년 ${months}개월` : `${months}개월`;
  return { text, urgent: totalMonths <= 12 };
};

const getUrgencyColor = (expiryDate: string) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const months = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  if (months <= 0) return "text-red-600 bg-red-50";
  if (months <= 12) return "text-red-500 bg-red-50";
  if (months <= 24) return "text-amber-600 bg-amber-50";
  return "text-emerald-600 bg-emerald-50";
};

const StarRating = ({ value }: { value: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={`w-3.5 h-3.5 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
      />
    ))}
  </div>
);

type Props = {
  open: boolean;
  onClose: () => void;
  onKeywordClick?: (kw: string) => void;
};

export const NcePatentModal = ({ open, onClose, onKeywordClick }: Props) => {
  const [data, setData] = useState<NcePatent[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("expiry_date");
  const [sortAsc, setSortAsc] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const { data: patents, error } = await supabase
      .from("nce_patent_expiry")
      .select("*")
      .order("expiry_date", { ascending: true });
    if (error) {
      console.error("Fetch NCE error:", error);
    } else {
      setData(patents || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchData();
  }, [open]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("seed-nce-patents");
      if (error) throw error;
      toast({ title: "데이터 생성 완료", description: `${result?.count || 0}건의 NCE 특허 데이터가 생성되었습니다.` });
      await fetchData();
    } catch (e) {
      console.error("Seed error:", e);
      toast({ title: "오류", description: "데이터 생성 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "expiry_date");
    }
  };

  const filtered = useMemo(() => {
    let items = data;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (d) =>
          d.product_name.toLowerCase().includes(q) ||
          d.api_name.toLowerCase().includes(q) ||
          (d.indication && d.indication.toLowerCase().includes(q)) ||
          (d.company && d.company.toLowerCase().includes(q))
      );
    }
    return [...items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "expiry_date") cmp = a.expiry_date.localeCompare(b.expiry_date);
      else if (sortKey === "recommendation") cmp = (a.recommendation || 0) - (b.recommendation || 0);
      else if (sortKey === "product_name") cmp = a.product_name.localeCompare(b.product_name);
      else if (sortKey === "api_name") cmp = a.api_name.localeCompare(b.api_name);
      return sortAsc ? cmp : -cmp;
    });
  }, [data, search, sortKey, sortAsc]);

  if (!open) return null;

  const SortButton = ({ label, sortKeyVal }: { label: string; sortKeyVal: SortKey }) => (
    <button
      onClick={() => handleSort(sortKeyVal)}
      className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider ${
        sortKey === sortKeyVal ? "text-primary" : "text-muted-foreground"
      } hover:text-foreground transition-colors`}
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto">
      <div className="w-full max-w-6xl mx-4 my-8 bg-card border border-border rounded-xl shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border rounded-t-xl px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">물질 특허 만료 NCE</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                New Chemical Entity 특허 만료 예정 목록 · {filtered.length}건
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="품명, 원료명, 적응증 검색..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            {data.length === 0 && !loading && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {seeding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    AI 데이터 생성중...
                  </>
                ) : (
                  "AI로 데이터 생성"
                )}
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">데이터 로딩 중...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertTriangle className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">NCE 특허 데이터가 없습니다.</p>
              <p className="text-xs text-muted-foreground">"AI로 데이터 생성" 버튼을 클릭하여 데이터를 생성하세요.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left w-8">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">#</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortButton label="품명" sortKeyVal="product_name" />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortButton label="원료명" sortKeyVal="api_name" />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">제조사</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortButton label="만료일" sortKeyVal="expiry_date" />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">남은기간</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">적응증</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">시장규모</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortButton label="추천도" sortKeyVal="recommendation" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item, i) => {
                  const remaining = getTimeRemaining(item.expiry_date);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/40 transition-colors group"
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{i + 1}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-foreground">{item.product_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            onKeywordClick?.(item.api_name);
                            onClose();
                          }}
                          className="text-xs font-mono text-primary hover:underline cursor-pointer text-left"
                        >
                          {item.api_name}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-muted-foreground">{item.company || "-"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${getUrgencyColor(item.expiry_date)}`}>
                          {item.expiry_date}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-medium ${remaining.urgent ? "text-red-500" : "text-muted-foreground"}`}>
                          {remaining.text}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-foreground max-w-[200px] truncate block" title={item.indication || ""}>
                          {item.indication || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-medium text-foreground">{item.market_size || "-"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StarRating value={item.recommendation || 0} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
