import { useState } from "react";
import { Crown, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type TopDrug = {
  rank: number;
  name: string;
  ingredient: string;
  company: string;
  revenue: string;
  patentExpiry: string;
  region: "국내" | "해외";
};

// 매출 상위 완제의약품 특허만료일 (2024 기준 공개 자료)
const TOP_DRUGS_DATA: TopDrug[] = [
  // 해외 (글로벌 매출 기준)
  { rank: 1, name: "Keytruda", ingredient: "펨브롤리주맙 (Pembrolizumab)", company: "Merck", revenue: "$25.0B", patentExpiry: "2028-01", region: "해외" },
  { rank: 2, name: "Ozempic/Wegovy", ingredient: "세마글루타이드 (Semaglutide)", company: "Novo Nordisk", revenue: "$22.3B", patentExpiry: "2026-09", region: "해외" },
  { rank: 3, name: "Eliquis", ingredient: "아픽사반 (Apixaban)", company: "BMS/Pfizer", revenue: "$18.1B", patentExpiry: "2026-11", region: "해외" },
  { rank: 4, name: "Humira", ingredient: "아달리무맙 (Adalimumab)", company: "AbbVie", revenue: "$14.4B", patentExpiry: "2023-01 (만료)", region: "해외" },
  { rank: 5, name: "Biktarvy", ingredient: "빅테그라비르 (Bictegravir)", company: "Gilead", revenue: "$13.1B", patentExpiry: "2033-02", region: "해외" },
  // 국내 (원외처방액 기준)
  { rank: 1, name: "리피토", ingredient: "아토르바스타틴 (Atorvastatin)", company: "한국화이자", revenue: "₩3,200억", patentExpiry: "2024-03 (만료)", region: "국내" },
  { rank: 2, name: "자누비아", ingredient: "시타글립틴 (Sitagliptin)", company: "한국MSD", revenue: "₩2,800억", patentExpiry: "2026-10", region: "국내" },
  { rank: 3, name: "자렐토", ingredient: "리바록사반 (Rivaroxaban)", company: "바이엘코리아", revenue: "₩2,500억", patentExpiry: "2026-07", region: "국내" },
  { rank: 4, name: "넥시움", ingredient: "에스오메프라졸 (Esomeprazole)", company: "한국AZ", revenue: "₩2,200억", patentExpiry: "2024-05 (만료)", region: "국내" },
  { rank: 5, name: "포시가", ingredient: "다파글리플로진 (Dapagliflozin)", company: "한국AZ", revenue: "₩2,100억", patentExpiry: "2027-04", region: "국내" },
];

const getRankBadge = (rank: number) => {
  if (rank === 1) return "bg-amber-400 text-white";
  if (rank === 2) return "bg-gray-300 text-gray-700";
  if (rank === 3) return "bg-amber-600/70 text-white";
  return "bg-muted text-muted-foreground";
};

type Props = {
  onKeywordClick: (kw: string) => void;
};

export const TopDrugsPatentSection = ({ onKeywordClick }: Props) => {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"국내" | "해외">("해외");

  const filtered = TOP_DRUGS_DATA
    .filter((d) => d.region === tab)
    .sort((a, b) => a.rank - b.rank);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <Crown className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-foreground">매출 TOP 5 특허만료일</h2>
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
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${getRankBadge(drug.rank)}`}>
                  {drug.rank}
                </span>
                <span className="text-xs font-semibold text-foreground">{drug.name}</span>
                <span className="text-[10px] text-muted-foreground ml-auto font-mono">{drug.revenue}</span>
              </div>
              <button
                onClick={() => onKeywordClick(drug.ingredient)}
                className="text-[11px] font-mono text-primary hover:underline cursor-pointer mb-1 block ml-7"
              >
                {drug.ingredient}
              </button>
              <div className="flex items-center justify-between ml-7">
                <span className="text-[10px] text-muted-foreground">{drug.company}</span>
                <span className={`text-[10px] font-semibold ${
                  drug.patentExpiry.includes("만료") ? "text-red-500" : "text-foreground"
                }`}>
                  {drug.patentExpiry}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
