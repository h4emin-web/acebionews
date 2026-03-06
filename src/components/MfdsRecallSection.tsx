import { AlertCircle, ExternalLink, ChevronDown, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type MfdsRecall = {
  id: string;
  product_name: string;
  company: string;
  recall_reason: string;
  order_date: string;
  url: string;
};

export const MfdsRecallSection = () => {
  const [open, setOpen] = useState(false);

  const { data: recalls = [], isLoading } = useQuery({
    queryKey: ["mfds-recalls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mfds_recalls")
        .select("*")
        .order("order_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as MfdsRecall[];
    },
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <Trash2 className="w-4 h-4 text-red-500" />
        <h2 className="text-sm font-semibold text-foreground">의약품안전나라 회수·폐기</h2>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono mr-2">nedrug</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isLoading ? (
          <div className="px-5 py-6 text-center text-xs text-muted-foreground">검색중...</div>
        ) : recalls.length === 0 ? (
          <div className="px-5 py-6 text-center text-xs text-muted-foreground">
            등록된 회수·폐기 정보가 없습니다
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recalls.map((r) => (
              <div key={r.id} className="px-5 py-3 hover:bg-muted/50 transition-colors group">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600">
                    <AlertCircle className="w-3 h-3" />
                    회수·폐기
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-muted-foreground font-mono">{r.order_date}</span>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                <p className="text-xs font-medium text-foreground leading-snug mb-0.5">
                  {r.product_name}
                </p>
                <p className="text-[11px] text-muted-foreground mb-1">
                  {r.company}
                </p>
                <p className="text-[11px] text-muted-foreground/80 leading-snug">
                  {r.recall_reason}
                </p>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
