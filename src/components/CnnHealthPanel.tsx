import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink } from "lucide-react";

type CnnArticle = {
  title: string;
  url: string;
  imageUrl?: string;
};

export const CnnHealthPanel = () => {
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["cnn-health"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("crawl-cnn-health");
      if (error) throw error;
      return (data?.articles || []) as CnnArticle[];
    },
    staleTime: 1000 * 60 * 30, // 30min cache
    refetchOnWindowFocus: false,
  });

  const featured = articles[0];
  const rest = articles.slice(1, 10);

  return (
    <div
      className="card-elevated rounded-lg overflow-hidden sticky top-[100px]"
      style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}
    >
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-bold text-foreground">🌍 CNN Health</h2>
      </div>

      {isLoading ? (
        <div className="px-4 py-10 text-center text-xs text-muted-foreground">
          로딩 중...
        </div>
      ) : articles.length === 0 ? (
        <div className="px-4 py-10 text-center text-xs text-muted-foreground">
          기사를 불러올 수 없습니다
        </div>
      ) : (
        <div>
          {/* Featured article with image */}
          {featured && (
            <a
              href={featured.url}
              target="_blank"
              rel="noreferrer"
              className="block group"
            >
              {featured.imageUrl && (
                <div className="w-full aspect-[16/10] overflow-hidden">
                  <img
                    src={featured.imageUrl}
                    alt={featured.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="px-4 py-3">
                <h3 className="text-[15px] font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                  {featured.title}
                </h3>
              </div>
            </a>
          )}

          {/* Rest of headlines */}
          <div className="divide-y divide-border">
            {rest.map((article, i) => (
              <a
                key={i}
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 px-4 py-3 hover:bg-muted/50 transition-colors group"
              >
                <p className="text-[13px] font-medium text-foreground leading-snug group-hover:text-primary transition-colors flex-1">
                  {article.title}
                </p>
                <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-border">
            <a
              href="https://edition.cnn.com/health"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              CNN Health에서 더 보기 →
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
