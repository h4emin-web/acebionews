import { ExternalLink, Loader2, FileText, Building2 } from "lucide-react";

export type DrugProduct = {
  name: string;
  company: string;
  type: string;
  form: string;
};

export type DmfRecord = {
  company: string;
  manufacturer: string;
  country: string;
};

type Props = {
  keyword: string;
  products: DrugProduct[];
  dmfRecords: DmfRecord[];
  drugInfoLoading: boolean;
  productUrl?: string;
  dmfUrl?: string;
};

export const SearchResultsPanel = ({
  keyword,
  products,
  dmfRecords,
  drugInfoLoading,
  productUrl,
  dmfUrl,
}: Props) => {
  return (
    <div className="space-y-4">
      {/* Drug Products */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">국내 등록 제품</h3>
          <span className="text-[11px] text-muted-foreground ml-auto">
            {drugInfoLoading ? "조회중..." : `${products.length}건`}
          </span>
          {productUrl && (
            <a href={productUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
            </a>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {drugInfoLoading ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">조회중...</span>
            </div>
          ) : products.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">제품명</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">업체명</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">구분</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 text-[11px] text-foreground">{p.name}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{p.company}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{p.type || p.form}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">등록된 제품이 없습니다</p>
          )}
        </div>
      </div>

      {/* DMF Records */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">DMF 등록 현황</h3>
          <span className="text-[11px] text-muted-foreground ml-auto">
            {drugInfoLoading ? "조회중..." : `${dmfRecords.length}건`}
          </span>
          {dmfUrl && (
            <a href={dmfUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
            </a>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {drugInfoLoading ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">조회중...</span>
            </div>
          ) : dmfRecords.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">업체명</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">제조소명</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">국가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dmfRecords.map((d, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 text-[11px] text-foreground">{d.company}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{d.manufacturer || "-"}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{d.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">DMF 등록 정보가 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
};