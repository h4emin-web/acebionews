import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Languages } from "lucide-react";
import { useState } from "react";
import { PillLoader } from "@/components/PillLoader";

type CnnArticle = {
  title: string;
  url: string;
  imageUrl?: string;
};

type TranslatedArticle = CnnArticle & { titleKo?: string };

// Claude API로 제목 일괄 번역
const translateTitles = async (titles: string[]): Promise<string[]> => {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: "You are a medical/health news translator. Translate the following English headlines into natural Korean. Return ONLY a JSON array of translated strings, in the same order. No explanations.",
        messages: [{
          role: "user",
          content: `Translate these headlines to Korean:\n${JSON.stringify(titles)}`
        }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return titles;
  }
};

export const CnnHealthPanel = () => {
  const [showKo, setShowKo] = useState(true);

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["cnn-health"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("crawl-cnn-health");
      if (error) throw error;
      return (data?.articles || []) as CnnArticle[];
    },
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  // 번역 쿼리 — articles 로드 후 자동 실행
  const { data: translated = [], isLoading: translating } = useQuery({
    queryKey: ["cnn-health-ko", articles.map(a => a.title).join("|")],
    queryFn: async (): Promise<TranslatedArticle[]> => {
      if (articles.length === 0) return [];
      const titles = articles.map(a => a.title);
      const koTitles = await translateTitles(titles);
      return articles.map((a, i) => ({ ...a, titleKo: koTitles[i] || a.title }));
    },
    enabled: articles.length > 0,
    staleTime: 1000 * 60 * 60,
  });

  const display: TranslatedArticle[] = translated.length > 0 ? translated : articles;
  const featured = display[0];
  const rest = display.slice(1, 10);

  return (
    <div
      className="card-elevated rounded-lg overflow-hidden sticky top-[100px]"
      style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}
    >
      {/* 헤더 */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
        <span className="text-xs font-semibold text-foreground">CNN Health</span>
        <button
          onClick={() => setShowKo(v => !v)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
            showKo ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
          }`}
        >
          <Languages className="w-3 h-3" />
          {showKo ? "한국어" : "English"}
        </button>
      </div>

      {isLoading ? (
        <div className="py-10"><PillLoader text="로딩 중..." /></div>
      ) : articles.length === 0 ? (
        <div className="px-4 py-10 text-center text-xs text-muted-foreground">기사를 불러올 수 없습니다</div>
      ) : (
        <div>
          {/* Featured — 이미지 + 제목 */}
          {featured && (
            <a href={featured.url} target="_blank" rel="noreferrer" className="block group">
              {featured.imageUrl ? (
                <div className="w-full aspect-[16/9] overflow-hidden bg-muted">
                  <img
                    src={featured.imageUrl}
                    alt={featured.titleKo || featured.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              ) : (
                <div className="w-full aspect-[16/9] bg-muted flex items-center justify-center">
                  <span className="text-[11px] text-muted-foreground">CNN Health</span>
                </div>
              )}
              <div className="px-4 py-3">
                {translating && !featured.titleKo ? (
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <h3 className="text-[14px] font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                      {showKo && featured.titleKo ? featured.titleKo : featured.title}
                    </h3>
                    {showKo && featured.titleKo && featured.titleKo !== featured.title && (
                      <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{featured.title}</p>
                    )}
                  </>
                )}
              </div>
            </a>
          )}

          {/* 나머지 기사 */}
          <div className="divide-y divide-border">
            {rest.map((article, i) => (
              <a
                key={i}
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 px-4 py-3 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  {translating && !article.titleKo ? (
                    <div className="h-3.5 w-full bg-muted animate-pulse rounded" />
                  ) : (
                    <>
                      <p className="text-[12px] font-medium text-foreground leading-snug group-hover:text-primary transition-colors">
                        {showKo && article.titleKo ? article.titleKo : article.title}
                      </p>
                      {showKo && article.titleKo && article.titleKo !== article.title && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{article.title}</p>
                      )}
                    </>
                  )}
                </div>
                <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-border">
            <a href="https://edition.cnn.com/health" target="_blank" rel="noreferrer"
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors">
              CNN Health에서 더 보기 →
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
