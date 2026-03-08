import { memo } from "react";
import { IntelligenceSummarySection } from "@/components/IntelligenceSummarySection";
import { BigDealsSection } from "@/components/BigDealsSection";
import { DrugSearchSection } from "@/components/DrugSearchSection";

type Props = {
  onKeywordClick: (kw: string) => void;
};

export const Sidebar = memo(({ onKeywordClick }: Props) => {
  return (
    <aside className="hidden lg:block min-w-0 overflow-hidden space-y-4">
      <IntelligenceSummarySection />
      <DrugSearchSection onKeywordClick={onKeywordClick} />
      <BigDealsSection />
    </aside>
  );
});
Sidebar.displayName = "Sidebar";
