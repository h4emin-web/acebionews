import { MemoSection } from "@/components/MemoSection";
import type { User } from "@supabase/supabase-js";
import { X } from "lucide-react";

type Props = {
  user: User;
  bookmarkedArticles: any[];
  memoMap: Record<string, string>;
  onClose: () => void;
  onNewsClick: (articleId: string) => void;
};

export const MemoPanel = ({ user, bookmarkedArticles, memoMap, onClose, onNewsClick }: Props) => {
  return (
    <div className="card-elevated rounded-lg overflow-hidden flex flex-col" style={{ height: "calc(100vh - 180px)", position: "sticky", top: "100px" }}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-foreground">메모</h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <MemoSection
          user={user}
          bookmarkedArticles={bookmarkedArticles}
          memoMap={memoMap}
          onNewsClick={onNewsClick}
          expanded={false}
          onExpand={() => {}}
        />
      </div>
    </div>
  );
};
