import { useState } from "react";
import { FlaskConical, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const getUrgencyColor = (expiryDate: string) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const months = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  if (months <= 0) return "text-red-600 bg-red-50";
  if (months <= 12) return "text-red-500 bg-red-50";
  if (months <= 24) return "text-amber-600 bg-amber-50";
  return "text-emerald-600 bg-emerald-50";
};

const getTimeRemaining = (expiryDate: string) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return { text: "만료됨", urgent: true };
  const totalMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const text = years > 0 ? `${years}년 ${months}개월` : `${months}개월`;
  return { text, urgent: totalMonths <= 12 };
};

type Props = {
  onKeywordClick: (kw: string) => void;
};

export const NcePatentSection = ({ onKeywordClick }: Props) => {
  const [open, setOpen] = useState(false);

  const { data: patents = [], isLoading } = useQuery({
    queryKey: ["nce-patent-sidebar"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("nce_patent_expiry")
        .select("id, product_name, api_name, expiry_date, indication")
        .gte("expiry_date", today)
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <FlaskConical className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">물질 특허 만료 NCE</h2>
        <span className="text-[10px] text-muted-foreground ml-auto mr-2">{patents.length}건</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isLoading ? (
          <div className="px-5 py-6 text-center text-xs text-muted-foreground">검색중...</div>
        ) : patents.length === 0 ? (
          <div className="px-5 py-6 text-center text-xs text-muted-foreground">
            데이터가 없습니다
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[350px] overflow-y-auto">
            {patents.map((item) => {
              const remaining = getTimeRemaining(item.expiry_date);
              return (
                <div
                  key={item.id}
                  className="px-5 py-2 hover:bg-muted/50 transition-colors group cursor-pointer"
                  onClick={() => onKeywordClick(item.api_name.split(';')[0].trim())}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {item.product_name}
                    </span>
                    <div className="flex flex-col items-end shrink-0">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${getUrgencyColor(item.expiry_date)}`}>
                        {item.expiry_date.slice(2)}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {remaining.text}
                      </span>
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground truncate -mt-0.5">{item.api_name}</p>
                  {item.indication && (
                    <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">{item.indication}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
