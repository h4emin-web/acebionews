import { useState, useEffect, useMemo } from "react";
import { X, Search, Beaker } from "lucide-react";
import { PillLoader } from "@/components/PillLoader";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type Trial = {
  id: string;
  seq_number: number;
  sponsor: string;
  product_name: string;
  trial_title: string;
  phase: string;
  approval_date: string;
  dev_region: string | null;
  summary: string | null;
};

const isNew = (approvalDate: string) => {
  const now = new Date();
  const approval = new Date(approvalDate);
  const diffMs = now.getTime() - approval.getTime();
  return diffMs / (1000 * 60 * 60 * 24) <= 3;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onKeywordClick?: (kw: string) => void;
};

export const IndApprovalModal = ({ open, onClose, onKeywordClick }: Props) => {
  const [data, setData] = useState<Trial[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data: trials, error } = await supabase
      .from("clinical_trial_approvals")
      .select("*")
      .order("approval_date", { ascending: false })
      .limit(500);
    if (error) console.error("Fetch error:", error);
    else setData(trials || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchData();
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (d) =>
        d.product_name.toLowerCase().includes(q) ||
        d.sponsor.toLowerCase().includes(q) ||
        d.trial_title.toLowerCase().includes(q) ||
        d.phase.toLowerCase().includes(q)
    );
  }, [data, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto">
      <div className="w-full max-w-6xl mx-4 my-8 bg-card border border-border rounded-xl shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border rounded-t-xl px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Beaker className="w-5 h-5 text-primary" />
                국내 IND 승인
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                식약처 임상시험 승인 현황 · {filtered.length}건
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="의뢰자, 제품명, 임상시험 검색..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <PillLoader text="데이터 로딩 중..." />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-3 text-left w-8">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">#</span>
                  </th>
                  <th className="px-3 py-3 text-left">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">의뢰자</span>
                  </th>
                  <th className="px-3 py-3 text-left">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">제품명</span>
                  </th>
                  <th className="px-3 py-3 text-left">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">임상시험</span>
                  </th>
                  <th className="px-3 py-3 text-left">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">단계</span>
                  </th>
                  <th className="px-3 py-3 text-left">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">승인일</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item, i) => (
                  <tr
                    key={item.id}
                    className="hover:bg-muted/40 transition-colors"
                  >
                    <td className="px-3 py-2.5 text-[11px] text-muted-foreground font-mono">{i + 1}</td>
                    <td className="px-3 py-2.5 text-xs text-foreground whitespace-nowrap">{item.sponsor}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">{item.product_name}</span>
                        {isNew(item.approval_date) && (
                          <Badge className="text-[9px] px-1 py-0 h-4 bg-red-500 text-white border-0">신규</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 max-w-[400px]">
                      <span className="text-[11px] text-foreground font-medium">{item.summary || ""}</span>
                      {item.trial_title && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{item.trial_title}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 whitespace-nowrap">{item.phase}</Badge>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-foreground">{item.approval_date}</span>
                        {isNew(item.approval_date) && (
                          <span className="text-[9px] text-red-500 font-medium">NEW</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
