import { useState } from "react";
import { Search, ChevronDown, Maximize2, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SearchSidebarPanel } from "@/components/SearchSidebarPanel";
import { useMfdsProducts, useMfdsDmf } from "@/hooks/useNewsData";

type Props = {
  onKeywordClick?: (kw: string) => void;
};

export const DrugSearchSection = ({ onKeywordClick }: Props) => {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");

  const { data: mfdsProductsData, isLoading: mfdsProductsLoading } = useMfdsProducts(search);
  const { data: mfdsDmfData, isLoading: mfdsDmfLoading } = useMfdsDmf(search);

  const mfdsProducts = mfdsProductsData?.products || [];
  const mfdsProductsTotalCount = mfdsProductsData?.totalCount || 0;
  const mfdsDmf = mfdsDmfData?.records || [];
  const mfdsDmfTotalCount = mfdsDmfData?.totalCount || 0;

  const handleSearch = () => {
    if (input.trim()) setSearch(input.trim());
  };

  const searchInput = (
    <div className="flex gap-1.5">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          placeholder="성분명 검색"
          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <button
        onClick={handleSearch}
        disabled={!input.trim()}
        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] disabled:opacity-40 hover:bg-primary/90 transition-colors"
      >
        검색
      </button>
    </div>
  );

  const results = search && (
    <SearchSidebarPanel
      keyword={search}
      products={mfdsProducts}
      productsLoading={mfdsProductsLoading}
      productsTotalCount={mfdsProductsTotalCount}
      dmfRecords={mfdsDmf}
      dmfLoading={mfdsDmfLoading}
      dmfTotalCount={mfdsDmfTotalCount}
      isProductSearch={false}
    />
  );

  // 확대 모달
  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">국내 제품 및 DMF 현황</h2>
            {search && <span className="text-xs text-muted-foreground">— {search}</span>}
          </div>
          <button onClick={() => setExpanded(false)} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {searchInput}
          {results}
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <h2 className="text-sm font-semibold text-foreground">국내 제품 및 DMF 현황</h2>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true); setOpen(true); }}
          className="ml-auto mr-1 p-1 rounded hover:bg-muted transition-colors"
          title="확대 보기"
        >
          <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-3 space-y-3">
          {searchInput}
          {results}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
