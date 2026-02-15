import { ExternalLink, Loader2, Globe, FileText, Building2 } from "lucide-react";

export type ExternalNewsResult = {
  title: string;
  description: string;
  url: string;
  source: string;
};

export type DrugProduct = {
  name: string;
  company: string;
  type: string;
  form: string;
};

export type DmfRecord = {
  dmf_no: string;
  company: string;
  country: string;
  status: string;
};

type Props = {
  keyword: string;
  externalNews: ExternalNewsResult[];
  newsLoading: boolean;
  products: DrugProduct[];
  dmfRecords: DmfRecord[];
  drugInfoLoading: boolean;
  productUrl?: string;
  dmfUrl?: string;
};

export const SearchResultsPanel = ({
  keyword,
  externalNews,
  newsLoading,
  products,
  dmfRecords,
  drugInfoLoading,
  productUrl,
  dmfUrl,
}: Props) => {
  return (
    <div className="space-y-4">
      {/* External News */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">관련 뉴스 검색</h3>
          <span className="text-[11px] text-muted-foreground ml-auto">
            {newsLoading ? "검색중..." : `${externalNews.length}건`}
          </span>
        </div>
        <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
          {newsLoading ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">뉴스 검색중...</span>
            </div>
          ) : externalNews.length > 0 ? (
            externalNews.map((news, i) => (
              <a
                key={i}
                href={news.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground line-clamp-2">{news.title}</p>
                    {news.description && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{news.description}</p>
                    )}
                    <span className="text-[10px] text-muted-foreground/70 mt-1 block">{news.source}</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                </div>
              </a>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">검색 결과가 없습니다</p>
          )}
        </div>
      </div>

      {/* Drug Products */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">국내 등록 제품</h3>
          {productUrl && (
            <a href={productUrl} target="_blank" rel="noopener noreferrer" className="ml-auto">
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
            </a>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto">
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
          {dmfUrl && (
            <a href={dmfUrl} target="_blank" rel="noopener noreferrer" className="ml-auto">
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
            </a>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {drugInfoLoading ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">조회중...</span>
            </div>
          ) : dmfRecords.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">DMF No.</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">업체명</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">국가</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dmfRecords.map((d, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 text-[11px] font-mono text-primary">{d.dmf_no}</td>
                    <td className="px-3 py-2 text-[11px] text-foreground">{d.company}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{d.country}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{d.status}</td>
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
