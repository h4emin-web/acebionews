import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// RSS feed sources — no Firecrawl needed
const RSS_SOURCES = [
  // 국내
  { rss: "https://www.yakup.com/news/rss/", name: "약업신문", region: "국내", country: "KR" },
  { rss: "https://www.pharmnews.com/rss/allArticle.xml", name: "팜뉴스", region: "국내", country: "KR" },
  { rss: "https://www.dailypharm.com/rss/allArticle.xml", name: "데일리팜", region: "국내", country: "KR" },
  // 미국
  { rss: "https://www.fiercepharma.com/rss/xml", name: "FiercePharma", region: "해외", country: "US" },
  // 유럽
  { rss: "https://www.pharmaceutical-technology.com/feed/", name: "Pharma Technology", region: "해외", country: "EU" },
  // 인도
  { rss: "https://www.expresspharma.in/feed/", name: "Express Pharma", region: "해외", country: "IN" },
];

// Fallback: direct HTML fetch for sites without RSS
const HTML_SOURCES = [
  { url: "https://pharma.economictimes.indiatimes.com", name: "ET Pharma India", region: "해외", country: "IN" },
  { url: "https://www.nippon.com/en/tag/pharmaceutical", name: "Nippon", region: "해외", country: "JP" },
];

function normalizeDate(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  if (!dateStr) return today;
  let result = today;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    result = d.toISOString().split("T")[0];
  }
  if (result > today) return today;
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const minDate = twoWeeksAgo.toISOString().split("T")[0];
  if (result < minDate) return today;
  return result;
}

function stripCdata(text: string): string {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

// Parse RSS XML into articles
function parseRss(xml: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const items: Array<{ title: string; summary: string; url: string; date: string }> = [];

  // Match <item> or <entry> blocks
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>|<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 15) {
    const block = match[1] || match[2] || "";

    const titleM = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descM = block.match(/<description[^>]*>([\s\S]*?)<\/description>|<summary[^>]*>([\s\S]*?)<\/summary>|<content[^>]*>([\s\S]*?)<\/content>/i);
    const linkM = block.match(/<link[^>]*>([\s\S]*?)<\/link>|<link[^>]*href="([^"]*?)"/i);
    const dateM = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>|<published[^>]*>([\s\S]*?)<\/published>|<dc:date[^>]*>([\s\S]*?)<\/dc:date>|<updated[^>]*>([\s\S]*?)<\/updated>/i);

    const title = stripHtml(stripCdata(titleM?.[1] || ""));
    const summary = stripHtml(stripCdata(descM?.[1] || descM?.[2] || descM?.[3] || "")).slice(0, 300);
    const url = stripCdata(linkM?.[1] || linkM?.[2] || "").trim();
    const date = stripCdata(dateM?.[1] || dateM?.[2] || dateM?.[3] || dateM?.[4] || "");

    if (title) {
      items.push({ title, summary, url, date: normalizeDate(date) });
    }
  }
  return items;
}

// Fetch RSS feed
async function fetchRss(source: typeof RSS_SOURCES[0]): Promise<Array<{ title: string; summary: string; url: string; date: string }>> {
  try {
    console.log(`Fetching RSS: ${source.name}`);
    const resp = await fetch(source.rss, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsCrawler/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      console.error(`RSS fetch failed for ${source.name}: ${resp.status}`);
      return [];
    }
    const xml = await resp.text();
    const articles = parseRss(xml);
    console.log(`Parsed ${articles.length} articles from ${source.name} RSS`);
    return articles;
  } catch (err) {
    console.error(`RSS error for ${source.name}:`, err);
    return [];
  }
}

// Fetch HTML fallback — extract article-like links
async function fetchHtml(source: typeof HTML_SOURCES[0]): Promise<Array<{ title: string; summary: string; url: string; date: string }>> {
  try {
    console.log(`Fetching HTML: ${source.name}`);
    const resp = await fetch(source.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsCrawler/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return [];
    const html = await resp.text();

    // Extract headlines from common patterns
    const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
    const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRegex.exec(html)) !== null && articles.length < 10) {
      const href = m[1];
      const text = stripHtml(m[2]).trim();
      if (text.length > 20 && text.length < 200 && !href.includes("javascript:")) {
        const fullUrl = href.startsWith("http") ? href : `${source.url}${href.startsWith("/") ? "" : "/"}${href}`;
        articles.push({
          title: text,
          summary: "",
          url: fullUrl,
          date: normalizeDate(""),
        });
      }
    }
    console.log(`Extracted ${articles.length} articles from ${source.name} HTML`);
    return articles;
  } catch (err) {
    console.error(`HTML error for ${source.name}:`, err);
    return [];
  }
}

// Use Gemini API to extract API keywords from article titles/summaries
async function extractKeywords(
  articles: Array<{ title: string; summary: string; source: string; region: string; country: string; url: string; date: string }>,
  GOOGLE_GEMINI_API_KEY: string
): Promise<any[]> {
  if (articles.length === 0) return [];

  const articleList = articles.map((a, i) => `[${i}] ${a.title} | ${a.summary}`).join("\n");

  try {
    const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a pharmaceutical news analyst specializing in Active Pharmaceutical Ingredients (APIs/원료의약품).

## CRITICAL RULE — KEYWORDS MUST BE FROM THE ARTICLE TEXT
- apiKeywords MUST contain ingredient/compound names that are EXPLICITLY written in the article title or summary.
- DO NOT guess, infer, or hallucinate ingredient names that are NOT in the text.
- If an article only mentions a brand name without its active ingredient, set apiKeywords to [].

## Valid keywords
- Small-molecule compounds: 세마글루타이드, 암로디핀, 메트포르민
- Biologics: 니볼루맙, 두필루맙, 트라스투주맙
- Any INN or chemical name explicitly stated

## Keyword format: "한글명 (English Name)"

## INVALID keywords:
- Brand/product names only
- Generic categories: 엑소좀, mRNA, GLP-1, siRNA, 백신
- Mechanism names

## Output: Return JSON array where each item has index, apiKeywords, category.
- Only include articles with at least 1 valid keyword.
- category: 규제/시장/공급망/R&D/임상/허가`,
          },
          {
            role: "user",
            content: `Extract API keywords from these pharmaceutical news articles:\n\n${articleList}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_keywords",
              description: "Extract API keywords from news articles",
              parameters: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number" },
                        apiKeywords: { type: "array", items: { type: "string" } },
                        category: { type: "string" },
                      },
                      required: ["index", "apiKeywords", "category"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["results"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_keywords" } },
      }),
    });

    if (!aiResp.ok) {
      console.error(`Gemini API error: ${aiResp.status}`);
      return [];
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return [];

    const parsed = JSON.parse(toolCall.function.arguments);
    const results: any[] = [];

    for (const r of parsed.results || []) {
      if (!r.apiKeywords || r.apiKeywords.length === 0) continue;
      const article = articles[r.index];
      if (!article) continue;
      results.push({
        ...article,
        api_keywords: r.apiKeywords,
        category: r.category || "",
        original_language: article.region === "국내" ? "ko" : "en",
      });
    }

    return results;
  } catch (err) {
    console.error("Keyword extraction error:", err);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch all RSS feeds in parallel (FREE — no Firecrawl)
    const rssPromises = RSS_SOURCES.map((s) => fetchRss(s).then((articles) =>
      articles.map((a) => ({ ...a, source: s.name, region: s.region, country: s.country }))
    ));
    const htmlPromises = HTML_SOURCES.map((s) => fetchHtml(s).then((articles) =>
      articles.map((a) => ({ ...a, source: s.name, region: s.region, country: s.country }))
    ));

    const allFetched = (await Promise.all([...rssPromises, ...htmlPromises])).flat();
    console.log(`Total fetched articles: ${allFetched.length}`);

    // 2. Extract keywords using Gemini (2 large batches to minimize API calls)
    const batchSize = 30;
    const allResults: any[] = [];
    for (let i = 0; i < allFetched.length; i += batchSize) {
      const batch = allFetched.slice(i, i + batchSize);
      const results = await extractKeywords(batch, GOOGLE_GEMINI_API_KEY);
      allResults.push(...results);
      if (i + batchSize < allFetched.length) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    // 3. Clean up old articles (older than 7 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];
    const { count: deletedCount } = await supabase
      .from("news_articles")
      .delete({ count: "exact" })
      .lt("date", cutoffStr);
    if (deletedCount && deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} articles older than 7 days`);
    }

    // 4. Insert new articles (skip duplicates)
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
      JSON.stringify({ success: true, fetched: allFetched.length, withKeywords: allResults.length }),
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
