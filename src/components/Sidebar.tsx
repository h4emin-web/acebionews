import { memo } from "react";
import { KeywordAlertSection } from "@/components/KeywordAlertSection";
import { MemoSection } from "@/components/MemoSection";
import { IntelligenceSummarySection } from "@/components/IntelligenceSummarySection";
import { MfdsSection } from "@/components/MfdsSection";
import { MfdsRecallSection } from "@/components/MfdsRecallSection";
import { BigDealsSection } from "@/components/BigDealsSection";
import { NcePatentSection } from "@/components/NcePatentSection";
import { UsDmfSection } from "@/components/UsDmfSection";
import { FdaSection } from "@/components/FdaSection";
import { DrugSearchSection } from "@/components/DrugSearchSection";
import type { User } from "@supabase/supabase-js";

type Props = {
  user: User | null;
  keywords: string[];
  onAddKeyword: (kw: string) => void;
  onRemoveKeyword: (kw: string) => void;
  bookmarkedArticles: any[];
  memoMap: Record<string, string>;
  memoExpanded: boolean;
  onMemoExpand: (v: boolean) => void;
  onNewsClick: (articleId: string) => void;
  onKeywordClick: (kw: string) => void;
  onAlertKeywordClick: (kw: string) => void;
};

export const Sidebar = memo(({
  user, keywords, onAddKeyword, onRemoveKeyword,
  bookmarkedArticles, memoMap, memoExpanded, onMemoExpand,
  onNewsClick, onKeywordClick, onAlertKeywordClick
}: Props) => {
  return (
    <aside className={`hidden lg:block min-w-0 overflow-hidden transition-all duration-300 ${memoExpanded ? "col-span-full" : "space-y-4"}`}>
      {user && (
        <KeywordAlertSection
          user={user}
          keywords={keywords}
          onAdd={onAddKeyword}
          onRemove={onRemoveKeyword}
          onKeywordClick={onAlertKeywordClick}
        />
      )}
      {user && (
        <MemoSection
          user={user}
          bookmarkedArticles={bookmarkedArticles}
          memoMap={memoMap}
          expanded={memoExpanded}
          onExpand={onMemoExpand}
          onNewsClick={onNewsClick}
        />
      )}
      <IntelligenceSummarySection />
      <MfdsSection onKeywordClick={onKeywordClick} />
      <MfdsRecallSection />
      <DrugSearchSection onKeywordClick={onKeywordClick} />
      <BigDealsSection />
      <NcePatentSection onKeywordClick={onKeywordClick} />
      <UsDmfSection onKeywordClick={onKeywordClick} />
      <FdaSection onKeywordClick={onKeywordClick} />
    </aside>
  );
});
Sidebar.displayName = "Sidebar";
