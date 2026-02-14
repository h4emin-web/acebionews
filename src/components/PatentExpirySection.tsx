import { useState } from "react";
import { Timer, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type PatentDrug = {
  name: string;
  ingredient: string;
  company: string;
  expiryDate: string;
  daysLeft: number;
  region: "국내" | "해외";
};

// 2년 이내 특허만료 예정 주요 완제의약품 (공개 자료 기반)
const PATENT_EXPIRY_DATA: PatentDrug[] = [
  // 해외
  { name: "Keytruda", ingredient: "펨브롤리주맙 (Pembrolizumab)", company: "Merck", expiryDate: "2028-01", daysLeft: 690, region: "해외" },
  { name: "Eliquis", ingredient: "아픽사반 (Apixaban)", company: "BMS/Pfizer", expiryDate: "2026-11", daysLeft: 270, region: "해외" },
  { name: "Jardiance", ingredient: "엠파글리플로진 (Empagliflozin)", company: "Boehringer", expiryDate: "2027-05", daysLeft: 450, region: "해외" },
  { name: "Xarelto", ingredient: "리바록사반 (Rivaroxaban)", company: "Bayer", expiryDate: "2026-07", daysLeft: 150, region: "해외" },
  { name: "Entresto", ingredient: "사쿠비트릴/발사르탄 (Sacubitril/Valsartan)", company: "Novartis", expiryDate: "2026-12", daysLeft: 300, region: "해외" },
  { name: "Ozempic", ingredient: "세마글루타이드 (Semaglutide)", company: "Novo Nordisk", expiryDate: "2026-09", daysLeft: 210, region: "해외" },
  { name: "Imbruvica", ingredient: "이브루티닙 (Ibrutinib)", company: "AbbVie/J&J", expiryDate: "2027-03", daysLeft: 390, region: "해외" },
  { name: "Pomalyst", ingredient: "포말리도마이드 (Pomalidomide)", company: "BMS", expiryDate: "2027-06", daysLeft: 480, region: "해외" },
  // 국내
  { name: "크레스토", ingredient: "로수바스타틴 (Rosuvastatin)", company: "한미약품 외", expiryDate: "2026-08", daysLeft: 180, region: "국내" },
  { name: "자누비아", ingredient: "시타글립틴 (Sitagliptin)", company: "한국MSD", expiryDate: "2026-10", daysLeft: 240, region: "국내" },
  { name: "리리카", ingredient: "프레가발린 (Pregabalin)", company: "한국화이자", expiryDate: "2027-01", daysLeft: 330, region: "국내" },
  { name: "트라젠타", ingredient: "리나글립틴 (Linagliptin)", company: "베링거인겔하임", expiryDate: "2027-08", daysLeft: 540, region: "국내" },
  { name: "포시가", ingredient: "다파글리플로진 (Dapagliflozin)", company: "한국AZ", expiryDate: "2027-04", daysLeft: 420, region: "국내" },
  { name: "자렐토", ingredient: "리바록사반 (Rivaroxaban)", company: "바이엘코리아", expiryDate: "2026-07", daysLeft: 150, region: "국내" },
];

const getUrgencyColor = (daysLeft: number) => {
  if (daysLeft <= 180) return "bg-red-100 text-red-700";
  if (daysLeft <= 365) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
};

type Props = {
  onKeywordClick: (kw: string) => void;
};

export const PatentExpirySection = ({ onKeywordClick }: Props) => {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"국내" | "해외">("해외");

  const filtered = PATENT_EXPIRY_DATA
    .filter((d) => d.region === tab)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <Timer className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-foreground">특허만료 예정 (2년 이내)</h2>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ml-auto ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex border-b border-border">
          {(["해외", "국내"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === t
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "해외" ? "🌍 해외" : "🇰🇷 국내"}
            </button>
          ))}
        </div>
        <div className="divide-y divide-border">
          {filtered.map((drug, i) => (
            <div key={i} className="px-5 py-3 hover:bg-muted/50 transition-colors group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground">{drug.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getUrgencyColor(drug.daysLeft)}`}>
                  {drug.expiryDate}
                </span>
              </div>
              <button
                onClick={() => onKeywordClick(drug.ingredient)}
                className="text-[11px] font-mono text-primary hover:underline cursor-pointer mb-1 block"
              >
                {drug.ingredient}
              </button>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{drug.company}</span>
                <span className="text-[10px] text-muted-foreground">D-{drug.daysLeft}</span>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
