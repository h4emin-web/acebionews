import { ArrowRight, Handshake } from "lucide-react";

type Deal = {
  date: string;
  payer: string;
  payerCountry: string;
  payee: string;
  payeeCountry: string;
  totalM: number;
  dealType: "M&A" | "Licensing";
  technology: string;
  indication: string;
};

const DEALS: Deal[] = [
  { date: "2026.02.09", payer: "Lilly", payerCountry: "us", payee: "Orna Therapeutics", payeeCountry: "us", totalM: 2400, dealType: "M&A", technology: "CAR-T 세포치료제", indication: "면역·자가면역" },
  { date: "2026.02.09", payer: "Takeda", payerCountry: "jp", payee: "Iambic Therapeutics", payeeCountry: "us", totalM: 1700, dealType: "Licensing", technology: "", indication: "항암·소화기·면역" },
  { date: "2026.02.09", payer: "CSL", payerCountry: "au", payee: "Memo Therapeutics", payeeCountry: "ch", totalM: 328, dealType: "Licensing", technology: "단클론항체", indication: "항암·감염" },
  { date: "2026.02.08", payer: "Lilly", payerCountry: "us", payee: "Innovent Biologics", payeeCountry: "cn", totalM: 8750, dealType: "Licensing", technology: "", indication: "항암·면역" },
  { date: "2026.02.02", payer: "Genentech", payerCountry: "us", payee: "SanegeneBio", payeeCountry: "us", totalM: 1700, dealType: "Licensing", technology: "RNAi", indication: "" },
  { date: "2026.01.30", payer: "AstraZeneca", payerCountry: "gb", payee: "CSPC Pharma", payeeCountry: "cn", totalM: 4700, dealType: "Licensing", technology: "GLP-1 수용체 작용제", indication: "내분비·대사" },
  { date: "2026.01.27", payer: "AbbVie", payerCountry: "us", payee: "Simcere Pharma", payeeCountry: "cn", totalM: 1458, dealType: "Licensing", technology: "이중특이항체", indication: "항암" },
  { date: "2026.01.23", payer: "Novartis", payerCountry: "ch", payee: "Hummingbird Bio", payeeCountry: "gb", totalM: 1715, dealType: "Licensing", technology: "항체-약물접합체(ADC)", indication: "항암" },
  { date: "2026.01.22", payer: "AbbVie", payerCountry: "us", payee: "Gubra", payeeCountry: "dk", totalM: 920, dealType: "Licensing", technology: "GLP-1/아밀린 이중작용제", indication: "내분비·대사" },
  { date: "2026.01.17", payer: "GSK", payerCountry: "gb", payee: "Aiolos Bio", payeeCountry: "us", totalM: 2200, dealType: "M&A", technology: "항TSLP 항체", indication: "호흡기·면역" },
  { date: "2026.01.14", payer: "Madrigal Pharma", payerCountry: "us", payee: "Calliditas Therapeutics", payeeCountry: "se", totalM: 5000, dealType: "M&A", technology: "소분자 화합물", indication: "간질환·대사" },
  { date: "2026.01.13", payer: "Boehringer Ingelheim", payerCountry: "de", payee: "Zealand Pharma", payeeCountry: "dk", totalM: 1260, dealType: "Licensing", technology: "GLP-1/글루카곤 이중작용제", indication: "내분비·대사" },
];

function formatKrw(millionUsd: number): string {
  const billionKrw = millionUsd * 14.6; // $1M = 14.6억
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

export const BigDealsSection = () => {
  return (
    <div className="card-elevated rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Handshake className="w-4 h-4 text-pharma-amber" />
        <h3 className="font-bold text-sm text-foreground">Big Deals Tracker</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">2026</span>
      </div>
      <div className="divide-y divide-border">
        {DEALS.map((deal, i) => (
          <div key={i} className="px-3 py-2.5 hover:bg-muted/30 transition-colors">
            {/* Row 1: Payer → Payee + Amount */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-foreground truncate">
                {deal.payer}
              </span>
              <FlagImg code={deal.payerCountry} className="shrink-0" />
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="font-semibold text-foreground truncate">
                {deal.payee}
              </span>
              <FlagImg code={deal.payeeCountry} className="shrink-0" />
              <span className="ml-auto font-bold text-primary whitespace-nowrap text-xs">
                {formatKrw(deal.totalM)}
              </span>
            </div>
            {/* Row 2: Deal type + Technology + Indication + Date */}
            <div className="flex items-center gap-1.5 mt-1 text-[10px] flex-wrap">
              <span className={`px-1.5 py-0.5 rounded font-semibold ${
                deal.dealType === "M&A"
                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }`}>
                {deal.dealType}
              </span>
              {deal.technology && (
                <span className="text-muted-foreground">{deal.technology}</span>
              )}
              {deal.indication && (
                <span className="text-muted-foreground">· {deal.indication}</span>
              )}
              <span className="ml-auto text-muted-foreground/60 whitespace-nowrap">{deal.date}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-border">
        <a
          href="https://www.labiotech.eu/biotech-deals-2026/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
        >
          Source: Labiotech.eu Deals Tracker 2026 →
        </a>
      </div>
    </div>
  );
};
