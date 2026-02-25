import { useState } from "react";
import { Beaker, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const isNew = (approvalDate: string) => {
  const now = new Date();
  const approval = new Date(approvalDate);
  const diffMs = now.getTime() - approval.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 3;
};

type Props = {
  onKeywordClick: (kw: string) => void;
};

export const IndApprovalSection = ({ onKeywordClick }: Props) => {
  const [open, setOpen] = useState(false);

  const { data: trials = [], isLoading } = useQuery({
    queryKey: ["ind-approvals-sidebar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinical_trial_approvals")
        .select("id, sponsor, product_name, trial_title, phase, approval_date, summary")
        .order("approval_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <Beaker className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">국내 IND 승인</h2>
        <span className="text-[10px] text-muted-foreground ml-auto mr-2">{trials.length}건</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isLoading ? (
          <div className="px-5 py-6 text-center text-xs text-muted-foreground">검색중...</div>
        ) : trials.length === 0 ? (
          <div className="px-5 py-6 text-center text-xs text-muted-foreground">
            데이터가 없습니다
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[350px] overflow-y-auto">
            {trials.map((item) => (
              <div
                key={item.id}
                className="px-5 py-2 hover:bg-muted/50 transition-colors group cursor-pointer"
                onClick={() => onKeywordClick(item.product_name)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {item.product_name}
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 h-4">
                      {item.phase}
                    </Badge>
                    {isNew(item.approval_date) && (
                      <Badge className="text-[9px] px-1 py-0 shrink-0 h-4 bg-red-500 text-white border-0">
                        신규
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                    {item.approval_date.slice(5)}
                  </span>
                </div>
                <p className="text-[9px] text-muted-foreground truncate -mt-0.5">{item.sponsor}</p>
                {(item as any).summary ? (
                  <p className="text-[10px] text-foreground/80 mt-0.5 line-clamp-1">{(item as any).summary}</p>
                ) : item.trial_title ? (
                  <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">{item.trial_title}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
