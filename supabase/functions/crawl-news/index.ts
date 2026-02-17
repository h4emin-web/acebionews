import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// RSS feed sources
const RSS_SOURCES = [
  { rss: "https://www.fiercepharma.com/rss/xml", name: "FiercePharma", region: "해외", country: "US" },
  { rss: "https://www.pharmaceutical-technology.com/feed/", name: "Pharma Technology", region: "해외", country: "EU" },
  { rss: "https://www.expresspharma.in/feed/", name: "Express Pharma", region: "해외", country: "IN" },
];

// HTML sources — 약업신문 & 데일리팜 + 의약뉴스 + 히트뉴스 + fallback overseas
const HTML_SOURCES = [
  { url: "https://www.yakup.com/news/index.html?cat=12", name: "약업신문", region: "국내", country: "KR", parser: "yakup" },
  { url: "https://www.dailypharm.com/", name: "데일리팜", region: "국내", country: "KR", parser: "dailypharm" },
  { url: "https://www.newsmp.com/news/articleList.html?sc_section_code=S1N2&view_type=sm", name: "의약뉴스", region: "국내", country: "KR", parser: "newsmp" },
  { url: "https://www.hitnews.co.kr/news/articleList.html?sc_sub_section_code=S2N16&view_type=sm", name: "히트뉴스", region: "국내", country: "KR", parser: "hitnews" },
  { url: "https://www.kpanews.co.kr/news/articleList.html?sc_section_code=S1N4&view_type=sm", name: "약사공론", region: "국내", country: "KR", parser: "kpanews" },
  { url: "https://iyakunews.com/news-new", name: "医薬ニュース", region: "해외", country: "JP", parser: "iyakunews" },
  { url: "https://pharma.economictimes.indiatimes.com", name: "ET Pharma India", region: "해외", country: "IN", parser: "generic" },
];

function normalizeDate(dateStr?: string): string {
  if (dateStr) {
    // Try to parse various date formats
    // Format: "2026-02-16 05:55" or "2026-02-16" or "02.16 06:00" or "2026.02.16"
    const isoMatch = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
    }
    const dotMatch = dateStr.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    if (dotMatch) {
      return `${dotMatch[1]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[3].padStart(2, "0")}`;
    }
    // Short format like "02.16 06:00" — assume current year
    const shortMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\s/);
    if (shortMatch) {
      const year = new Date().getFullYear();
      return `${year}-${shortMatch[1].padStart(2, "0")}-${shortMatch[2].padStart(2, "0")}`;
    }
  }
  // Fallback: today's date (KST)
  return new Date().toISOString().split("T")[0];
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

// Parse 약업신문 HTML
function parseYakup(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  
  // Split by <li> tags and find article items
  const liBlocks = html.split(/<li>/gi);
  for (const block of liBlocks) {
    if (articles.length >= 15) break;
    
    // Find link with mode=view
    const linkMatch = block.match(/href="([^"]*mode=view[^"]*)"/i);
    if (!linkMatch) continue;
    
    const url = linkMatch[1].replace(/&amp;/g, "&");
    const fullUrl = url.startsWith("http") ? url : `https://www.yakup.com${url}`;
    
    // Extract title from title_con > span
    const titleMatch = block.match(/class="title_con">\s*<span>\s*([\s\S]*?)\s*<\/span>/i);
    if (!titleMatch) continue;
    const title = stripHtml(titleMatch[1]).trim();
    
    // Extract summary from text_con > span
    const summaryMatch = block.match(/class="text_con">\s*<span>\s*([\s\S]*?)\s*<\/span>/i);
    const summary = summaryMatch ? stripHtml(summaryMatch[1]).slice(0, 300).trim() : "";
    
    // Extract date
    const dateMatch = block.match(/class="date">\s*([\d.]+)\s*<\/span>/i);
    const dateStr = dateMatch ? dateMatch[1].replace(/\./g, "-") : "";
    
    if (title.length > 5) {
      articles.push({ title, summary, url: fullUrl, date: normalizeDate(dateStr) });
    }
  }
  return articles;
}

// Parse 데일리팜 HTML
function parseDailypharm(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  // Match news items: <a href="https://www.dailypharm.com/user/news/XXXXX"> ... <div class="nc_cont ...">TITLE</div>
  const itemRegex = /<a\s+href="(https:\/\/www\.dailypharm\.com\/user\/news\/\d+)"[^>]*>[\s\S]*?<div\s+class="nc_cont[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/div>/gi;
  let m;
  while ((m = itemRegex.exec(html)) !== null && articles.length < 15) {
    const url = m[1];
    const title = stripHtml(m[2]).trim();
    if (title.length > 5 && !articles.some(a => a.title === title)) {
      articles.push({ title, summary: "", url, date: normalizeDate("") });
    }
  }
  return articles;
}

// Parse 의약뉴스 (newsmp.com) HTML
function parseNewsmp(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const blockRegex = /<div class="list-block">([\s\S]*?)<\/div>\s*<!--\/\/ group -->/gi;
  let m;
  while ((m = blockRegex.exec(html)) !== null && articles.length < 15) {
    const block = m[1];
    const titleMatch = block.match(/<div class="list-titles">\s*<a[^>]*href="([^"]*)"[^>]*>\s*<strong>([\s\S]*?)<\/strong>/i);
    if (!titleMatch) continue;
    const url = titleMatch[1].trim();
    const title = stripHtml(titleMatch[2]).trim();
    const summaryMatch = block.match(/<p class="list-summary">\s*<a[^>]*>([\s\S]*?)<\/a>/i);
    const summary = summaryMatch ? stripHtml(summaryMatch[1]).slice(0, 300).trim() : "";
    const dateMatch = block.match(/<div class="list-dated">[^|]*\|\s*(\d{4}-\d{2}-\d{2})\s/i);
    const dateStr = dateMatch ? dateMatch[1] : "";
    if (title.length > 5) {
      articles.push({ title, summary, url, date: normalizeDate(dateStr) });
    }
  }
  return articles;
}

// Parse 히트뉴스 (hitnews.co.kr) HTML
function parseHitnews(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const liRegex = /<li>\s*<h4 class="titles">\s*<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/h4>[\s\S]*?<em class="info dated">([\s\S]*?)<\/em>\s*<\/li>/gi;
  let m;
  while ((m = liRegex.exec(html)) !== null && articles.length < 20) {
    const url = m[1].trim();
    const title = stripHtml(m[2]).trim();
    const dateStr = stripHtml(m[3]).trim(); // e.g. "02.16 06:00"
    if (title.length > 5) {
      articles.push({ title, summary: "", url, date: normalizeDate(dateStr) });
    }
  }
  return articles;
}

// Parse 약사공론 (kpanews.co.kr) HTML
function parseKpanews(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const liRegex = /<li class="altlist-webzine-item">([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRegex.exec(html)) !== null && articles.length < 20) {
    const block = m[1];
    const titleMatch = block.match(/<h2 class="altlist-subject">\s*<a\s+href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
    if (!titleMatch) continue;
    const url = titleMatch[1].trim();
    const title = stripHtml(titleMatch[2]).trim();
    const summaryMatch = block.match(/<p class="altlist-summary">\s*([\s\S]*?)\s*<\/p>/i);
    const summary = summaryMatch ? stripHtml(summaryMatch[1]).slice(0, 300).trim() : "";
    const dateMatch = block.match(/<div class="altlist-info-item">(\d{2}-\d{2}\s+\d{2}:\d{2})<\/div>/i);
    const dateStr = dateMatch ? dateMatch[1] : "";
    if (title.length > 5) {
      articles.push({ title, summary, url, date: normalizeDate(dateStr) });
    }
  }
  return articles;
}

// Parse 医薬ニュース (iyakunews.com) HTML
function parseIyakuNews(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  // Split by rss-site-item divs
  const parts = html.split(/class=['"]rss-site-item['"]/gi);
  
  for (let i = 1; i < parts.length && articles.length < 20; i++) {
    const block = parts[i];
    const urlMatch = block.match(/href=['"]([^'"]*)['"]/i);
    if (!urlMatch) continue;
    const url = urlMatch[1].replace(/&amp;/g, "&").trim();
    // Extract title text between <p class='title'> and </p>
    const pMatch = block.match(/class=['"]title['"][^>]*>([\s\S]*?)<\/p>/i);
    if (!pMatch) continue;
    let titleRaw = pMatch[1]
      .replace(/<span[^>]*>.*?<\/span>/gi, "") // remove NEW! badge
      .replace(/&lt;b&gt;/g, "").replace(/&lt;\/b&gt;/g, "") // remove escaped <b> tags
      .replace(/<[^>]*>/g, "") // strip remaining HTML
      .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
      .trim();
    // Extract date: [YYYY/MM/DD HH:MM]
    const dateMatch = titleRaw.match(/\[(\d{4})\/(\d{2})\/(\d{2})\s+\d{2}:\d{2}\]/);
    let dateStr = "";
    if (dateMatch) {
      dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      titleRaw = titleRaw.replace(/\s*\[\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}\]\s*/, "").trim();
    }
    // Remove trailing source: " - ソース名" or "　[…]"
    titleRaw = titleRaw.replace(/\s*[ー－—]\s+[^\[]+$/, "").replace(/　$/, "").trim();
    if (titleRaw.length > 5) {
      articles.push({ title: titleRaw, summary: "", url, date: normalizeDate(dateStr) });
    }
  }
  return articles;
}

// Fetch HTML and parse based on parser type
async function fetchHtml(source: typeof HTML_SOURCES[0]): Promise<Array<{ title: string; summary: string; url: string; date: string }>> {
  try {
    console.log(`Fetching HTML: ${source.name}`);
    const resp = await fetch(source.url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      console.error(`HTML fetch failed for ${source.name}: ${resp.status}`);
      return [];
    }
    const html = await resp.text();

    let articles: Array<{ title: string; summary: string; url: string; date: string }> = [];

    if (source.parser === "yakup") {
      articles = parseYakup(html);
    } else if (source.parser === "dailypharm") {
      articles = parseDailypharm(html);
    } else if (source.parser === "newsmp") {
      articles = parseNewsmp(html);
    } else if (source.parser === "hitnews") {
      articles = parseHitnews(html);
    } else if (source.parser === "kpanews") {
      articles = parseKpanews(html);
    } else if (source.parser === "answersnews") {
      articles = parseIyakuNews(html);
    } else if (source.parser === "iyakunews") {
      articles = parseIyakuNews(html);
    } else {
      // Generic fallback
      const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let lm;
      while ((lm = linkRegex.exec(html)) !== null && articles.length < 10) {
        const href = lm[1];
        const text = stripHtml(lm[2]).trim();
        if (text.length > 20 && text.length < 200 && !href.includes("javascript:")) {
          const fullUrl = href.startsWith("http") ? href : `${source.url}${href.startsWith("/") ? "" : "/"}${href}`;
          articles.push({ title: text, summary: "", url: fullUrl, date: normalizeDate("") });
        }
      }
    }

    console.log(`Extracted ${articles.length} articles from ${source.name} HTML`);
    return articles;
  } catch (err) {
    console.error(`HTML error for ${source.name}:`, err);
    return [];
  }
}

// Use Gemini API to extract keywords AND translate/summarize foreign articles
async function extractKeywordsAndTranslate(
  articles: Array<{ title: string; summary: string; source: string; region: string; country: string; url: string; date: string }>,
  GOOGLE_GEMINI_API_KEY: string
): Promise<any[]> {
  if (articles.length === 0) return [];

  const articleList = articles.map((a, i) => `[${i}] [${a.region}] ${a.title} | ${a.summary}`).join("\n");

  try {
    const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a pharmaceutical news analyst specializing in Active Pharmaceutical Ingredients (APIs/원료의약품).

## TASK 1: KEYWORD EXTRACTION
- apiKeywords MUST contain the MOST relevant ingredient/compound name(s) that are EXPLICITLY written in the article title or summary. Usually 1-2 keywords.
- DO NOT guess, infer, or hallucinate ingredient names that are NOT in the text.
- If an article only mentions a brand name without its active ingredient, set apiKeywords to [].
- Valid keywords: small-molecule compounds, biologics, any INN or chemical name explicitly stated.
- Keyword format: "한글명 (English Name)"
- INVALID: Brand/product names only, generic categories (엑소좀, mRNA, GLP-1, siRNA, 백신), mechanism names.

## TASK 1-B: RELATED KEYWORDS
- relatedKeywords: 2-3 related/similar API ingredient names that are relevant to the article's therapeutic area or mechanism, but NOT explicitly mentioned in the article.
- These should be competing drugs, same-class compounds, or closely related ingredients that a pharmaceutical professional would want to know about.
- Format: "한글명 (English Name)"
- Example: Article about 세마글루타이드 → relatedKeywords: ["터제파타이드 (Tirzepatide)", "오르포글리프론 (Orforglipron)", "리라글루타이드 (Liraglutide)"]
- If no meaningful related keywords exist, return an empty array.

## TASK 2: TRANSLATION & SUMMARY (MANDATORY)
- **CRITICAL: You MUST translate ALL [해외] articles. This is NOT optional.**
- For articles marked [해외], you MUST provide:
  - translated_title: Korean translation of the title. NEVER leave this empty for foreign articles.
  - translated_summary: Korean summary, 2 sentences max, key facts only. 존댓말(~입니다, ~됩니다) 사용.
- For articles marked [국내]:
  - translated_title: set to the original Korean title.
  - translated_summary: 기사 핵심 내용을 2문장 이내로 간결하게 요약. 사실만 기술하고 존댓말(~입니다, ~됩니다) 사용. "~이다", "~했다" 등 반말 사용 금지.

## Output: JSON array. Include ALL articles (even those with empty apiKeywords).
- category: 규제/시장/공급망/R&D/임상/허가`,
          },
          {
            role: "user",
            content: `Extract API keywords and translate foreign articles:\n\n${articleList}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_keywords",
              description: "Extract API keywords and translate foreign news articles",
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
                        relatedKeywords: { type: "array", items: { type: "string" }, description: "2-3 related/similar API ingredients relevant to the article's therapeutic area" },
                        category: { type: "string" },
                        translated_title: { type: "string", description: "Korean translated title. REQUIRED for all articles." },
                        translated_summary: { type: "string", description: "Korean summary. REQUIRED for all articles." },
                      },
                      required: ["index", "apiKeywords", "relatedKeywords", "category", "translated_title", "translated_summary"],
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
      if (aiResp.status === 429) {
        console.warn("Rate limited - skipping this batch");
      }
      return [];
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return [];

    const parsed = JSON.parse(toolCall.function.arguments);
    const results: any[] = [];

    for (const r of parsed.results || []) {
      const article = articles[r.index];
      if (!article) continue;

      const isForeign = article.region === "해외";
      // Always use translated title/summary when available
      const finalTitle = r.translated_title || article.title;
      const finalSummary = r.translated_summary || article.summary;

      results.push({
        title: finalTitle,
        summary: finalSummary,
        source: article.source,
        region: article.region,
        country: article.country,
        url: article.url,
        date: article.date,
        api_keywords: r.apiKeywords || [],
        related_keywords: r.relatedKeywords || [],
        category: r.category || "",
        original_language: isForeign ? (article.country === "JP" ? "ja" : "en") : "ko",
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

    const body = await req.json().catch(() => ({}));

    // --- Backfill mode: fix keyword format to "한글명 (English Name)" ---
    if (body.backfillKeywords) {
      const { data: allArticles } = await supabase
        .from("news_articles")
        .select("id, api_keywords")
        .order("created_at", { ascending: false })
        .limit(500);

      // Find articles with keywords that are English-only or missing Korean
      const needsFix = (allArticles || []).filter((a: any) => {
        return (a.api_keywords || []).some((kw: string) => {
          // English-only (no Korean chars), or format like "Wegovy (위고비)" instead of "위고비 (Wegovy)"
          const hasKorean = /[\uAC00-\uD7A3]/.test(kw);
          const startsWithEnglish = /^[a-zA-Z]/.test(kw);
          return !hasKorean || startsWithEnglish;
        });
      });
      console.log(`Found ${needsFix.length} articles with keywords needing format fix`);

      let fixed = 0;
      const kBatchSize = 10;
      for (let i = 0; i < needsFix.length; i += kBatchSize) {
        const batch = needsFix.slice(i, i + kBatchSize);
        const kwList = batch.map((a: any, idx: number) => `[${idx}] ${JSON.stringify(a.api_keywords)}`).join("\n");

        try {
          const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: `제약 원료의약품 키워드 형식 전문가입니다. 각 키워드를 반드시 "한글명 (English Name)" 형식으로 변환하세요.
규칙:
- 영문만 있는 경우: 한국어 번역을 앞에 추가. 예: "Rivaroxaban" → "리바록사반 (Rivaroxaban)"
- 한글만 있는 경우: 영문명을 괄호 안에 추가. 예: "세마글루타이드" → "세마글루타이드 (Semaglutide)"  
- "영문 (한글)" 형식인 경우: 순서를 바꿔서 "한글 (영문)"으로. 예: "Wegovy (위고비)" → "위고비 (Wegovy)"
- 이미 "한글 (영문)" 형식이면 그대로 유지
- 브랜드명은 그대로 한글화. 예: "Uplizna" → "유플리즈나 (Uplizna)"
- 코드명(JW0061 등)이나 카테고리(mRNA, GLP-1, siRNA)는 제외(빈 배열 반환)` },
                { role: "user", content: `Fix keyword format:\n\n${kwList}` },
              ],
              tools: [{ type: "function", function: { name: "fix_keywords", description: "Fix keyword format", parameters: { type: "object", properties: { results: { type: "array", items: { type: "object", properties: { index: { type: "number" }, keywords: { type: "array", items: { type: "string" } } }, required: ["index", "keywords"], additionalProperties: false } } }, required: ["results"], additionalProperties: false } } }],
              tool_choice: { type: "function", function: { name: "fix_keywords" } },
            }),
          });
          if (!aiResp.ok) { console.error(`Gemini error: ${aiResp.status}`); continue; }
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall) continue;
          const parsed = JSON.parse(toolCall.function.arguments);
          for (const r of parsed.results || []) {
            const article = batch[r.index];
            if (!article || !r.keywords) continue;
            await supabase.from("news_articles").update({ api_keywords: r.keywords }).eq("id", article.id);
            fixed++;
          }
        } catch (err) { console.error("Keyword fix batch error:", err); }
        if (i + kBatchSize < needsFix.length) await new Promise(r => setTimeout(r, 1500));
      }
      return new Response(JSON.stringify({ success: true, fixed, total: needsFix.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- Backfill mode: generate related keywords for existing articles ---
    if (body.backfillRelatedKeywords) {
      const batchLimit = body.limit || 50;
      const { data: allArticles } = await supabase
        .from("news_articles")
        .select("id, title, summary, api_keywords, related_keywords")
        .order("created_at", { ascending: false })
        .limit(batchLimit);

      const needsFix = (allArticles || []).filter((a: any) => {
        return (a.api_keywords || []).length > 0 && (!a.related_keywords || a.related_keywords.length === 0);
      });
      console.log(`Found ${needsFix.length} articles needing related keywords`);

      let fixed = 0;
      const batchSize = 10;
      for (let i = 0; i < needsFix.length; i += batchSize) {
        const batch = needsFix.slice(i, i + batchSize);
        const articleList = batch.map((a: any, idx: number) => `[${idx}] Keywords: ${JSON.stringify(a.api_keywords)} | Title: ${a.title}`).join("\n");

        try {
          const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: `제약 원료의약품 전문가입니다. 각 기사의 주요 키워드를 보고, 같은 치료 영역이나 작용 기전의 관련/경쟁 원료의약품 2-3개를 추천하세요.
규칙:
- 형식: "한글명 (English Name)"
- 주요 키워드와 중복되지 않는 관련 원료만 추천
- 같은 적응증의 경쟁약물, 같은 계열 약물, 또는 병용약물 위주
- 관련 원료가 없으면 빈 배열 반환` },
                { role: "user", content: `Generate related keywords:\n\n${articleList}` },
              ],
              tools: [{ type: "function", function: { name: "generate_related", description: "Generate related keywords", parameters: { type: "object", properties: { results: { type: "array", items: { type: "object", properties: { index: { type: "number" }, relatedKeywords: { type: "array", items: { type: "string" } } }, required: ["index", "relatedKeywords"], additionalProperties: false } } }, required: ["results"], additionalProperties: false } } }],
              tool_choice: { type: "function", function: { name: "generate_related" } },
            }),
          });
          if (!aiResp.ok) { console.error(`Gemini error: ${aiResp.status}`); continue; }
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall) continue;
          const parsed = JSON.parse(toolCall.function.arguments);
          for (const r of parsed.results || []) {
            const article = batch[r.index];
            if (!article || !r.relatedKeywords) continue;
            await supabase.from("news_articles").update({ related_keywords: r.relatedKeywords }).eq("id", article.id);
            fixed++;
          }
        } catch (err) { console.error("Related keywords batch error:", err); }
        if (i + batchSize < needsFix.length) await new Promise(r => setTimeout(r, 1500));
      }
      return new Response(JSON.stringify({ success: true, fixed, total: needsFix.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- Backfill mode: translate existing foreign articles or re-summarize domestic ---
    if (body.backfillTranslations) {
      const { data: foreignArticles } = await supabase
        .from("news_articles")
        .select("id, title, summary, region, country")
        .eq("region", "해외")
        .order("created_at", { ascending: false })
        .limit(200);

      const needsTranslation = (foreignArticles || []).filter((a: any) => {
        return /[a-zA-Z]{3,}/.test(a.title) || /[\u3040-\u309F\u30A0-\u30FF]/.test(a.title);
      });
      console.log(`Found ${needsTranslation.length} foreign articles needing translation`);

      let translated = 0;
      const tBatchSize = 5;
      for (let i = 0; i < needsTranslation.length; i += tBatchSize) {
        const batch = needsTranslation.slice(i, i + tBatchSize);
        const articleList = batch.map((a: any, idx: number) => `[${idx}] ${a.title} | ${a.summary?.slice(0, 200) || ""}`).join("\n");

        try {
          const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: `제약/바이오 뉴스 번역 전문가입니다. 영어 또는 일본어 기사를 한국어로 번역하세요.\n- translated_title: 기사 제목을 한국어로 번역\n- translated_summary: 기사 핵심 내용을 한국어 2문장 이내로 요약. 존댓말(~입니다, ~됩니다) 사용.\n모든 기사에 대해 반드시 번역을 제공해야 합니다.` },
                { role: "user", content: `Translate these articles to Korean:\n\n${articleList}` },
              ],
              tools: [{ type: "function", function: { name: "translate_articles", description: "Translate articles to Korean", parameters: { type: "object", properties: { results: { type: "array", items: { type: "object", properties: { index: { type: "number" }, translated_title: { type: "string" }, translated_summary: { type: "string" } }, required: ["index", "translated_title", "translated_summary"], additionalProperties: false } } }, required: ["results"], additionalProperties: false } } }],
              tool_choice: { type: "function", function: { name: "translate_articles" } },
            }),
          });
          if (!aiResp.ok) { console.error(`Gemini error: ${aiResp.status}`); continue; }
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall) continue;
          const parsed = JSON.parse(toolCall.function.arguments);
          for (const r of parsed.results || []) {
            const article = batch[r.index];
            if (!article || !r.translated_title) continue;
            await supabase.from("news_articles").update({ title: r.translated_title, summary: r.translated_summary || article.summary }).eq("id", article.id);
            translated++;
          }
        } catch (err) { console.error("Translation batch error:", err); }
        if (i + tBatchSize < needsTranslation.length) await new Promise(r => setTimeout(r, 2000));
      }
      return new Response(JSON.stringify({ success: true, translated, total: needsTranslation.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.backfillSummaries) {
      const { data: articles } = await supabase
        .from("news_articles")
        .select("id, title, summary, region, country, source, url, date, api_keywords")
        .eq("region", "국내")
        .order("created_at", { ascending: false })
        .limit(200);

      const needsSummary = (articles || []).filter((a: any) => {
        if (!a.summary) return false;
        if (a.summary.length > 150) return true;
        if (/이다\.|했다\.|된다\.|보인다\.|한다\.|있다\.|없다\.|됐다\.|났다\.|왔다\.|겠다\.|진다\./.test(a.summary)) return true;
        return false;
      });
      console.log(`Found ${needsSummary.length} domestic articles needing summary`);

      let updated = 0;
      const batchSize = 20;
      for (let i = 0; i < needsSummary.length; i += batchSize) {
        const batch = needsSummary.slice(i, i + batchSize);
        const articleList = batch.map((a: any, idx: number) => `[${idx}] ${a.title} | ${a.summary.slice(0, 200)}`).join("\n");
        try {
          const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: `제약/바이오 뉴스 요약 전문가입니다. 각 기사의 핵심 내용을 한국어 2문장 이내로 간결하게 요약하세요. 존댓말(~입니다, ~됩니다, ~했습니다)을 사용하세요.` },
                { role: "user", content: `Summarize these articles:\n\n${articleList}` },
              ],
              tools: [{ type: "function", function: { name: "summarize_articles", description: "Return summaries", parameters: { type: "object", properties: { results: { type: "array", items: { type: "object", properties: { index: { type: "number" }, summary: { type: "string" } }, required: ["index", "summary"], additionalProperties: false } } }, required: ["results"], additionalProperties: false } } }],
              tool_choice: { type: "function", function: { name: "summarize_articles" } },
            }),
          });
          if (!aiResp.ok) { console.error(`Gemini error: ${aiResp.status}`); continue; }
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall) continue;
          const parsed = JSON.parse(toolCall.function.arguments);
          for (const r of parsed.results || []) {
            const article = batch[r.index];
            if (!article || !r.summary) continue;
            await supabase.from("news_articles").update({ summary: r.summary }).eq("id", article.id);
            updated++;
          }
        } catch (err) { console.error("Backfill batch error:", err); }
        if (i + batchSize < needsSummary.length) await new Promise(r => setTimeout(r, 2000));
      }
      return new Response(JSON.stringify({ success: true, summarized: updated, total: needsSummary.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Fetch all sources in parallel
    const rssPromises = RSS_SOURCES.map((s) => fetchRss(s).then((articles) =>
      articles.map((a) => ({ ...a, source: s.name, region: s.region, country: s.country }))
    ));
    const htmlPromises = HTML_SOURCES.map((s) => fetchHtml(s).then((articles) =>
      articles.map((a) => ({ ...a, source: s.name, region: s.region, country: s.country }))
    ));

    const allFetched = (await Promise.all([...rssPromises, ...htmlPromises])).flat();
    console.log(`Total fetched articles: ${allFetched.length}`);

    // 2. Extract keywords + translate foreign articles using Gemini
    const batchSize = 65;
    const allResults: any[] = [];
    for (let i = 0; i < allFetched.length; i += batchSize) {
      const batch = allFetched.slice(i, i + batchSize);
      const results = await extractKeywordsAndTranslate(batch, GOOGLE_GEMINI_API_KEY);
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
