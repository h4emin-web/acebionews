export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  region: "국내" | "해외";
  date: string;
  url: string;
  apiKeywords: string[]; // 원료의약품 키워드
  category: string;
};

export const mockNews: NewsItem[] = [
  {
    id: "1",
    title: "릴리, GLP-1 수용체 작용제 기반 비만 치료제 3상 임상 성공",
    summary: "일라이 릴리가 개발 중인 차세대 GLP-1 수용체 작용제 기반 비만 치료제가 3상 임상시험에서 유의미한 체중 감량 효과를 입증했다. 이번 결과로 관련 원료의약품 수요 급증이 예상된다.",
    source: "Reuters",
    region: "해외",
    date: "2026-02-14",
    url: "#",
    apiKeywords: ["세마글루타이드", "티르제파타이드", "GLP-1 원료"],
    category: "비만 치료제",
  },
  {
    id: "2",
    title: "국내 제네릭 제약사, 고혈압 복합제 원료 수급 안정화",
    summary: "국내 주요 제네릭 제약사들이 고혈압 복합제에 사용되는 원료의약품의 공급망을 다변화하면서 수급이 안정화되고 있다. 암로디핀과 발사르탄 원료 가격이 하향 안정세를 보이고 있다.",
    source: "약업신문",
    region: "국내",
    date: "2026-02-13",
    url: "#",
    apiKeywords: ["암로디핀", "발사르탄", "로사르탄", "히드로클로로티아지드"],
    category: "고혈압",
  },
  {
    id: "3",
    title: "FDA, 신규 항암제 원료 품질 기준 강화 발표",
    summary: "미국 FDA가 항암제에 사용되는 원료의약품의 품질 기준을 대폭 강화하는 가이드라인을 발표했다. 특히 유전독성 불순물 관리 기준이 더욱 엄격해질 예정이다.",
    source: "FDA News",
    region: "해외",
    date: "2026-02-12",
    url: "#",
    apiKeywords: ["이마티닙", "레날리도마이드", "카페시타빈"],
    category: "항암제",
  },
  {
    id: "4",
    title: "삼성바이오에피스, 바이오시밀러 원료 자체 생산 확대",
    summary: "삼성바이오에피스가 바이오시밀러 원료의약품의 자체 생산 비중을 높이기 위해 송도 공장 증설에 나섰다. 이를 통해 원료 수입 의존도를 낮추고 원가 경쟁력을 확보할 방침이다.",
    source: "한국경제",
    region: "국내",
    date: "2026-02-12",
    url: "#",
    apiKeywords: ["아달리무맙", "인플릭시맙", "에타너셉트"],
    category: "바이오시밀러",
  },
  {
    id: "5",
    title: "인도 CDSCO, 항생제 원료 수출 규제 완화 검토",
    summary: "인도 의약품 규제기관 CDSCO가 항생제 원료의약품에 대한 수출 규제를 완화하는 방안을 검토 중이다. 이로 인해 아목시실린, 세팔로스포린 계열 원료의 글로벌 공급이 개선될 전망이다.",
    source: "Pharma Times",
    region: "해외",
    date: "2026-02-11",
    url: "#",
    apiKeywords: ["아목시실린", "세프트리악손", "세팔렉신", "아지스로마이신"],
    category: "항생제",
  },
  {
    id: "6",
    title: "대웅제약, 당뇨병 치료제 원료 국산화 성공",
    summary: "대웅제약이 DPP-4 억제제 계열 당뇨병 치료제의 핵심 원료를 국산화하는 데 성공했다. 기존 중국·인도산 원료 대비 순도가 높으며 생산 비용도 절감할 수 있을 것으로 기대된다.",
    source: "매일경제",
    region: "국내",
    date: "2026-02-11",
    url: "#",
    apiKeywords: ["시타글립틴", "빌다글립틴", "리나글립틴", "메트포르민"],
    category: "당뇨병",
  },
  {
    id: "7",
    title: "EU GMP 인증 강화로 원료의약품 수입 기준 변경",
    summary: "유럽연합이 역외 원료의약품 제조업체에 대한 GMP 인증 기준을 강화했다. 한국 원료의약품 수출 업체들도 새로운 기준에 맞춰 시설 개선이 필요한 상황이다.",
    source: "EMA Bulletin",
    region: "해외",
    date: "2026-02-10",
    url: "#",
    apiKeywords: ["오메프라졸", "에소메프라졸", "판토프라졸"],
    category: "규제/GMP",
  },
  {
    id: "8",
    title: "한미약품, 면역항암제 원료 공급 계약 체결",
    summary: "한미약품이 글로벌 바이오텍과 면역항암제 원료의약품 장기 공급 계약을 체결했다. PD-1 억제제 관련 원료 수요가 지속적으로 증가하는 추세를 반영한 것으로 보인다.",
    source: "팜뉴스",
    region: "국내",
    date: "2026-02-10",
    url: "#",
    apiKeywords: ["니볼루맙", "펨브롤리주맙", "아테졸리주맙"],
    category: "면역항암제",
  },
];

export const allApiKeywords = Array.from(
  new Set(mockNews.flatMap((n) => n.apiKeywords))
).sort();

export const categories = Array.from(new Set(mockNews.map((n) => n.category)));
