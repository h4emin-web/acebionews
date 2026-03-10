import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, RefreshCw, TrendingUp, Calendar, Sparkles } from "lucide-react";
import { PillLoader } from "@/components/PillLoader";

// ─────────────────────────────────────────
// 탭 정의
// ─────────────────────────────────────────
type Tab = "briefing" | "trend" | "calendar";
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "briefing", label: "AI 브리핑", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { key: "trend",    label: "키워드 트렌드", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: "calendar", label: "이벤트",    icon: <Calendar className="w-3.5 h-3.5" /> },
];

// ─────────────────────────────────────────
// AI 브리핑
// ─────────────────────────────────────────
const BriefingPanel = () => {
  const today = new Date().toISOString().split("T")[0];

  const { data: briefing, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["daily-briefing", today],
    queryFn: async () => {
      // 오늘 뉴스 가져오기
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yd = yesterday.toISOString().split("T")[0];

      const { data: news } = await supabase
        .from("news_articles")
        .select("title, summary, source, region, category")
        .gte("date", yd)
        .order("created_at", { ascending: false })
        .limit(40);

      if (!news || news.length === 0) return null;

      const newsList = news
        .map((n: any) => `[${n.region}/${n.source}] ${n.title}`)
        .join("\n");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `당신은 제약·바이오 산업 전문 에디터입니다. 오늘의 주요 뉴스를 간결하고 임팩트 있게 브리핑해주세요.
응답은 반드시 아래 JSON 형식으로만 반환하세요. (마크다운 코드블록 없이 순수 JSON)
{
  "headline": "오늘의 한줄 헤드라인 (20자 이내)",
  "items": [
    { "emoji": "💊", "title": "주제 (10자 이내)", "summary": "2~3줄 요약" },
    ...최대 5개
  ],
  "insight": "에디터 코멘트 — 전체 흐름을 한 문장으로"
}`,
          messages: [{ role: "user", content: `다음 오늘의 뉴스를 브리핑해주세요:\n\n${newsList}` }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || "{}";
      return JSON.parse(text.replace(/```json|```/g, "").trim());
    },
    staleTime: 1000 * 60 * 60, // 1시간 캐시
    refetchOnWindowFocus: false,
  });

  if (isLoading || isFetching) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <PillLoader text="AI 브리핑 생성 중..." />
        <p className="text-[10px] text-muted-foreground">오늘의 뉴스를 분석하고 있어요</p>
      </div>
    );
  }

  if (!briefing) {
    return <div className="py-12 text-center text-xs text-muted-foreground">오늘 뉴스가 없습니다</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {/* 헤드라인 */}
      <div className="bg-foreground text-background rounded-lg px-4 py-3">
        <p className="text-[10px] font-medium opacity-60 mb-1">TODAY'S HEADLINE</p>
        <p className="text-[14px] font-bold leading-snug">{briefing.headline}</p>
      </div>

      {/* 주요 항목 */}
      <div className="space-y-3">
        {briefing.items?.map((item: any, i: number) => (
          <div key={i} className="flex gap-3">
            <span className="text-lg shrink-0 mt-0.5">{item.emoji}</span>
            <div>
              <p className="text-[12px] font-semibold text-foreground">{item.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{item.summary}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 에디터 코멘트 */}
      {briefing.insight && (
        <div className="border-t border-border pt-3">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1">에디터 코멘트</p>
          <p className="text-[11px] text-foreground leading-relaxed italic">"{briefing.insight}"</p>
        </div>
      )}

      {/* 재생성 버튼 */}
      <button
        onClick={() => refetch()}
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        다시 생성
      </button>
    </div>
  );
};

// ─────────────────────────────────────────
// 키워드 트렌드
// ─────────────────────────────────────────

// 불용어
const STOPWORDS = new Set([
  "이", "가", "을", "를", "의", "에", "에서", "으로", "로", "와", "과",
  "한", "하는", "하여", "및", "등", "위한", "대한", "통해", "위해", "관련",
  "발표", "공개", "진행", "시작", "완료", "확인", "제공", "지원", "개발",
  "the", "a", "an", "of", "in", "for", "to", "and", "or", "is", "are",
  "with", "on", "at", "by", "from", "new", "study", "data", "drug",
]);

const TrendPanel = () => {
  const { data: keywords = [], isLoading } = useQuery({
    queryKey: ["keyword-trend-7d"],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const from = sevenDaysAgo.toISOString().split("T")[0];

      const { data: news } = await supabase
        .from("news_articles")
        .select("title, category")
        .gte("date", from)
        .order("date", { ascending: false })
        .limit(300);

      if (!news) return [];

      const freq: Record<string, { count: number; category: string }> = {};

      news.forEach((n: any) => {
        // 한글 2글자 이상, 영어 4글자 이상 단어 추출
        const words = (n.title || "")
          .split(/[\s,.\-()[\]\/·\|]+/)
          .map((w: string) => w.trim())
          .filter((w: string) => {
            if (STOPWORDS.has(w.toLowerCase())) return false;
            const isKo = /[가-힣]/.test(w);
            const isEn = /^[a-zA-Z]+$/.test(w);
            return (isKo && w.length >= 2) || (isEn && w.length >= 4);
          });

        words.forEach((w: string) => {
          const key = w.toLowerCase();
          if (!freq[key]) freq[key] = { count: 0, category: n.category || "" };
          freq[key].count++;
        });
      });

      return Object.entries(freq)
        .filter(([, v]) => v.count >= 2)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 30)
        .map(([word, v], i) => ({ word, count: v.count, rank: i + 1 }));
    },
    staleTime: 1000 * 60 * 30,
  });

  const max = keywords[0]?.count || 1;

  if (isLoading) return <div className="py-12"><PillLoader text="분석 중..." /></div>;

  return (
    <div className="p-4">
      <p className="text-[10px] text-muted-foreground mb-3">최근 7일 뉴스 기준 · {keywords.length}개 키워드</p>
      <div className="space-y-2">
        {keywords.map((kw, i) => (
          <div key={kw.word} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono w-5 text-right shrink-0">{kw.rank}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-[12px] font-medium text-foreground truncate ${i < 3 ? "font-bold" : ""}`}>
                  {kw.word}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{kw.count}회</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full transition-all"
                  style={{ width: `${(kw.count / max) * 100}%`, opacity: i < 3 ? 1 : 0.4 }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// 이벤트 캘린더
// ─────────────────────────────────────────
type BioEvent = {
  id: string;
  title: string;
  date: string;
  location?: string;
  url?: string;
  category: "conference" | "fda" | "earnings" | "other";
};

const EVENT_COLORS: Record<string, string> = {
  conference: "bg-blue-500",
  fda:        "bg-red-500",
  earnings:   "bg-emerald-500",
  other:      "bg-muted-foreground",
};
const EVENT_LABELS: Record<string, string> = {
  conference: "학회", fda: "FDA", earnings: "실적", other: "기타",
};

const CalendarPanel = () => {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["bio-events"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("crawl-bio-events");
      if (error) throw error;
      return (data?.events || []) as BioEvent[];
    },
    staleTime: 1000 * 60 * 60 * 6, // 6시간 캐시
    refetchOnWindowFocus: false,
  });

  // 날짜 그룹핑
  const grouped = useMemo(() => {
    const map: Record<string, BioEvent[]> = {};
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  const today = new Date().toISOString().split("T")[0];

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  };

  if (isLoading) return <div className="py-12"><PillLoader text="이벤트 로딩 중..." /></div>;

  if (events.length === 0) {
    return (
      <div className="p-4 py-12 text-center">
        <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">이벤트 정보를 불러올 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {grouped.map(([date, evts]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[11px] font-bold ${date === today ? "text-foreground" : "text-muted-foreground"}`}>
              {formatDate(date)}
            </span>
            {date === today && (
              <span className="text-[9px] font-bold bg-foreground text-background px-1.5 py-0.5 rounded">TODAY</span>
            )}
          </div>
          <div className="space-y-1.5 ml-1">
            {evts.map(ev => (
              <div key={ev.id} className="flex items-start gap-2 group">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${EVENT_COLORS[ev.category]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-[12px] font-medium text-foreground leading-snug">{ev.title}</p>
                    {ev.url && (
                      <a href={ev.url} target="_blank" rel="noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-medium px-1 py-0.5 rounded bg-muted text-muted-foreground`}>
                      {EVENT_LABELS[ev.category]}
                    </span>
                    {ev.location && <span className="text-[10px] text-muted-foreground">{ev.location}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────
// 메인 패널
// ─────────────────────────────────────────
export const RightPanel = () => {
  const [tab, setTab] = useState<Tab>("briefing");

  return (
    <div
      className="card-elevated rounded-lg overflow-hidden sticky top-[100px] flex flex-col"
      style={{ maxHeight: "calc(100vh - 120px)" }}
    >
      {/* 탭 헤더 */}
      <div className="flex border-b border-border shrink-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* 내용 */}
      <div className="overflow-y-auto scrollbar-hide flex-1">
        {tab === "briefing"  && <BriefingPanel />}
        {tab === "trend"     && <TrendPanel />}
        {tab === "calendar"  && <CalendarPanel />}
      </div>
    </div>
  );
};
