import { useState } from "react";
import { Pill, Search, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SearchSidebarPanel } from "@/components/SearchSidebarPanel";
import { useDrugInfo, useMfdsIngredientLookup, useMfdsProducts, useMfdsDmf } from "@/hooks/useNewsData";

type Props = {
  onKeywordClick: (kw: string) => void;
};

export const DrugSearchSection = ({ onKeywordClick }: Props) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");

  const { data: drugInfo } = useDrugInfo(search);
  const { data: mfdsIngredient } = useMfdsIngredientLookup(search);

  const isValidIngredient = mfdsIngredient?.nameKo &&
    mfdsIngredient.nameKo.length >= 2 &&
    mfdsIngredient.nameKo !== "원료" &&
    mfdsIngredient.nameKo !== "수출용" &&
    mfdsIngredient.nameKo !== "완제";

  const ingredientKeyword = isValidIngredient
    ? mfdsIngredient.nameEn
      ? `${mfdsIngredient.nameKo} (${mfdsIngredient.nameEn})`
      : mfdsIngredient.nameKo!
    : drugInfo?.nameKo
      ? `${drugInfo.nameKo} (${drugInfo.nameEn})`
      : search;

  const { data: mfdsProductsData, isLoading: mfdsProductsLoading } = useMfdsProducts(ingredientKeyword);
  const { data: mfdsDmfData, isLoading: mfdsDmfLoading } = useMfdsDmf(ingredientKeyword);
  const isProductSearch = drugInfo?.searchedAsProduct === true;

  const mfdsProducts = mfdsProductsData?.products || [];
  const mfdsProductsTotalCount = mfdsProductsData?.totalCount || 0;
  const mfdsDmf = mfdsDmfData?.records || [];
  const mfdsDmfTotalCount = mfdsDmfData?.totalCount || 0;

  const handleSearch = () => {
    if (input.trim()) setSearch(input.trim());
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <Pill className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">국내 제품 및 DMF 현황</h2>
        <ChevronDown className={`w-4 h-4 text-muted-foreground ml-auto transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-3 space-y-3">
          {/* 검색창 */}
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder="성분명 또는 제품명 검색"
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

          {search && (
            <>
              <SearchSidebarPanel
                keyword={search}
                products={mfdsProducts}
                productsLoading={mfdsProductsLoading}
                productsTotalCount={mfdsProductsTotalCount}
                dmfRecords={mfdsDmf}
                dmfLoading={mfdsDmfLoading}
                dmfTotalCount={mfdsDmfTotalCount}
                isProductSearch={isProductSearch}
              />
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
