import { useState } from "react";
import { Award, ChevronDown, FlaskConical } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type DmfEntry = {
  rank: number;
  name: string;
  count: number;
  indication: string;
};

const dmfData: DmfEntry[] = [
  { rank: 1, name: "FINERENONE", count: 11, indication: "비스테로이드성 미네랄코르티코이드 수용체 길항제 — 제2형 당뇨병 관련 만성 신장 질환(CKD) 치료" },
  { rank: 2, name: "TIRZEPATIDE", count: 10, indication: "GIP/GLP-1 이중 수용체 작용제 — 제2형 당뇨병 및 비만 치료" },
  { rank: 3, name: "SEMAGLUTIDE", count: 9, indication: "GLP-1 수용체 작용제 — 제2형 당뇨병, 비만, 심혈관 위험 감소" },
  { rank: 4, name: "HUMAN UMBILICAL CORD MESENCHYM.", count: 8, indication: "인간 제대혈 유래 중간엽 줄기세포 — 재생의학, 이식편대숙주병(GvHD), 자가면역 질환 등 세포치료" },
  { rank: 5, name: "DEUCRAVACITINIB", count: 6, indication: "TYK2 억제제 — 중등도~중증 판상 건선 치료" },
  { rank: 5, name: "ABEMACICLIB", count: 6, indication: "CDK4/6 억제제 — HR+/HER2− 진행성 또는 전이성 유방암 치료" },
  { rank: 7, name: "APIXABAN", count: 5, indication: "Factor Xa 억제제 — 심방세동 관련 뇌졸중 예방, 심부정맥 혈전증(DVT) 및 폐색전증(PE) 치료·예방" },
  { rank: 7, name: "MAVACAMTEN", count: 5, indication: "심장 미오신 억제제 — 폐쇄성 비대심근병증(oHCM) 치료" },
  { rank: 7, name: "RESMETIROM", count: 5, indication: "THR-β 작용제 — 비알코올성 지방간염(NASH/MASH) 치료" },
  { rank: 10, name: "MARALIXIBAT CHLORIDE", count: 4, indication: "IBAT 억제제 — 알라질 증후군(ALGS) 관련 담즙정체성 소양증 치료" },
  { rank: 10, name: "VONOPRAZAN FUMARATE", count: 4, indication: "칼륨 경쟁적 위산분비 억제제(P-CAB) — 위식도역류질환(GERD), 헬리코박터 파일로리 제균" },
  { rank: 10, name: "OLAPARIB", count: 4, indication: "PARP 억제제 — BRCA 변이 난소암, 유방암, 전립선암, 췌장암 치료" },
  { rank: 10, name: "NUSINERSEN SODIUM", count: 4, indication: "안티센스 올리고뉴클레오타이드 — 척수성 근위축증(SMA) 치료" },
  { rank: 10, name: "MARIBAVIR", count: 4, indication: "UL97 키나아제 억제제 — 이식 후 거대세포바이러스(CMV) 감염 치료" },
  { rank: 10, name: "EDOXABAN TOSYLATE MONOHYDRATE", count: 4, indication: "Factor Xa 억제제 — 심방세동 관련 뇌졸중 예방, DVT/PE 치료" },
  { rank: 10, name: "RUXOLITINIB PHOSPHATE", count: 4, indication: "JAK1/JAK2 억제제 — 골수섬유증, 진성 적혈구증가증, 이식편대숙주병(GvHD) 치료" },
];

type Props = {
  onKeywordClick: (kw: string) => void;
};

export const UsDmfSection = ({ onKeywordClick }: Props) => {
  const [open, setOpen] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full px-5 py-3.5 border-b border-border flex items-center gap-2 hover:bg-muted/50 transition-colors">
        <Award className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-foreground">2025 US DMF 승인 순위</h2>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono mr-2">TOP 16</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
          {dmfData.map((item, idx) => (
            <div key={idx} className="group">
              <button
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
              >
                <span className={`w-6 text-center text-xs font-bold shrink-0 ${item.rank <= 3 ? "text-amber-500" : "text-muted-foreground"}`}>
                  {item.rank}
                </span>
                <span
                  className="text-xs font-medium text-foreground truncate flex-1 hover:text-primary cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); onKeywordClick(item.name); }}
                >
                  {item.name}
                </span>
                <span className="text-xs font-bold text-primary tabular-nums shrink-0">{item.count}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ${expandedIdx === idx ? "rotate-180" : ""}`} />
              </button>
              {expandedIdx === idx && (
                <div className="px-5 pb-3 pl-14">
                  <div className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed bg-muted/30 rounded-md px-3 py-2">
                    <FlaskConical className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
                    <span>{item.indication}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
