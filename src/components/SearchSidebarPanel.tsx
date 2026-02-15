import { Loader2, Pill, Building2, Flag, FlaskConical, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Props = {
  keyword: string;
  products: any[];
  productsLoading: boolean;
  dmfRecords: any[];
  dmfLoading: boolean;
};

export const SearchSidebarPanel = ({ keyword, products, productsLoading, dmfRecords, dmfLoading }: Props) => {
  return (
    <div className="space-y-4">
      {/* 국내 등록 제품 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-primary/5">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-foreground">국내 등록 제품 (MFDS)</h3>
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {productsLoading ? (
            <div className="px-4 py-6 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <p className="text-[11px] text-muted-foreground">의약품안전나라 조회중...</p>
            </div>
          ) : products.length > 0 ? (
            <div className="divide-y divide-border">
              {products.map((p: any, i: number) => (
                <div key={i} className="px-4 py-2.5">
                  <p className="text-[12px] font-medium text-foreground">{p.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {p.company}
                    </span>
                    {p.nameEn && (
                      <Badge variant="outline" className="text-[9px] font-normal">{p.nameEn}</Badge>
                    )}
                    {p.permitDate && (
                      <span className="text-[10px] text-muted-foreground">허가: {p.permitDate}</span>
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

      {/* 국내 DMF 등록 현황 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-primary/5">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-foreground">원료의약품등록(DMF) 공고</h3>
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {dmfLoading ? (
            <div className="px-4 py-6 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <p className="text-[11px] text-muted-foreground">의약품안전나라 조회중...</p>
            </div>
          ) : dmfRecords.length > 0 ? (
            <div className="divide-y divide-border">
              {dmfRecords.map((d: any, i: number) => (
                <div key={i} className="px-4 py-2.5">
                  <p className="text-[12px] font-medium text-foreground">{d.ingredientName}</p>
                  <div className="flex flex-col gap-0.5 mt-1">
                    {d.applicant && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        신청인: {d.applicant}
                      </span>
                    )}
                    {d.manufacturer && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <FlaskConical className="w-3 h-3" />
                        제조소: {d.manufacturer}
                      </span>
                    )}
                    {d.registrationDate && (
                      <span className="text-[10px] text-muted-foreground">
                        허가일자: {d.registrationDate}
                      </span>
                    )}
                    {d.status && d.status !== "정상" && (
                      <Badge variant="destructive" className="text-[9px] w-fit">{d.status}</Badge>
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
