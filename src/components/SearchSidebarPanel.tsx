import { Loader2, Pill, Building2, Flag, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { IngredientProfile } from "@/components/SearchResultsPanel";

type Props = {
  keyword: string;
  profile: IngredientProfile | null;
  loading: boolean;
};

export const SearchSidebarPanel = ({ keyword, profile, loading }: Props) => {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">등록 현황 조회중...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <FlaskConical className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
        <p className="text-sm text-muted-foreground">등록 현황을 불러올 수 없습니다</p>
      </div>
    );
  }

  const domesticProducts = (profile as any).domesticProducts || [];
  const dmfRecords = (profile as any).dmfRecords || [];

  return (
    <div className="space-y-4">
      {/* 국내 등록 제품 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-primary/5">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-foreground">국내 등록 제품</h3>
            <Badge variant="secondary" className="text-[10px] ml-auto">{domesticProducts.length}건</Badge>
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {domesticProducts.length > 0 ? (
            <div className="divide-y divide-border">
              {domesticProducts.map((p: any, i: number) => (
                <div key={i} className="px-4 py-2.5">
                  <p className="text-[12px] font-medium text-foreground">{p.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {p.company}
                    </span>
                    {p.dosageForm && (
                      <Badge variant="outline" className="text-[9px] font-normal">{p.dosageForm}</Badge>
                    )}
                    {p.strength && (
                      <span className="text-[10px] text-muted-foreground">{p.strength}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-[11px] text-muted-foreground">등록된 제품 정보가 없습니다</p>
            </div>
          )}
        </div>
      </div>

      {/* US DMF 등록 현황 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-primary/5">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-foreground">US DMF 등록 현황</h3>
            <Badge variant="secondary" className="text-[10px] ml-auto">{dmfRecords.length}건</Badge>
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {dmfRecords.length > 0 ? (
            <div className="divide-y divide-border">
              {dmfRecords.map((d: any, i: number) => (
                <div key={i} className="px-4 py-2.5">
                  <p className="text-[12px] font-medium text-foreground">{d.company}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Flag className="w-3 h-3" />
                      {d.country}
                    </span>
                    {d.dmfNumber && (
                      <span className="text-[10px] text-muted-foreground font-mono">{d.dmfNumber}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-[11px] text-muted-foreground">DMF 등록 정보가 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
