import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return new Date().toISOString().split("T")[0];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NEWS_SOURCES = [
  // 국내
  { url: "https://www.yakup.com", name: "약업신문", region: "국내", country: "KR" },
  { url: "https://www.pharmnews.com", name: "팜뉴스", region: "국내", country: "KR" },
  { url: "https://www.dailypharm.com", name: "데일리팜", region: "국내", country: "KR" },
  // 미국
  { url: "https://www.fiercepharma.com", name: "FiercePharma", region: "해외", country: "US" },
  { url: "https://www.pharmexec.com", name: "Pharma Executive", region: "해외", country: "US" },
  // 유럽
  { url: "https://www.pharmaceutical-technology.com", name: "Pharma Technology", region: "해외", country: "EU" },
  { url: "https://www.thepharmaletter.com", name: "The Pharma Letter", region: "해외", country: "EU" },
  // 인도
  { url: "https://pharma.economictimes.indiatimes.com", name: "ET Pharma India", region: "해외", country: "IN" },
  { url: "https://www.expresspharma.in", name: "Express Pharma", region: "해외", country: "IN" },
  // 중국
  { url: "https://www.pharmacircle.com", name: "PharmaCircle", region: "해외", country: "CN" },
  { url: "https://www.drugdiscoverytrends.com", name: "Drug Discovery Trends", region: "해외", country: "CN" },
  // 일본
  { url: "https://www.nippon.com/en/tag/pharmaceutical", name: "Nippon", region: "해외", country: "JP" },
];

async function crawlSource(source: typeof NEWS_SOURCES[0], FIRECRAWL_API_KEY: string, LOVABLE_API_KEY: string) {
  try {
    console.log(`Crawling ${source.name}: ${source.url}`);
    const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: source.url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 15000,
      }),
    });

    if (!scrapeResp.ok) {
      console.error(`Failed to scrape ${source.name}: ${scrapeResp.status}`);
      return [];
    }

    const scrapeData = await scrapeResp.json();
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";

    if (!markdown || markdown.length < 100) {
      console.log(`No meaningful content from ${source.name}`);
      return [];
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a pharmaceutical news analyst specializing in Active Pharmaceutical Ingredients (APIs/원료의약품).

CRITICAL RULES for API keyword extraction:
- Extract the EXACT active pharmaceutical ingredient name as written in the article
- Use the official Korean pharmaceutical name (한글 약전명) when available
- Examples of VALID API keywords: 유파티린 (Eupatilin), 세마글루타이드 (Semaglutide), 암로디핀 (Amlodipine), 메트포르민 (Metformin), 이마티닙 (Imatinib), 실데나필 (Sildenafil)
- Examples of INVALID keywords: 쑥, 쑥추출물, 엑소좀, mRNA, GLP-1, 보툴리눔 톡신, 백신, 천연물, 생약
- When an article mentions a plant extract, use the ACTIVE COMPOUND name, not the plant name (e.g. 유파티린 not 쑥 or 애엽추출물)
- Do NOT include: plant names, biological categories, mechanism names, receptor names, natural extract names, vaccine types
- If no specific chemical API ingredient name is mentioned, set apiKeywords to []
- Only include articles with at least one valid API keyword

For each valid article:
1. Translate title and summary to Korean
2. Write a concise 2-3 sentence summary in Korean
3. Extract API keywords in format: "한글명 (English Name)" - use the precise active ingredient name
4. Categorize the news

Return at most 5 most relevant articles.`,
          },
          {
            role: "user",
            content: `Extract pharmaceutical/API news from ${source.name} (${source.country}):\n\n${markdown.slice(0, 8000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_news",
              description: "Extract structured news articles",
              parameters: {
                type: "object",
                properties: {
                  articles: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        summary: { type: "string" },
                        apiKeywords: { type: "array", items: { type: "string" } },
                        category: { type: "string" },
                        url: { type: "string" },
                        date: { type: "string" },
                      },
                      required: ["title", "summary", "apiKeywords", "category", "date"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["articles"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_news" } },
      }),
    });

    if (!aiResp.ok) {
      console.error(`AI failed for ${source.name}: ${aiResp.status}`);
      return [];
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return [];

    const parsed = JSON.parse(toolCall.function.arguments);
    const articles = parsed.articles || [];

    const results = [];
    for (const article of articles) {
      if (!article.apiKeywords || article.apiKeywords.length === 0) continue;
      results.push({
        title: article.title,
        summary: article.summary,
        source: source.name,
        region: source.region,
        country: source.country,
        date: normalizeDate(article.date),
        url: article.url || source.url,
        api_keywords: article.apiKeywords,
        category: article.category || "",
        original_language: source.region === "국내" ? "ko" : "en",
      });
    }

    console.log(`Extracted ${results.length} articles from ${source.name}`);
    return results;
  } catch (err) {
    console.error(`Error processing ${source.name}:`, err);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Crawl all sources in parallel (batches of 4)
    const batchSize = 4;
    const allResults: any[] = [];
    for (let i = 0; i < NEWS_SOURCES.length; i += batchSize) {
      const batch = NEWS_SOURCES.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((s) => crawlSource(s, FIRECRAWL_API_KEY, LOVABLE_API_KEY))
      );
      allResults.push(...batchResults.flat());
    }

    if (allResults.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("news_articles")
        .select("title")
        .gte("created_at", today);

      const existingTitles = new Set((existing || []).map((e: any) => e.title));
      const newResults = allResults.filter((r) => !existingTitles.has(r.title));

      if (newResults.length > 0) {
        const { error } = await supabase.from("news_articles").insert(newResults);
        if (error) {
          console.error("DB insert error:", error);
          throw error;
        }
      }
      console.log(`Inserted ${newResults.length} new articles (${allResults.length - newResults.length} duplicates skipped)`);
    }

    return new Response(
      JSON.stringify({ success: true, count: allResults.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("crawl-news error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
