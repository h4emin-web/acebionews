import { useState } from "react";
import { Award, ChevronDown, FlaskConical } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type DmfEntry = {
  rank: number;
  name: string;
  nameKo: string;
  count: number;
  indication: string;
};

const dmfData: DmfEntry[] = [
  { rank: 1, name: "FINERENONE", nameKo: "피네레논", count: 11, indication: "비스테로이드성 미네랄코르티코이드 수용체 길항제 — 제2형 당뇨병 관련 만성 신장 질환(CKD) 치료" },
  { rank: 2, name: "TIRZEPATIDE", nameKo: "티르제파타이드", count: 10, indication: "GIP/GLP-1 이중 수용체 작용제 — 제2형 당뇨병 및 비만 치료" },
  { rank: 3, name: "SEMAGLUTIDE", nameKo: "세마글루타이드", count: 9, indication: "GLP-1 수용체 작용제 — 제2형 당뇨병, 비만, 심혈관 위험 감소" },
  { rank: 4, name: "HUMAN UMBILICAL CORD MESENCHYM.", nameKo: "인간 제대혈 중간엽 줄기세포", count: 8, indication: "인간 제대혈 유래 중간엽 줄기세포 — 재생의학, 이식편대숙주병(GvHD), 자가면역 질환 등 세포치료" },
  { rank: 5, name: "DEUCRAVACITINIB", nameKo: "듀크라바시티닙", count: 6, indication: "TYK2 억제제 — 중등도~중증 판상 건선 치료" },
  { rank: 6, name: "ABEMACICLIB", nameKo: "아베마시클립", count: 6, indication: "CDK4/6 억제제 — HR+/HER2− 진행성 또는 전이성 유방암 치료" },
  { rank: 7, name: "APIXABAN", nameKo: "아픽사반", count: 5, indication: "Factor Xa 억제제 — 심방세동 관련 뇌졸중 예방, 심부정맥 혈전증(DVT) 및 폐색전증(PE) 치료·예방" },
  { rank: 8, name: "MAVACAMTEN", nameKo: "마바캄텐", count: 5, indication: "심장 미오신 억제제 — 폐쇄성 비대심근병증(oHCM) 치료" },
  { rank: 9, name: "RESMETIROM", nameKo: "레스메티롬", count: 5, indication: "THR-β 작용제 — 비알코올성 지방간염(NASH/MASH) 치료" },
  { rank: 10, name: "MARALIXIBAT CHLORIDE", nameKo: "마랄릭시바트 염화물", count: 4, indication: "IBAT 억제제 — 알라질 증후군(ALGS) 관련 담즙정체성 소양증 치료" },
  { rank: 11, name: "VONOPRAZAN FUMARATE", nameKo: "보노프라잔 푸마르산염", count: 4, indication: "칼륨 경쟁적 위산분비 억제제(P-CAB) — 위식도역류질환(GERD), 헬리코박터 파일로리 제균" },
  { rank: 12, name: "OLAPARIB", nameKo: "올라파립", count: 4, indication: "PARP 억제제 — BRCA 변이 난소암, 유방암, 전립선암, 췌장암 치료" },
  { rank: 13, name: "NUSINERSEN SODIUM", nameKo: "누시너센 나트륨", count: 4, indication: "안티센스 올리고뉴클레오타이드 — 척수성 근위축증(SMA) 치료" },
  { rank: 14, name: "MARIBAVIR", nameKo: "마리바비르", count: 4, indication: "UL97 키나아제 억제제 — 이식 후 거대세포바이러스(CMV) 감염 치료" },
  { rank: 15, name: "EDOXABAN TOSYLATE MONOHYDRATE", nameKo: "에독사반 토실산염 일수화물", count: 4, indication: "Factor Xa 억제제 — 심방세동 관련 뇌졸중 예방, DVT/PE 치료" },
  { rank: 16, name: "RUXOLITINIB PHOSPHATE", nameKo: "룩소리티닙 인산염", count: 4, indication: "JAK1/JAK2 억제제 — 골수섬유증, 진성 적혈구증가증, 이식편대숙주병(GvHD) 치료" },
  { rank: 17, name: "ORFORGLIPRON", nameKo: "오르포글리프론", count: 3, indication: "경구용 GLP-1 수용체 작용제 — 제2형 당뇨병 및 비만 치료 (임상 단계)" },
  { rank: 18, name: "BELZUTIFAN", nameKo: "벨주티판", count: 3, indication: "HIF-2α 억제제 — 폰 히펠-린다우(VHL)병 관련 신세포암 치료" },
  { rank: 19, name: "DAPAGLIFLOZIN", nameKo: "다파글리플로진", count: 3, indication: "SGLT2 억제제 — 제2형 당뇨병, 심부전, 만성 신장 질환 치료" },
  { rank: 20, name: "SEMAGLUTIDE", nameKo: "세마글루타이드", count: 3, indication: "GLP-1 수용체 작용제 — 제2형 당뇨병, 비만, 심혈관 위험 감소" },
  { rank: 21, name: "RETATRUTIDE", nameKo: "레타트루타이드", count: 3, indication: "GIP/GLP-1/글루카곤 삼중 수용체 작용제 — 비만 및 제2형 당뇨병 치료 (임상 단계)" },
  { rank: 22, name: "APALUTAMIDE", nameKo: "아팔루타마이드", count: 3, indication: "안드로겐 수용체 억제제 — 비전이성 거세저항성 전립선암(nmCRPC) 치료" },
  { rank: 23, name: "VISMODEGIB", nameKo: "비스모데깁", count: 3, indication: "헤지호그 신호전달 억제제 — 진행성 기저세포암 치료" },
  { rank: 24, name: "MINOXIDIL USP", nameKo: "미녹시딜", count: 3, indication: "혈관확장제 — 고혈압 치료 및 탈모(안드로겐성 탈모증) 치료" },
  { rank: 25, name: "CARFILZOMIB", nameKo: "카르필조밉", count: 3, indication: "프로테아좀 억제제 — 재발성/불응성 다발성 골수종 치료" },
  { rank: 26, name: "SEMAGLUTIDE", nameKo: "세마글루타이드", count: 3, indication: "GLP-1 수용체 작용제 — 제2형 당뇨병, 비만, 심혈관 위험 감소" },
  { rank: 27, name: "RIVAROXABAN USP", nameKo: "리바록사반", count: 3, indication: "Factor Xa 억제제 — 심방세동 관련 뇌졸중 예방, DVT/PE 치료·예방" },
  { rank: 28, name: "EMPAGLIFLOZIN", nameKo: "엠파글리플로진", count: 3, indication: "SGLT2 억제제 — 제2형 당뇨병, 심부전, 심혈관 위험 감소" },
  { rank: 29, name: "ENZALUTAMIDE", nameKo: "엔잘루타마이드", count: 3, indication: "안드로겐 수용체 억제제 — 전이성 거세저항성 전립선암(mCRPC) 치료" },
  { rank: 30, name: "ELTROMBOPAG OLAMINE", nameKo: "엘트롬보팍 올라민", count: 3, indication: "트롬보포이에틴 수용체 작용제 — 만성 면역성 혈소판감소증(ITP) 치료" },
  { rank: 31, name: "TIRZEPATIDE", nameKo: "티르제파타이드", count: 3, indication: "GIP/GLP-1 이중 수용체 작용제 — 제2형 당뇨병 및 비만 치료" },
  { rank: 32, name: "RIOCIGUAT", nameKo: "리오시구앗", count: 3, indication: "가용성 구아닐산 고리화효소(sGC) 자극제 — 폐동맥 고혈압(PAH) 치료" },
  { rank: 33, name: "RETATRUTIDE", nameKo: "레타트루타이드", count: 3, indication: "GIP/GLP-1/글루카곤 삼중 수용체 작용제 — 비만 및 제2형 당뇨병 치료 (임상 단계)" },
  { rank: 34, name: "ATOGEPANT", nameKo: "아토게판트", count: 2, indication: "CGRP 수용체 길항제 — 편두통 예방 치료" },
  { rank: 35, name: "CANNABIDIOL", nameKo: "칸나비디올", count: 2, indication: "칸나비노이드 — 레녹스-가스토 증후군, 드라베 증후군 등 난치성 간질 치료" },
  { rank: 36, name: "SODIUM PHENYLBUTYRATE USP", nameKo: "페닐부티르산 나트륨", count: 2, indication: "요소 회로 이상 치료 — 고암모니아혈증 관리" },
  { rank: 37, name: "SEMAGLUTIDE SIDE CHAIN", nameKo: "세마글루타이드 측쇄", count: 2, indication: "GLP-1 수용체 작용제 중간체 — 세마글루타이드 합성용 원료" },
  { rank: 38, name: "SODIUM VALPROATE", nameKo: "발프로산 나트륨", count: 2, indication: "항경련제 — 간질, 양극성 장애, 편두통 예방" },
  { rank: 39, name: "MYCOPHENOLATE MOFETIL", nameKo: "미코페놀레이트 모페틸", count: 2, indication: "면역억제제 — 장기이식 거부반응 예방, 루푸스 신염 치료" },
  { rank: 40, name: "ETHINYL ESTRADIOL", nameKo: "에티닐 에스트라디올", count: 2, indication: "합성 에스트로겐 — 경구 피임약, 호르몬 대체 요법" },
  { rank: 41, name: "ENSIFENTRINE", nameKo: "엔시펜트린", count: 2, indication: "PDE3/PDE4 이중 억제제 — 만성 폐쇄성 폐질환(COPD) 치료" },
  { rank: 42, name: "RIBOCICLIB SUCCINATE", nameKo: "리보시클립 숙신산염", count: 2, indication: "CDK4/6 억제제 — HR+/HER2− 진행성 유방암 치료" },
  { rank: 43, name: "CARFILZOMIB", nameKo: "카르필조밉", count: 2, indication: "프로테아좀 억제제 — 재발성/불응성 다발성 골수종 치료" },
  { rank: 44, name: "CARFILZOMIB, NON-STERILE, BULK DRUG", nameKo: "카르필조밉 벌크 원료", count: 2, indication: "프로테아좀 억제제 벌크 원료 — 다발성 골수종 치료제 제조용" },
  { rank: 45, name: "BRIVARACETAM (PROCESS-II)", nameKo: "브리바라세탐", count: 2, indication: "SV2A 리간드 — 부분 발작(간질) 보조 치료" },
  { rank: 46, name: "ESCITALOPRAM OXALATE USP", nameKo: "에스시탈로프람 옥살산염", count: 2, indication: "선택적 세로토닌 재흡수 억제제(SSRI) — 주요 우울장애, 범불안장애 치료" },
  { rank: 47, name: "MESENCHYMAL STEM CELL SERUM-FREE", nameKo: "무혈청 중간엽 줄기세포", count: 2, indication: "무혈청 배양 중간엽 줄기세포 — 재생의학 및 세포치료" },
  { rank: 48, name: "OMADACYCLINE TOSYLATE", nameKo: "오마다사이클린 토실산염", count: 2, indication: "아미노메틸사이클린계 항생제 — 지역사회 획득 폐렴, 급성 세균성 피부감염 치료" },
  { rank: 49, name: "GEPIRONE HYDROCHLORIDE", nameKo: "게피론 염산염", count: 2, indication: "5-HT1A 수용체 작용제 — 주요 우울장애 치료" },
  { rank: 50, name: "RIFAXIMIN", nameKo: "리팍시민", count: 2, indication: "리파마이신계 항생제 — 여행자 설사, 간성 뇌증, 과민성 대장증후군(IBS-D) 치료" },
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
        <h2 className="text-sm font-semibold text-foreground">US DMF 2025</h2>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono mr-2">TOP 50</span>
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
                <span className="w-6 text-center text-xs font-bold shrink-0 text-foreground">
                  {item.rank}
                </span>
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); onKeywordClick(item.name); }}
                >
                  <span className="text-xs font-medium text-foreground block truncate hover:text-primary transition-colors">
                    {item.nameKo}
                  </span>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    {item.name}
                  </span>
                </div>
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
