import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizeDate(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  if (!dateStr) return today;
  let result = today;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    result = dateStr;
  } else {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      result = d.toISOString().split("T")[0];
    }
  }
  // Never return a future date
  if (result > today) return today;
  // Never return a date older than 14 days (likely wrong extraction)
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const minDate = twoWeeksAgo.toISOString().split("T")[0];
  if (result < minDate) return today;
  return result;
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
  { url: "https://www.chinapharmaceuticals.com", name: "China Pharmaceuticals", region: "해외", country: "CN" },
  { url: "https://www.pharmiweb.com/search/?q=china+pharmaceutical", name: "PharmiWeb China", region: "해외", country: "CN" },
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

## CRITICAL RULE — KEYWORDS MUST BE FROM THE ARTICLE TEXT
- apiKeywords MUST contain ingredient/compound names that are **EXPLICITLY written** in the article.
- DO NOT guess, infer, or hallucinate ingredient names that are NOT in the text.
- If an article only mentions a brand name (e.g. 키트루다) without stating its active ingredient name, set apiKeywords to [].
- Read the article carefully. Only extract names that literally appear in the scraped text.

## What counts as a valid keyword
- Small-molecule compounds: 세마글루타이드, 암로디핀, 메트포르민
- Biologics/antibodies: 니볼루맙, 두필루맙, 트라스투주맙 — IF explicitly named in article
- Plant extracts/compounds: 은행엽건조엑스, 유파티린 — IF explicitly named in article
- Any INN or chemical name explicitly stated in the article

## Keyword format
- Format: "한글명 (English Name)" — e.g. 세마글루타이드 (Semaglutide)

## INVALID keywords — NEVER use:
- Brand/product names only: 키트루다, 듀피젠트, 유베지, 스티렌 정, 위고비
- Generic categories without specific compound: 엑소좀, mRNA, GLP-1, siRNA, 백신, 천연물
- Mechanism/receptor names: GFRA1 수용체 작용제

## Date rule
- Use the article's ACTUAL publication date. Format: YYYY-MM-DD.
- Today is ${new Date().toISOString().split("T")[0]}. NEVER use future dates or dates older than 2 weeks.

## Output rules
- Return at most 5 articles. Only include articles with at least one VALID apiKeyword.
- Translate title and summary to Korean. Write a concise 2-sentence summary.`,
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
