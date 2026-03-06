import { useState } from "react";
import { Brain, ChevronDown, TrendingUp, Calendar, Beaker } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

type Summary = {
  id: string;
  summary_date: string;
  section: string;
  content: string;
};

export const IntelligenceSummarySection = () => {
  const [open, setOpen] = useState(false);

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ["intelligence-summaries"],
    queryFn: async () => {
      // Get the most recent summaries (today or latest available)
      const { data, error } = await supabase
        .from("intelligence_summaries")
        .select("*")
        .order("summary_date", { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data || []) as Summary[];
    },
  });

  const weekly = summaries.find((s) => s.section === "weekly_issues");
  const monthly = summaries.find((s) => s.section === "monthly_issues");
  const apiMarket = summaries.find((s) => s.section === "api_market");
  const latestDate = summaries[0]?.summary_date;

  const sections = [
    { key: "weekly", icon: TrendingUp, title: "이번주 주요 이슈", data: weekly, color: "text-emerald-500" },
    { key: "monthly", icon: Calendar, title: "이번달 주요 이슈", data: monthly, color: "text-blue-500" },
    { key: "api_market", icon: Beaker, title: "원료의약품 시장", data: apiMarket, color: "text-amber-500" },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <Brain className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">정보 요약</h2>
        {latestDate && (
          <span className="text-[10px] text-muted-foreground ml-auto mr-2">
            {latestDate.slice(5)} 기준
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isLoading ? (
          <div className="px-5 py-6 text-center text-xs text-muted-foreground">분석중...</div>
        ) : summaries.length === 0 ? (
          <div className="px-5 py-6 text-center text-xs text-muted-foreground">
            데이터가 없습니다
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {sections.map(({ key, icon: Icon, title, data, color }) => (
              data && (
                <div key={key} className="px-5 py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider">{title}</h3>
                  </div>
                  <div className="text-[11px] text-foreground/85 leading-relaxed space-y-1 prose-intelligence">
                    <ReactMarkdown
                      components={{
                        ul: ({ children }) => <ul className="space-y-1 list-none pl-0">{children}</ul>,
                        li: ({ children }) => (
                          <li className="flex gap-1.5 items-start">
                            <span className="text-primary mt-0.5 shrink-0">•</span>
                            <span>{children}</span>
                          </li>
                        ),
                        p: ({ children }) => <p className="mb-1">{children}</p>,
                        strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                      }}
                    >
                      {data.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
