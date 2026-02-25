import { useState } from "react";
import { ArrowRight, Handshake, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Deal = {
  id: string;
  date: string;
  payer: string;
  payer_country: string;
  payee: string;
  payee_country: string;
  total_m: number;
  deal_type: string;
  technology: string;
  indication: string;
};

function formatKrw(millionUsd: number): string {
  const billionKrw = millionUsd * 14.6;
  if (billionKrw >= 10000) {
    const jo = billionKrw / 10000;
    return jo % 1 === 0 ? `${jo.toFixed(0)}조` : `${jo.toFixed(1)}조`;
  }
  return `${Math.round(billionKrw).toLocaleString()}억`;
}

function FlagImg({ code, className = "" }: { code: string; className?: string }) {
  return (
    <img
      src={`https://flagcdn.com/16x12/${code}.png`}
      srcSet={`https://flagcdn.com/32x24/${code}.png 2x`}
      width="16"
      height="12"
      alt={code}
      className={`inline-block ${className}`}
      loading="lazy"
    />
  );
}

function formatDate(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,"0")}.${String(dt.getDate()).padStart(2,"0")}`;
}

export const BigDealsSection = () => {
  const [open, setOpen] = useState(false);

  const { data: deals = [] } = useQuery({
    queryKey: ["biotech-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biotech_deals")
        .select("*")
        .order("total_m", { ascending: false });
      if (error) throw error;
      return (data || []) as Deal[];
    },
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="card-elevated rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-3 border-b border-border flex items-center gap-2 hover:bg-muted/30 transition-colors">
            <Handshake className="w-4 h-4 text-pharma-amber" />
            <h3 className="font-bold text-sm text-foreground">Big Deals Tracker</h3>
            <span className="text-[10px] text-muted-foreground">2026</span>
            <span className="text-[10px] text-muted-foreground ml-auto mr-1">{deals.length}건</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="divide-y divide-border">
            {deals.map((deal) => (
              <div key={deal.id} className="px-3 py-2.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-foreground truncate">{deal.payer}</span>
                  <FlagImg code={deal.payer_country} className="shrink-0" />
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-foreground truncate">{deal.payee}</span>
                  <FlagImg code={deal.payee_country} className="shrink-0" />
                  <span className="ml-auto font-bold text-primary whitespace-nowrap text-xs">
                    {formatKrw(deal.total_m)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded font-semibold ${
                    deal.deal_type === "M&A"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  }`}>{deal.deal_type}</span>
                  {deal.technology && <span className="text-muted-foreground">{deal.technology}</span>}
                  {deal.indication && <span className="text-muted-foreground">· {deal.indication}</span>}
                  <span className="ml-auto text-muted-foreground/60 whitespace-nowrap">{formatDate(deal.date)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-border">
            <a href="https://www.labiotech.eu/biotech-deals-2026/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
              Source: Labiotech.eu Deals Tracker 2026 →
            </a>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
