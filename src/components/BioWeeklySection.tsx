import { useState } from "react";
import { BookOpen, ChevronDown, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type SubstackPost = {
  id: string;
  title: string;
  source: string;
  source_label: string;
  url: string;
  date: string;
  summary: string | null;
  is_free: boolean;
};

const SOURCE_TABS = [
  { key: "all", label: "전체" },
  { key: "kiinbio", label: "Kiinbio" },
  { key: "decodingbio", label: "Decoding Bio" },
  { key: "techlifesci", label: "Bio Tech" },
  { key: "thebiobrief", label: "Bio Brief" },
];

export const BioWeeklySection = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState("all");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["substack-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("substack_posts")
        .select("*")
        .eq("is_free", true)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as SubstackPost[];
    },
  });

  const filtered = sourceFilter === "all" ? posts : posts.filter((p) => p.source === sourceFilter);

  if (isLoading) {
    return (
      <div className="text-center py-16 card-elevated rounded-lg">
        <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3 animate-pulse" />
        <p className="text-muted-foreground text-sm">바이오 위클리 불러오는 중...</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-16 card-elevated rounded-lg">
        <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
        <p className="text-muted-foreground text-sm">아직 수집된 글이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSourceFilter(tab.key)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              sourceFilter === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.map((post) => {
        const isOpen = expandedId === post.id;
        return (
          <div
            key={post.id}
            className="bg-card border border-border rounded-lg overflow-hidden transition-colors"
          >
            <button
              onClick={() => setExpandedId(isOpen ? null : post.id)}
              className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground leading-snug break-all">{post.title}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-medium text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded">
                      {post.source_label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{post.date}</span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform mt-0.5 ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                {post.summary ? (
                  <div className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-line">
                    {post.summary.split("\n").map((line, idx) => {
                      const trimmed = line.trim();
                      if (/^\[.+\]$/.test(trimmed)) {
                        return (
                          <p key={idx} className="text-foreground/90 text-[13px] font-semibold mt-3 mb-1 first:mt-0">
                            {trimmed}
                          </p>
                        );
                      }
                      if (/^\*\*.+\*\*$/.test(trimmed)) {
                        return (
                          <p key={idx} className="text-foreground/90 text-[13px] font-semibold mt-3 mb-1 first:mt-0">
                            {trimmed.replace(/\*\*/g, "")}
                          </p>
                        );
                      }
                      if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
                        return (
                          <p key={idx} className="text-foreground/90 text-[13px] font-semibold mt-3 mb-1 first:mt-0">
                            {trimmed.replace(/^#+\s*/, "")}
                          </p>
                        );
                      }
                      if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
                        return (
                          <p key={idx} className="pl-3 my-0.5">
                            <span className="text-muted-foreground/60 mr-1">•</span>
                            {trimmed.replace(/^[-*•]\s*/, "").replace(/\*\*(.+?)\*\*/g, "$1")}
                          </p>
                        );
                      }
                      if (!trimmed) return <br key={idx} />;
                      return <p key={idx} className="my-1">{trimmed.replace(/\*\*(.+?)\*\*/g, "$1")}</p>;
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">요약 정보가 없습니다.</p>
                )}
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background border border-border text-primary hover:bg-muted transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  원문 보기
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
