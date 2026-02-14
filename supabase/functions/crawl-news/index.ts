import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// News sources to crawl
const NEWS_SOURCES = [
  { url: "https://www.yakup.com", name: "약업신문", region: "국내", country: "KR" },
  { url: "https://www.pharmnews.com", name: "팜뉴스", region: "국내", country: "KR" },
  { url: "https://www.dailypharm.com", name: "데일리팜", region: "국내", country: "KR" },
  { url: "https://www.reuters.com/business/healthcare-pharmaceuticals", name: "Reuters", region: "해외", country: "US" },
  { url: "https://www.fiercepharma.com", name: "FiercePharma", region: "해외", country: "US" },
  { url: "https://pharma.economictimes.indiatimes.com", name: "ET Pharma India", region: "해외", country: "IN" },
  { url: "https://www.pharmaceutical-technology.com", name: "Pharma Technology", region: "해외", country: "EU" },
  { url: "https://www.nippon.com/en/tag/pharmaceutical", name: "Nippon", region: "해외", country: "JP" },
];

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

    const results: any[] = [];

    // Crawl each source
    for (const source of NEWS_SOURCES) {
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
          }),
        });

        if (!scrapeResp.ok) {
          console.error(`Failed to scrape ${source.name}: ${scrapeResp.status}`);
          continue;
        }

        const scrapeData = await scrapeResp.json();
        const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";

        if (!markdown || markdown.length < 100) {
          console.log(`No meaningful content from ${source.name}`);
          continue;
        }

        // Use AI to extract, translate, summarize news and extract API keywords
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
Extract news articles from the provided website content. For each article:
1. Translate the title and summary to Korean if not already in Korean
2. Write a concise 2-3 sentence summary in Korean
3. Extract related API/원료의약품 keywords (ingredient names in Korean)
4. Categorize the news (e.g., 항암제, 비만 치료제, 고혈압, 항생제, 규제/GMP, 바이오시밀러, 무역/공급망, etc.)

Return ONLY a valid JSON array. Each item must have:
- title: string (Korean)
- summary: string (Korean, 2-3 sentences)
- apiKeywords: string[] (Korean API ingredient names)
- category: string (Korean)
- url: string (article URL if available, otherwise empty)
- date: string (YYYY-MM-DD format, today's date if not clear)

Return at most 5 most relevant articles about pharmaceuticals and APIs. If no pharma news found, return an empty array [].`,
              },
              {
                role: "user",
                content: `Extract pharmaceutical/API news from this ${source.name} content:\n\n${markdown.slice(0, 8000)}`,
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
          console.error(`AI processing failed for ${source.name}: ${aiResp.status}`);
          continue;
        }

        const aiData = await aiResp.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          console.log(`No tool call response for ${source.name}`);
          continue;
        }

        const parsed = JSON.parse(toolCall.function.arguments);
        const articles = parsed.articles || [];

        for (const article of articles) {
          results.push({
            title: article.title,
            summary: article.summary,
            source: source.name,
            region: source.region,
            country: source.country,
            date: article.date || new Date().toISOString().split("T")[0],
            url: article.url || source.url,
            api_keywords: article.apiKeywords || [],
            category: article.category || "",
            original_language: source.region === "국내" ? "ko" : "en",
          });
        }

        console.log(`Extracted ${articles.length} articles from ${source.name}`);
      } catch (err) {
        console.error(`Error processing ${source.name}:`, err);
      }
    }

    // Insert into database
    if (results.length > 0) {
      const { error } = await supabase.from("news_articles").insert(results);
      if (error) {
        console.error("DB insert error:", error);
        throw error;
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: results.length }),
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
