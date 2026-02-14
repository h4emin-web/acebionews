import { useState, useEffect } from "react";
import { X, ExternalLink, TrendingUp, AlertTriangle, Loader2, Atom } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { NewsItem } from "@/data/mockNews";

type Analysis = {
  businessImplication: string;
  affectedMaterials: {
    name: string;
    role: string;
    relevance: "high" | "medium" | "low";
    status: "STABLE" | "RISK" | "OPPORTUNITY";
  }[];
  riskLevel: string;
  category: string;
};

type Props = {
  news: NewsItem | null;
  onClose: () => void;
};

const statusColors: Record<string, string> = {
  STABLE: "bg-emerald-100 text-emerald-700",
  RISK: "bg-red-100 text-red-700",
  OPPORTUNITY: "bg-blue-100 text-blue-700",
};

const relevanceWidth: Record<string, string> = {
  high: "w-full",
  medium: "w-2/3",
  low: "w-1/3",
};

export const NewsAnalysisPanel = ({ news, onClose }: Props) => {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!news) {
      setAnalysis(null);
      return;
    }

    const analyze = async () => {
      setLoading(true);
      setError(null);
      setAnalysis(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke("analyze-news", {
          body: {
            title: news.title,
            summary: news.summary,
            keywords: news.apiKeywords,
          },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        setAnalysis(data);
      } catch (e) {
        console.error("Analysis error:", e);
        setError("분석 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    analyze();
  }, [news?.id]);

  if (!news) return null;

  return (
    <div className="card-elevated rounded-lg sticky top-24 animate-fade-in max-h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <div>
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Intelligence Report</p>
          <h3 className="text-sm font-bold text-foreground mt-0.5">Impact Analysis</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">AI 분석 중...</p>
          </div>
        )}

        {error && (
          <div className="py-8 text-center">
            <AlertTriangle className="w-6 h-6 text-destructive mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-5">
            <p className="text-xs font-semibold text-foreground leading-snug border-b border-border pb-3">
              {news.title}
            </p>

            <div className="rounded-lg bg-primary/5 border border-primary/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-bold text-foreground">Business Implication</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {analysis.businessImplication}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Atom className="w-4 h-4 text-foreground" />
                <h4 className="text-xs font-bold text-foreground">관련 원료의약품</h4>
                <span className="text-[10px] text-muted-foreground ml-auto">{analysis.affectedMaterials.length}건</span>
              </div>
              <div className="space-y-3">
                {analysis.affectedMaterials.map((mat, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono font-semibold text-foreground">{mat.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${statusColors[mat.status] || "bg-muted text-muted-foreground"}`}>
                        {mat.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-2">Role: {mat.role}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Relevance:</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full bg-primary ${relevanceWidth[mat.relevance] || "w-1/3"}`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <a
              href={news.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Source Article
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
